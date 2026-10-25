# 6. Hướng dẫn tạo module mới — ví dụ `Product`

Mục tiêu: CRUD sản phẩm; ai cũng xem được sản phẩm đang bán; ADMIN quản lý; mỗi sản phẩm ghi lại người tạo.

## Bước 1 — Migration

```bash
npx sequelize-cli migration:generate --name create-products
```

```js
// sql/migrations/XXXX-create-products.js
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Products', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false,
            defaultValue: Sequelize.literal('uuid_generate_v4()') },
      name: { type: Sequelize.STRING, allowNull: false },
      price: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      createdById: { type: Sequelize.UUID, allowNull: true,
                     references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL' },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Products');
  },
};
```

```bash
npm run migrate
```

## Bước 2 — Model

```ts
// src/modules/products/product.model.ts
@Table({ tableName: 'Products' })
export class Product extends BaseModel<Product> {
  @ApiProperty() @AllowNull(false) @Column(DataType.STRING)
  declare name: string;

  @ApiProperty() @AllowNull(false) @Column(DataType.DECIMAL(12, 2))
  declare price: string; // DECIMAL trả về string trong pg

  @ApiProperty() @Default(true) @Column(DataType.BOOLEAN)
  declare isActive: boolean;

  @ForeignKey(() => User) @Column(DataType.UUID)
  declare createdById: string | null;
}
```

`@ApiProperty` để Swagger hiển thị schema response.

## Bước 3 — DTO

```ts
// src/modules/products/product.dto.ts
export class CreateProductDto {
  @ApiProperty() @IsString() @MaxLength(255) name: string;
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateProductDto extends PartialType(CreateProductDto) {}
```

Dùng `PartialType` từ `@nestjs/swagger` (không phải `@nestjs/mapped-types`) để Swagger vẫn đúng. Không đưa `createdById` vào DTO — server tự gán.

## Bước 4 — Service

```ts
// src/modules/products/products.service.ts
@Injectable()
export class ProductsService extends CrudService<Product, CreateProductDto, UpdateProductDto> {
  constructor(@InjectModel(Product) model: typeof Product) {
    super(new SequelizeRepository(model), { ownerField: 'createdById' });
  }

  protected async beforeCreate(dto: CreateProductDto, ctx: CrudContext) {
    return { ...dto, createdById: ctx.user?.id };
  }

  // Người không phải admin chỉ thấy sản phẩm đang bán
  protected scope(ctx: CrudContext) {
    const isAdmin = hasAnyRole(ctx.user, ADMIN_ROLES);
    return { ...super.scope(ctx), ...(!isAdmin && { isActive: true }) };
  }
}
```

## Bước 5 — Controller

```ts
// src/modules/products/products.controller.ts
@Crud({
  model: Product,
  dto: { create: CreateProductDto, update: UpdateProductDto },
  access: { roles: ADMIN_ROLES },
  routes: {
    [CrudRoute.GetMany]: { public: true },
    [CrudRoute.GetOne]: { public: true },
  },
  query: {
    filterable: ['name', 'price', 'isActive', 'createdAt'],
    defaultSort: ['name', 'ASC'],
  },
})
@ApiTags('Products')
@Controller('products')
export class ProductsController implements CrudController {
  constructor(readonly service: ProductsService) {}
}
```

> Route public: `ctx.user` là `undefined` (guard không nạp user) → `scope()` coi là khách.

## Bước 6 — Module & đăng ký

```ts
@Module({
  imports: [SequelizeModule.forFeature([Product])],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
```

Thêm `ProductsModule` vào `imports` của `AppModule`.

## Kết quả

```
GET    /v1/products?name.like=bơi&price.lte=500000&sort=price:asc&page=1&pageSize=20   (public)
GET    /v1/products/:id                                                                (public)
POST   /v1/products            (ADMIN, SUPER_ADMIN)
PATCH  /v1/products/:id        (ADMIN, SUPER_ADMIN)
DELETE /v1/products/:id        (ADMIN, SUPER_ADMIN)
```

## Checklist

- [ ] Migration + model khớp nhau (tên bảng, cột, kiểu)
- [ ] DTO có validator cho **mọi** field; không có field server tự quản (`id`, `createdById`, …)
- [ ] `filterable` chỉ gồm cột an toàn
- [ ] Quyền: `access` mặc định + ngoại lệ trong `routes`
- [ ] Logic trong hook, query trong hook dùng `ctx.transaction`
- [ ] Thêm module vào `AppModule`
- [ ] Viết test (mẫu: `test/crud.e2e-spec.ts`)
