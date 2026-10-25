# 1. Kiến trúc tổng quan

## Cấu trúc thư mục

```
src/
├── main.ts                     # bootstrap: prefix, CORS, Swagger
├── app.module.ts               # ghép module + đăng ký pipe/filter/interceptor toàn cục
├── config/
│   ├── configuration.ts        # map env -> object có kiểu (AppConfig)
│   └── env.validation.ts       # Joi schema: thiếu/ sai env thì app không khởi động
├── database/
│   ├── database.module.ts      # SequelizeModule.forRootAsync (autoLoadModels)
│   └── base.model.ts           # BaseModel: id UUID + createdAt/updatedAt
├── core/                       # hạ tầng dùng chung, KHÔNG chứa nghiệp vụ
│   ├── auth/                   # AuthUser, @Public, @Roles, @AllowOwner, @CurrentUser
│   ├── crud/                   # @Crud, CrudService, SequelizeRepository, query parser
│   ├── http/                   # ValidationPipe, AllExceptionsFilter, ResponseInterceptor, Paginated
│   ├── mail/                   # MailSender (console | smtp)
│   └── security/               # PasswordHasher (bcrypt), @IsPassword
└── modules/                    # nghiệp vụ
    ├── auth/                   # login/register/verify/reset, TokenService, guard toàn cục
    ├── users/                  # User + Profile, CRUD qua @Crud, /users/me
    └── roles/                  # Role + UserRole, CRUD qua @Crud
```

Quy tắc phụ thuộc: `modules/* → core/*`, **không bao giờ ngược lại**. `core` không import gì từ `modules` (ngoại lệ duy nhất: không có). Nhờ vậy `core/` có thể tách thành package dùng cho dự án khác.

## Luồng một request

```
HTTP request
  → JwtAuthGuard (APP_GUARD)     bỏ qua nếu @Public; verify JWT; nạp user + roles từ DB → req.user
  → RolesGuard (APP_GUARD)       kiểm tra @Roles / @AllowOwner
  → ValidationPipe (APP_PIPE)    validate + transform body theo DTO (whitelist, forbidNonWhitelisted)
  → Controller handler           (@Crud sinh sẵn hoặc viết tay)
  → Service (CrudService)        transaction, hook, scope, repository
  → ResponseInterceptor          bọc kết quả thành envelope
  → (lỗi) AllExceptionsFilter    chuẩn hoá mọi lỗi thành JSON
```

## Response envelope

Thành công:

```json
{ "statusCode": 200, "message": "OK", "data": { ... } }
```

Danh sách (handler trả về `Paginated`):

```json
{
  "statusCode": 200, "message": "OK",
  "data": [ ... ],
  "meta": { "page": 1, "pageSize": 10, "totalItems": 42, "totalPages": 5 }
}
```

Đổi `message` cho một route: `@ResponseMessage('Password updated')`.

## Lỗi

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [{ "field": "profile.birthDate", "messages": ["..."] }],
  "path": "/v1/users/me",
  "timestamp": "2026-10-24T11:00:00.000Z"
}
```

`AllExceptionsFilter` map lỗi DB sang mã HTTP hợp lý:

| Lỗi | HTTP |
|-----|------|
| `HttpException` (Nest) | giữ nguyên |
| `UniqueConstraintError` | 409 + field bị trùng |
| `ForeignKeyConstraintError` | 409 |
| `ValidationError` (Sequelize) | 400 |
| Khác | 500 `Internal server error` (log stack, **không** trả SQL/stack cho client) |

Service chỉ cần `throw new NotFoundException(...)` / `ForbiddenException(...)` — không bọc `try/catch` rồi ném lại `HttpException` như code cũ.

## Cấu hình

Đọc config qua `ConfigService<AppConfig, true>` để có kiểu:

```ts
const jwt = this.config.get('jwt', { infer: true }); // { secret, expiresIn, actionExpiresIn }
```

Thêm biến môi trường mới = thêm vào cả `env.validation.ts` (Joi) và `configuration.ts`.
