# 8. Lộ trình nâng cấp kỹ thuật

Các hạng mục chưa làm, xếp theo mức ưu tiên đề xuất. Mỗi mục ghi rõ chỗ cắm vào base hiện tại.

## Ưu tiên cao

### Rate limiting cho auth
`@nestjs/throttler` (v5 hỗ trợ Nest 10). Đăng ký `ThrottlerGuard` làm `APP_GUARD` và đặt giới hạn chặt cho `login`, `forgot-password`, `register`. Với route `@Crud`: `routes: { [CrudRoute.CreateOne]: { decorators: [Throttle({ default: { limit: 5, ttl: 60_000 } })] } }`.

### Refresh token + thu hồi token
Hiện chỉ có access token. Đề xuất: bảng `RefreshTokens` (hash token, userId, expiresAt, revokedAt), endpoint `POST /auth/refresh`, `POST /auth/logout`; access token ngắn (15 phút). Thêm `typ: 'refresh'` vào `TokenService`. Đổi mật khẩu → revoke toàn bộ refresh token của user.

### Security headers
`helmet` trong `main.ts`.

### Logging có cấu trúc + request id
`nestjs-pino` (JSON log, `x-request-id`) thay `Logger` mặc định.

## Ưu tiên trung bình

### Cache user trong `JwtAuthGuard`
Guard đang query DB mỗi request (đổi lại: thu hồi quyền có hiệu lực ngay). Khi tải lớn: cache `AuthUser` 30–60s (Redis qua `@nestjs/cache-manager`), xoá cache trong `UsersService.afterUpdate/afterRemove`.

### Filter theo quan hệ
Mở rộng `parseCrudQuery`: cho phép `filterable: ['profile.city']`, map sang `'$profile.city$'`, lấy kiểu cột từ `model.associations.profile.target.getAttributes()`, và đặt `subQuery: false` trong `findMany` khi có filter quan hệ. Chỉ an toàn với quan hệ 1-1.

### Audit (createdBy/updatedBy)
Một `AuditedCrudService` kế thừa `CrudService`, override `beforeCreate/beforeUpdate` để gán `createdById/updatedById` từ `ctx.user`.

### Domain events
`@nestjs/event-emitter`: phát `user.created`, `user.password_changed` trong hook `after*` (sau commit) → gửi mail, ghi audit… mà không làm `UsersService` phình to (Observer pattern).

### Đăng nhập Google/Facebook
Thêm lại bằng Strategy: interface `IdentityProvider { verify(idToken): Promise<{ email, emailVerified, name }> }`, mỗi provider một class, endpoint `POST /auth/oauth/:provider` nhận id token từ frontend (không cần passport session). Bảng `UserIdentities(userId, provider, subject)` thay các cờ `isGoogleUser/isFacebookUser`.

## Ưu tiên thấp / khi cần

- **Bulk endpoints** trong `@Crud` (`createMany`, `deleteMany`) — thêm `CrudRoute` mới + case trong `buildRoute`.
- **Cursor pagination** cho bảng lớn — `CrudQueryOptions.pagination: 'offset' | 'cursor'`.
- **Field selection** `?fields=id,email` — allowlist như filter.
- **Tách `core/` thành package nội bộ** dùng cho nhiều service.
- **Test tích hợp với Postgres thật** trong CI (testcontainers hoặc service `postgres` của CI).
- **OpenAPI client generation** cho frontend từ `/v1/docs-json`.
