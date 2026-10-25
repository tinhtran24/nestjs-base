# 2. CRUD bằng decorator `@Crud()`

## Ý tưởng

Một controller CRUD đầy đủ chỉ cần:

```ts
@Crud({
  model: Product,
  dto: { create: CreateProductDto, update: UpdateProductDto },
  access: { roles: ADMIN_ROLES },
  query: { filterable: ['name', 'price', 'isActive'] },
})
@ApiTags('Products')
@Controller('products')
export class ProductsController implements CrudController {
  constructor(readonly service: ProductsService) {}
}
```

`@Crud` sinh ra 5 route:

| Route (`CrudRoute`) | HTTP | Gọi service | Ghi chú |
|---|---|---|---|
| `getMany` | `GET /` | `findMany(query, ctx)` | phân trang/sort/filter → `Paginated` |
| `getOne` | `GET /:id` | `findOne(id, ctx)` | 404 nếu không có / ngoài scope |
| `createOne` | `POST /` | `create(dto, ctx)` | chỉ sinh khi có `dto.create` |
| `updateOne` | `PATCH /:id` | `update(id, dto, ctx)` | chỉ sinh khi có `dto.update` |
| `deleteOne` | `DELETE /:id` | `remove(id, ctx)` | trả `204` |

Kèm theo: validation body theo DTO, `ParseUUIDPipe` (hoặc `ParseIntPipe` khi `idType: 'int'`), Swagger (`ApiOperation`, `ApiBody`, `ApiQuery`, schema response), guard role.

## Hoạt động bên trong

`src/core/crud/crud.decorator.ts`. Với mỗi route, decorator:

1. Định nghĩa method (`getMany`, `getOne`, …) lên `prototype` của controller.
2. Ghi metadata `design:paramtypes` — giống hệt thứ TypeScript tự emit cho method viết tay. Nhờ đó `ValidationPipe` biết DTO của `@Body()` và Swagger đọc được kiểu.
3. Gọi lần lượt các parameter decorator của Nest (`@Query()`, `@Param('id', pipe)`, `@Body()`, `@CurrentUser()`).
4. Gọi các method decorator (`@Get()`, `@ApiOperation()`, `@Roles()`, …) theo đúng thứ tự TS áp dụng.

Kết quả với Nest **không khác gì** viết tay — không có "magic runtime", không subclass động, không `@ts-ignore`.

## Cấu hình (`CrudOptions`)

```ts
interface CrudOptions {
  model: ModelStatic<any>;                 // model Sequelize
  dto: { create?: Type; update?: Type };   // thiếu create/update => không sinh route đó
  access?: CrudAccess;                     // quyền mặc định cho mọi route
  routes?: {
    only?: CrudRoute[];                    // chỉ sinh các route này
    exclude?: CrudRoute[];                 // bỏ các route này
    [CrudRoute.X]?: CrudRouteOptions;      // ghi đè quyền / summary / decorator cho 1 route
  };
  query?: CrudQueryOptions;                // xem 03-query-filtering.md
  idType?: 'uuid' | 'int';                 // mặc định 'uuid'
}

interface CrudAccess {
  public?: boolean;   // không cần đăng nhập
  roles?: string[];   // cần 1 trong các role này
  owner?: boolean;    // người không có role vẫn vào được, nhưng chỉ thấy row của mình
}

interface CrudRouteOptions extends CrudAccess {
  summary?: string;
  decorators?: MethodDecorator[];  // ví dụ: Throttle(), UseInterceptors(CacheInterceptor)
}
```

Cấu hình route **ghi đè** `access` mặc định (merge nông).

### Ví dụ thực tế trong project

```ts
// users.controller.ts — admin quản lý tất cả; user thường chỉ GET /users/:id của chính mình
@Crud({
  model: User,
  dto: { create: CreateUserDto, update: UpdateUserDto },
  access: { roles: ADMIN_ROLES },
  routes: { [CrudRoute.GetOne]: { roles: ADMIN_ROLES, owner: true } },
  query: { filterable: ['email', 'firstName', 'lastName', 'isActive', 'isVerified', 'createdAt'] },
})

// roles.controller.ts — admin đọc, chỉ SUPER_ADMIN được ghi
@Crud({
  model: Role,
  dto: { create: CreateRoleDto, update: UpdateRoleDto },
  access: { roles: ADMIN_ROLES },
  routes: {
    [CrudRoute.CreateOne]: { roles: [RoleType.SUPER_ADMIN] },
    [CrudRoute.UpdateOne]: { roles: [RoleType.SUPER_ADMIN] },
    [CrudRoute.DeleteOne]: { roles: [RoleType.SUPER_ADMIN] },
  },
})
```

