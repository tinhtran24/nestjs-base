import {
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  INestApplication,
  Injectable,
} from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { IsInt, IsString, Min } from 'class-validator';
import { DataTypes } from 'sequelize';
import request from 'supertest';
import { Crud, CrudContext, CrudRoute } from '../src/core/crud';
import {
  AllExceptionsFilter,
  createValidationPipe,
  Paginated,
  ResponseInterceptor,
} from '../src/core/http';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';

class Thing {
  static getAttributes() {
    return {
      id: { type: DataTypes.UUID },
      name: { type: DataTypes.STRING },
      qty: { type: DataTypes.INTEGER },
      secret: { type: DataTypes.STRING },
      createdAt: { type: DataTypes.DATE },
    };
  }
}

class CreateThingDto {
  @IsString()
  name: string;

  @IsInt()
  @Min(0)
  qty: number;
}

class UpdateThingDto {
  @IsString()
  name: string;
}

const ID = '3f1c7c3e-2b7a-4c55-9a43-6a1f0c1f9b10';

class FakeService {
  calls: { method: string; args: unknown[] }[] = [];
  private record(method: string, ...args: unknown[]) {
    this.calls.push({ method, args });
  }
  last() {
    return this.calls[this.calls.length - 1];
  }
  async findMany(query: unknown, ctx: CrudContext) {
    this.record('findMany', query, ctx);
    return Paginated.of([{ id: ID, name: 'a' }], 1, 1, 10);
  }
  async findOne(id: string, ctx: CrudContext) {
    this.record('findOne', id, ctx);
    return { id, name: 'a' };
  }
  async create(dto: unknown, ctx: CrudContext) {
    this.record('create', dto, ctx);
    return { id: ID, ...(dto as object) };
  }
  async update(id: string, dto: unknown, ctx: CrudContext) {
    this.record('update', id, dto, ctx);
    return { id, ...(dto as object) };
  }
  async remove(id: string, ctx: CrudContext) {
    this.record('remove', id, ctx);
  }
}

@Crud({
  model: Thing as any,
  dto: { create: CreateThingDto, update: UpdateThingDto },
  access: { roles: ['ADMIN'] },
  routes: {
    [CrudRoute.GetMany]: { public: true },
    [CrudRoute.GetOne]: { roles: ['ADMIN'], owner: true },
  },
  query: { filterable: ['name', 'qty'] },
})
@Controller('things')
class ThingsController {
  constructor(readonly service: FakeService) {}
}

@Crud({
  model: Thing as any,
  dto: {},
  routes: { only: [CrudRoute.GetMany, CrudRoute.DeleteOne] },
})
@Controller('overridden')
class OverriddenController {
  constructor(readonly service: FakeService) {}

  @Get()
  getMany() {
    return 'custom';
  }
}

/** Stands in for JwtAuthGuard: the user comes from an `x-user` header. */
@Injectable()
class HeaderAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const header = req.headers['x-user'];
    if (header) req.user = JSON.parse(header);
    return true;
  }
}

const admin = JSON.stringify({
  id: 'admin-1',
  email: 'a@x.io',
  roles: ['ADMIN'],
});
const member = JSON.stringify({
  id: 'user-1',
  email: 'u@x.io',
  roles: ['USER'],
});

describe('@Crud (e2e)', () => {
  let app: INestApplication;
  let service: FakeService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ThingsController, OverriddenController],
      providers: [
        FakeService,
        { provide: APP_GUARD, useClass: HeaderAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_PIPE, useFactory: createValidationPipe },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    service = moduleRef.get(FakeService);
  });

  afterAll(() => app.close());

  it('GET / lists with paging envelope and parsed filters', async () => {
    const res = await request(app.getHttpServer())
      .get('/things?qty.gte=2&sort=name:asc&page=2')
      .expect(200);
    expect(res.body).toMatchObject({
      statusCode: 200,
      message: 'OK',
      data: [{ id: ID }],
      meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });
    const [query] = service.last().args as any[];
    expect(query.page).toBe(2);
    expect(query.order).toEqual([['name', 'ASC']]);
    expect(Object.keys(query.where)).toEqual(['qty']);
  });

  it('GET / rejects filters outside the allowlist', async () => {
    const res = await request(app.getHttpServer())
      .get('/things?secret=x')
      .expect(400);
    expect(res.body.message).toContain('Cannot filter by "secret"');
  });

  it('GET /:id validates the id', async () => {
    await request(app.getHttpServer())
      .get('/things/nope')
      .set('x-user', admin)
      .expect(400);
  });

  it('GET /:id on an owner route scopes non-admins to their own rows', async () => {
    await request(app.getHttpServer())
      .get(`/things/${ID}`)
      .set('x-user', member)
      .expect(200);
    expect((service.last().args[1] as CrudContext).ownedBy).toBe('user-1');

    await request(app.getHttpServer())
      .get(`/things/${ID}`)
      .set('x-user', admin)
      .expect(200);
    expect((service.last().args[1] as CrudContext).ownedBy).toBeUndefined();
  });

  it('POST / validates the body with the create DTO', async () => {
    const bad = await request(app.getHttpServer())
      .post('/things')
      .set('x-user', admin)
      .send({ name: 'x', qty: -1, extra: true })
      .expect(400);
    expect(bad.body.errors.map((e: any) => e.field).sort()).toEqual([
      'extra',
      'qty',
    ]);

    const ok = await request(app.getHttpServer())
      .post('/things')
      .set('x-user', admin)
      .send({ name: 'x', qty: 1 })
      .expect(201);
    expect(ok.body.data).toEqual({ id: ID, name: 'x', qty: 1 });
    expect(service.last().args[0]).toBeInstanceOf(CreateThingDto);
  });

  it('POST / enforces roles', async () => {
    await request(app.getHttpServer())
      .post('/things')
      .set('x-user', member)
      .send({ name: 'x', qty: 1 })
      .expect(403);
  });

  it('PATCH /:id uses the update DTO', async () => {
    await request(app.getHttpServer())
      .patch(`/things/${ID}`)
      .set('x-user', admin)
      .send({ name: 'y' })
      .expect(200);
    expect(service.last().method).toBe('update');
    expect(service.last().args[1]).toBeInstanceOf(UpdateThingDto);
  });

  it('DELETE /:id returns 204', async () => {
    await request(app.getHttpServer())
      .delete(`/things/${ID}`)
      .set('x-user', admin)
      .expect(204);
    expect(service.last().method).toBe('remove');
  });

  it('keeps a method the controller defines itself', async () => {
    const res = await request(app.getHttpServer())
      .get('/overridden')
      .expect(200);
    expect(res.body.data).toBe('custom');
  });

  it('only generates the selected routes', async () => {
    await request(app.getHttpServer()).post('/overridden').send({}).expect(404);
    await request(app.getHttpServer()).delete(`/overridden/${ID}`).expect(204);
  });
});
