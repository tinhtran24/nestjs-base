import { Type } from '@nestjs/common';
import { ModelStatic, Transaction } from 'sequelize';
import { AuthUser } from '../auth/auth-user.interface';

export enum CrudRoute {
  GetMany = 'getMany',
  GetOne = 'getOne',
  CreateOne = 'createOne',
  UpdateOne = 'updateOne',
  DeleteOne = 'deleteOne',
}

/** Who may call a route. Route-level settings override the controller default. */
export interface CrudAccess {
  /** No authentication at all. */
  public?: boolean;
  /** Any of these roles grants access to every row. */
  roles?: string[];
  /**
   * Users without one of `roles` may still call the route, but only see/modify
   * rows they own (CrudService.ownerField === user.id).
   */
  owner?: boolean;
}

export interface CrudRouteOptions extends CrudAccess {
  /** Swagger summary. */
  summary?: string;
  /** Extra decorators for this route (throttling, caching, custom guards...). */
  decorators?: MethodDecorator[];
}

export interface CrudQueryOptions {
  /** Allowlist of columns usable as `?field.op=value`. Default: none. */
  filterable?: string[];
  /** Allowlist of columns usable in `?sort=`. `filterable` and `createdAt` are always added. */
  sortable?: string[];
  defaultSort?: [string, 'ASC' | 'DESC'];
  defaultPageSize?: number;
  maxPageSize?: number;
}

export interface CrudOptions {
  /** The Sequelize model served by the controller (used for Swagger and query parsing). */
  model: ModelStatic<any>;
  dto: {
    create?: Type<unknown>;
    update?: Type<unknown>;
  };
  /** Which routes to generate. Default: all of them. */
  routes?: {
    only?: CrudRoute[];
    exclude?: CrudRoute[];
  } & Partial<Record<CrudRoute, CrudRouteOptions>>;
  /** Default access rule for every route. */
  access?: CrudAccess;
  query?: CrudQueryOptions;
  /** Type of the `:id` route param. Default: 'uuid'. */
  idType?: 'uuid' | 'int';
}

/** Per-request information handed from the controller to the service. */
export interface CrudContext {
  user?: AuthUser;
  /** When set, the service restricts every query to rows owned by this user id. */
  ownedBy?: string;
  transaction?: Transaction;
}
