import {
  Body,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  PipeTransform,
  Post,
  Query,
  Type,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  getSchemaPath,
} from '@nestjs/swagger';
import { AuthUser, hasAnyRole } from '../auth/auth-user.interface';
import {
  AllowOwner,
  CurrentUser,
  Public,
  Roles,
} from '../auth/auth.decorators';
import { PageMeta } from '../http/paginated';
import { CrudService } from './crud.service';
import {
  CrudAccess,
  CrudContext,
  CrudOptions,
  CrudRoute,
  CrudRouteOptions,
} from './crud.types';
import { parseCrudQuery } from './query/crud-query.parser';
import { FilterOperators } from './query/filter-operators';

export const CRUD_OPTIONS_KEY = 'crud:options';

/** Contract for controllers decorated with @Crud: expose the service as `service`. */
export interface CrudController {
  readonly service: CrudService<any>;
}

interface RouteParam {
  decorator: ParameterDecorator;
  type: unknown;
}

interface RouteDefinition {
  params: RouteParam[];
  decorators: MethodDecorator[];
  handler: (this: CrudController, ...args: any[]) => Promise<unknown>;
}

const ALL_ROUTES = Object.values(CrudRoute);

const resolveRoutes = (options: CrudOptions): CrudRoute[] => {
  const only = options.routes?.only ?? ALL_ROUTES;
  const exclude = options.routes?.exclude ?? [];
  return only.filter((route) => !exclude.includes(route));
};

/** Route-level settings win over the controller-wide `access` default. */
const resolveRouteOptions = (
  options: CrudOptions,
  route: CrudRoute,
): CrudRouteOptions => ({ ...options.access, ...options.routes?.[route] });

const accessDecorators = (access: CrudAccess): MethodDecorator[] => {
  if (access.public) return [Public()];
  return [
    ApiBearerAuth(),
    ...(access.roles?.length ? [Roles(...access.roles)] : []),
    ...(access.owner ? [AllowOwner()] : []),
  ];
};

/** Users lacking the privileged roles on an owner route only see their own rows. */
const contextFor = (
  user: AuthUser | undefined,
  access: CrudAccess,
): CrudContext => ({
  user,
  ownedBy:
    access.owner && user && !hasAnyRole(user, access.roles ?? [])
      ? user.id
      : undefined,
});

const idParam = (options: CrudOptions): RouteParam => {
  const pipe: PipeTransform =
    options.idType === 'int' ? new ParseIntPipe() : new ParseUUIDPipe();
  return {
    decorator: Param('id', pipe),
    type: options.idType === 'int' ? Number : String,
  };
};
const userParam: RouteParam = { decorator: CurrentUser(), type: Object };
const bodyParam = (dto: Type<unknown>): RouteParam => ({
  decorator: Body(),
  type: dto,
});

const modelName = (options: CrudOptions) => options.model.name;

const listQueryDocs = (options: CrudOptions): MethodDecorator[] => {
  const operators = FilterOperators.names().join(', ');
  return [
    ApiQuery({ name: 'page', required: false, type: Number }),
    ApiQuery({ name: 'pageSize', required: false, type: Number }),
    ApiQuery({
      name: 'sort',
      required: false,
      description: 'e.g. `createdAt:desc,email:asc`',
    }),
    ...(options.query?.filterable ?? []).map((field) =>
      ApiQuery({
        name: field,
        required: false,
        description: `Filter: \`${field}=v\` or \`${field}.<op>=v\` with op in: ${operators}`,
      }),
    ),
  ];
};