Các biến thể hay dùng:

```ts
routes: { only: [CrudRoute.GetMany, CrudRoute.GetOne] }          // read-only
routes: { [CrudRoute.GetMany]: { public: true },
          [CrudRoute.GetOne]:  { public: true } }                // đọc công khai, ghi cần role
access: { roles: [], owner: true }                               // mọi user chỉ thao tác dữ liệu của mình
```

## Ghi đè một route

Nếu class đã tự khai báo method trùng tên (`getMany`, `getOne`, `createOne`, `updateOne`, `deleteOne`) thì `@Crud` **bỏ qua** route đó — bạn tự gắn decorator:

```ts
export class ProductsController implements CrudController {
  constructor(readonly service: ProductsService) {}

  @Get(':id')
  @Public()
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findPublished(id);
  }
}
```

## Thêm route riêng bên cạnh CRUD

Viết method bình thường trong class. Method khai báo trong class được Nest đăng ký **trước** các method do `@Crud` thêm vào, nên `GET /users/me` không bị `GET /users/:id` "nuốt":

```ts
@Get('me')
me(@CurrentUser() user: AuthUser) {
  return this.service.findOne(user.id);
}
```

## Service: `CrudService` (Template Method)

Controller chỉ là lớp HTTP mỏng; logic nằm ở service kế thừa `CrudService<Model, CreateDto, UpdateDto>`:

```ts
@Injectable()
export class ProductsService extends CrudService<Product, CreateProductDto, UpdateProductDto> {
  constructor(@InjectModel(Product) model: typeof Product) {
    super(new SequelizeRepository(model) /*, { ownerField: 'createdById' } */);
  }
}
```

Thuật toán cố định trong `CrudService`:

```
create:  transaction { values = beforeCreate(dto) → INSERT → afterCreate(entity, dto) } → reload với readOptions
update:  transaction { getOrFail(id, scope, FOR UPDATE) → values = beforeUpdate(entity, dto) → UPDATE → afterUpdate } → reload
remove:  transaction { getOrFail(id, scope, FOR UPDATE) → beforeRemove → DELETE → afterRemove }
findMany/findOne: luôn áp readOptions() + scope(ctx)
```

Hook có thể override:

| Hook | Mặc định | Dùng để |
|------|----------|---------|
| `readOptions()` | `{}` | `include` quan hệ, chọn `attributes` |
| `scope(ctx)` | lọc theo `ownerField` khi `ctx.ownedBy` | multi-tenant, soft rule (`isPublished = true`), … |
| `beforeCreate(dto, ctx)` | trả dto | hash password, chuẩn hoá, kiểm tra quyền nghiệp vụ |
| `afterCreate(entity, dto, ctx)` | — | tạo bản ghi liên quan (profile, role) **trong cùng transaction** |
| `beforeUpdate(entity, dto, ctx)` | trả dto | chặn đổi field, hash password |
| `afterUpdate(entity, dto, ctx)` | — | cập nhật quan hệ |
| `beforeRemove / afterRemove` | — | chặn xoá, dọn dẹp |

Trong hook, luôn truyền `{ transaction: ctx.transaction }` cho mọi query để cả thao tác được rollback cùng nhau. Ví dụ đầy đủ: `src/modules/users/users.service.ts` (hash password, tạo profile, gán role, chống leo thang quyền).

## `CrudContext`

```ts
interface CrudContext {
  user?: AuthUser;       // người gọi (undefined ở route public / lời gọi nội bộ)
  ownedBy?: string;      // set khi route có owner:true và user không có role đặc quyền
  transaction?: Transaction; // chỉ có trong hook
}
```

Gọi service từ code nội bộ (job, module khác) thì truyền `{}` hoặc `{ user }` — không bị giới hạn scope.

## Ownership trả 404 thay vì 403

Khi user không sở hữu row, `getOrFail` không tìm thấy row trong scope → **404**. Cố ý: không để lộ việc row đó tồn tại.
