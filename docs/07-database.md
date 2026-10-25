# 7. Database & migration

## Kết nối

`DatabaseModule` dùng `@nestjs/sequelize`:

- `autoLoadModels: true` — model được đăng ký qua `SequelizeModule.forFeature([...])` ở từng module, không cần danh sách model trung tâm (code cũ phải sửa `database.providers.ts` và `entities.providers.ts` mỗi khi thêm bảng).
- Inject model: `@InjectModel(User) private readonly users: typeof User`.
- `DB_SYNC=true` cho phép `sequelize.sync()` — **chỉ dùng khi thử nghiệm cục bộ**. Mặc định `false`; schema do migration quản lý.

## BaseModel

```ts
export abstract class BaseModel<T> extends Model<T> {
  id: string;        // UUID v4, sinh phía app (DataType.UUIDV4)
  createdAt: Date;
  updatedAt: Date;
}
```

Mọi model kế thừa `BaseModel` để CRUD core giả định được `id` là khoá chính.

Soft delete: thêm `paranoid: true` vào `@Table({...})` + cột `deletedAt` trong migration. `CrudService.remove` gọi `entity.destroy()` nên tự động thành soft delete.

## Migration & seeder (sequelize-cli)

Cấu hình: `.sequelizerc` → `sql/config.js` (đọc `DB_*` từ `.env`).

```bash
npm run migrate          # chạy migration mới
npm run migrate:undo     # rollback tất cả
npm run migrate:reset    # undo + migrate
npm run seed             # roles + super admin
npm run seed:undo
npx sequelize-cli migration:generate --name add-xyz
```

Migration hiện có (schema sạch, thay toàn bộ ~70 migration cũ):

| File | Bảng |
|------|------|
| `20261024000001-create-roles` | `Roles` (+ extension `uuid-ossp`) |
| `20261024000002-create-users` | `Users` (email unique) |
| `20261024000003-create-profiles` | `Profiles` (userId unique, FK cascade) |
| `20261024000004-create-user-roles` | `UserRoles` (FK cascade, unique(userId, roleId)) |

Seeder:

| File | Nội dung |
|------|----------|
| `20261024000001-roles` | `SUPER_ADMIN`, `ADMIN`, `USER` (idempotent) |
| `20261024000002-super-admin` | Tài khoản từ `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (mặc định `admin@example.com` / `ChangeMe123`) — **đổi mật khẩu ngay** |

> Đây là base mới: **không** chạy các migration này lên database production cũ. Nếu cần chuyển dữ liệu từ DB cũ, viết migration chuyển đổi riêng (DB cũ có `Roles.type` dạng ENUM, `Users` thiếu `isActive`, …).

## Transaction

- Mọi `create/update/remove` của `CrudService` chạy trong **một** transaction; hook nhận `ctx.transaction`.
- `update/remove` khoá row (`SELECT … FOR UPDATE`) trước khi sửa để tránh ghi đè đồng thời.
- Tự mở transaction ở chỗ khác: `this.repository.transaction(async (t) => { ... })`.

## Quan hệ

Khai báo bằng decorator sequelize-typescript (`@HasOne`, `@BelongsTo`, `@BelongsToMany`). `include` cho API đặt trong hook `readOptions()` của service, ví dụ:

```ts
protected readOptions() {
  return { include: [{ model: Role, attributes: ['id', 'name'], through: { attributes: [] } }, { model: Profile }] };
}
```

`findMany` dùng `distinct: true` để `count` đúng khi include quan hệ 1-N/N-M.
