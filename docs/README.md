# Tài liệu kỹ thuật — Crosswim API Base

Base project NestJS + Sequelize (PostgreSQL) chỉ giữ lại phần **authentication + user/role**, và một **CRUD core dựa trên decorator** để dựng module mới nhanh.

| # | Tài liệu | Nội dung |
|---|----------|----------|
| 1 | [Kiến trúc tổng quan](./01-architecture.md) | Cấu trúc thư mục, luồng request, response envelope, xử lý lỗi |
| 2 | [CRUD bằng decorator `@Crud()`](./02-crud-decorator.md) | Cách `@Crud` sinh route, cấu hình, override, hook của service |
| 3 | [Query: phân trang, sort, filter](./03-query-filtering.md) | Cú pháp `?field.op=value`, allowlist, ép kiểu, thêm operator |
| 4 | [Authentication & phân quyền](./04-authentication.md) | JWT, guard toàn cục, `@Public/@Roles/@AllowOwner`, các flow email |
| 5 | [Design patterns được áp dụng](./05-design-patterns.md) | Pattern nào, nằm ở đâu, vì sao, mở rộng thế nào |
| 6 | [Hướng dẫn tạo module mới](./06-new-module-guide.md) | Ví dụ từng bước: module `Product` |
| 7 | [Database & migration](./07-database.md) | Migration, seeder, BaseModel, transaction |
| 8 | [Lộ trình nâng cấp](./08-upgrade-roadmap.md) | Các hướng nâng cấp kỹ thuật tiếp theo |

## Chạy nhanh

```bash
cp .env.example .env            # sửa DB_*, JWT_SECRET (>= 32 ký tự)
docker compose up -d db         # hoặc dùng Postgres có sẵn
npm install
npm run migrate && npm run seed # tạo bảng + role + tài khoản SUPER_ADMIN
npm run start:dev
```

- API: `http://localhost:3001/v1`
- Swagger: `http://localhost:3001/v1/docs` (tắt khi `NODE_ENV=production`)
- Tài khoản seed: `admin@example.com` / `ChangeMe123` (đổi qua `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`)

## Kiểm thử

```bash
npm test          # unit test (query parser)
npm run test:e2e  # e2e cho @Crud: route, validation, role, ownership
```