const buildRoute = (
  route: CrudRoute,
  options: CrudOptions,
): RouteDefinition | undefined => {
  const routeOptions = resolveRouteOptions(options, route);
  const name = modelName(options);
  const common = [
    ...accessDecorators(routeOptions),
    ...(routeOptions.decorators ?? []),
  ];
  const ref = { $ref: getSchemaPath(options.model) };

  switch (route) {
    case CrudRoute.GetMany:
      return {
        params: [{ decorator: Query(), type: Object }, userParam],
        decorators: [
          Get(),
          ApiOperation({ summary: routeOptions.summary ?? `List ${name}` }),
          ApiOkResponse({
            schema: {
              properties: {
                statusCode: { type: 'number', example: 200 },
                message: { type: 'string', example: 'OK' },
                data: { type: 'array', items: ref },
                meta: { $ref: getSchemaPath(PageMeta) },
              },
            },
          }),
          ...listQueryDocs(options),
          ...common,
        ],
        async handler(query: Record<string, unknown>, user?: AuthUser) {
          const parsed = parseCrudQuery(query, options.model, options.query);
          return this.service.findMany(parsed, contextFor(user, routeOptions));
        },
      };

    case CrudRoute.GetOne:
      return {
        params: [idParam(options), userParam],
        decorators: [
          Get(':id'),
          ApiOperation({ summary: routeOptions.summary ?? `Get ${name}` }),
          ApiParam({ name: 'id' }),
          ApiOkResponse({ schema: { properties: { data: ref } } }),
          ApiNotFoundResponse(),
          ...common,
        ],
        async handler(id: string, user?: AuthUser) {
          return this.service.findOne(id, contextFor(user, routeOptions));
        },
      };

    case CrudRoute.CreateOne:
      if (!options.dto.create) return undefined;
      return {
        params: [bodyParam(options.dto.create), userParam],
        decorators: [
          Post(),
          ApiOperation({ summary: routeOptions.summary ?? `Create ${name}` }),
          ApiBody({ type: options.dto.create }),
          ApiCreatedResponse({ schema: { properties: { data: ref } } }),
          ...common,
        ],
        async handler(dto: unknown, user?: AuthUser) {
          return this.service.create(dto, contextFor(user, routeOptions));
        },
      };

    case CrudRoute.UpdateOne:
      if (!options.dto.update) return undefined;
      return {
        params: [idParam(options), bodyParam(options.dto.update), userParam],
        decorators: [
          Patch(':id'),
          ApiOperation({ summary: routeOptions.summary ?? `Update ${name}` }),
          ApiParam({ name: 'id' }),
          ApiBody({ type: options.dto.update }),
          ApiOkResponse({ schema: { properties: { data: ref } } }),
          ApiNotFoundResponse(),
          ...common,
        ],
        async handler(id: string, dto: unknown, user?: AuthUser) {
          return this.service.update(id, dto, contextFor(user, routeOptions));
        },
      };

    case CrudRoute.DeleteOne:
      return {
        params: [idParam(options), userParam],
        decorators: [
          Delete(':id'),
          HttpCode(HttpStatus.NO_CONTENT),
          ApiOperation({ summary: routeOptions.summary ?? `Delete ${name}` }),
          ApiParam({ name: 'id' }),
          ApiNoContentResponse(),
          ApiNotFoundResponse(),
          ...common,
        ],
        async handler(id: string, user?: AuthUser) {
          await this.service.remove(id, contextFor(user, routeOptions));
        },
      };
  }
};

/**
 * Defines a handler on the controller prototype and applies Nest's route,
 * parameter and Swagger decorators to it — exactly what writing the method
 * by hand with `@Get() getMany(@Query() q) {...}` would do.
 */
const defineRoute = (
  prototype: object,
  name: string,
  definition: RouteDefinition,
) => {
  let descriptor: PropertyDescriptor = {
    value: definition.handler,
    writable: true,
    configurable: true,
    enumerable: false,
  };
  Object.defineProperty(prototype, name, descriptor);

  // Read by ValidationPipe (body DTO) and Swagger, like TS would emit for a hand-written method.
  Reflect.defineMetadata(
    'design:paramtypes',
    definition.params.map((param) => param.type),
    prototype,
    name,
  );
  definition.params.forEach((param, index) =>
    param.decorator(prototype, name, index),
  );

  for (const decorator of [...definition.decorators].reverse()) {
    descriptor = decorator(prototype, name, descriptor) || descriptor;
  }
  Object.defineProperty(prototype, name, descriptor);
};

/**
 * Generates REST endpoints for a model on a controller:
 *
 *   GET    /         getMany   (paging, sorting, filtering)
 *   GET    /:id      getOne
 *   POST   /         createOne (needs dto.create)
 *   PATCH  /:id      updateOne (needs dto.update)
 *   DELETE /:id      deleteOne
 *
 * The controller must expose a CrudService as `service`. A method the class
 * already defines under one of these names is left untouched, which is how a
 * single route is overridden.
 */
export function Crud(options: CrudOptions): ClassDecorator {
  return (target) => {
    ApiExtraModels(options.model, PageMeta)(target);

    for (const route of resolveRoutes(options)) {
      if (Object.prototype.hasOwnProperty.call(target.prototype, route))
        continue;
      const definition = buildRoute(route, options);
      if (definition) defineRoute(target.prototype, route, definition);
    }

    Reflect.defineMetadata(CRUD_OPTIONS_KEY, options, target);
  };
}
