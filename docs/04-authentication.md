# 4. Authentication & phân quyền

## Mô hình dữ liệu

```
Users ──1:1── Profiles
  │
  └──N:M── Roles   (qua bảng UserRoles, unique(userId, roleId))
```

- `User`: `email` (unique, lưu lowercase), `password` (bcrypt), `firstName`, `lastName`, `isActive`, `isVerified`, `lastLoginAt`.
- `password` **không bao giờ** được select mặc định (`@DefaultScope` loại trừ) và `toJSON()` luôn xoá nó. Cần hash thì dùng scope `withPassword` (chỉ trong `UsersService.findBy*WithPassword`).
- Role mặc định: `SUPER_ADMIN`, `ADMIN`, `USER` (`RoleType`). Role là bảng dữ liệu → tạo role mới qua `POST /roles` (SUPER_ADMIN). Role built-in không đổi tên/xoá được.

## Endpoint

| Method | Path | Public | Mô tả |
|--------|------|:-:|-------|
| POST | `/auth/register` | ✓ | Tạo tài khoản (role `USER`), gửi mail xác thực |
| POST | `/auth/verify-email` | ✓ | `{ token }` |
| POST | `/auth/resend-verification` | ✓ | `{ email }` — luôn trả 200 |
| POST | `/auth/login` | ✓ | `{ email, password }` → `{ accessToken, tokenType, expiresIn, user }` |
| POST | `/auth/forgot-password` | ✓ | `{ email }` — luôn trả 200 (không lộ email có tồn tại) |
| POST | `/auth/reset-password` | ✓ | `{ token, password }` |
| GET | `/auth/me` | | User hiện tại (kèm roles, profile) |
| PATCH | `/auth/change-password` | | `{ currentPassword, newPassword }` |
| GET/PATCH | `/users/me` | | Xem / sửa tên + profile của mình |

Gửi token: header `Authorization: Bearer <accessToken>`.

Mật khẩu: 8–72 ký tự, ít nhất 1 chữ và 1 số (`@IsPassword()`; 72 là giới hạn byte của bcrypt).

## Token: một secret, nhiều mục đích

`TokenService` ký JWT (HS256) với claim `typ`:

| `typ` | Hạn | Dùng cho |
|-------|-----|----------|
| `access` | `JWT_EXPIRES_IN` | gọi API |
| `verify-email` | `JWT_ACTION_EXPIRES_IN` | link xác thực email |
| `reset-password` | `JWT_ACTION_EXPIRES_IN` | link đặt lại mật khẩu |

`verify(token, purpose)` kiểm tra **chữ ký + hạn + `typ`**. Token xác thực email không thể dùng làm access token và ngược lại.

Token reset mang `pwd` = fingerprint (SHA-256 rút gọn) của hash mật khẩu hiện tại → sau khi đặt lại mật khẩu, fingerprint đổi và **token cũ vô hiệu** (dùng một lần).

## Guard toàn cục

Đăng ký trong `AuthModule` bằng `APP_GUARD` theo thứ tự:

1. **`JwtAuthGuard`** — mọi route **mặc định cần đăng nhập** (secure by default). Bỏ qua khi có `@Public()`. Verify token, rồi nạp lại user từ DB (`isActive = true`) kèm roles → `req.user: AuthUser`. Vô hiệu hoá / xoá user hay đổi role có hiệu lực **ngay**, không chờ token hết hạn.
2. **`RolesGuard`** — đọc `@Roles(...)` (method ưu tiên hơn class). Không có `@Roles` → cho qua. Có `@AllowOwner()` → cho qua, service tự giới hạn theo owner.

## Decorator

```ts
@Public()                          // bỏ xác thực (route hoặc cả controller)
@Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)  // cần 1 trong các role
@AllowOwner()                      // dùng chung với @Roles: không có role thì chỉ thấy row của mình
@CurrentUser() user: AuthUser      // { id, email, roles }
```

Với controller `@Crud`, khai báo quyền qua `access` / `routes` thay vì gắn tay (xem tài liệu 2).

## Các biện pháp bảo vệ đã có

- So sánh mật khẩu với hash giả khi email không tồn tại → thời gian phản hồi như nhau, khó dò email.
- `forgot-password`, `resend-verification` luôn trả cùng một câu trả lời.
- Chỉ `SUPER_ADMIN` được gán role `SUPER_ADMIN`; `ADMIN` không sửa/xoá được tài khoản `SUPER_ADMIN`; không tự xoá chính mình qua `DELETE /users/:id`.
- `/users/me` dùng `UpdateMeDto` (chỉ `firstName`, `lastName`, `profile`) — gửi `roles`/`isActive` sẽ bị `400` (forbidNonWhitelisted).
- Validation toàn cục `whitelist + forbidNonWhitelisted` → không mass-assignment.
- `JWT_SECRET` bắt buộc ≥ 32 ký tự (Joi).

## Cấu hình liên quan

```
JWT_SECRET=...                     # >= 32 ký tự
JWT_EXPIRES_IN=1d
JWT_ACTION_EXPIRES_IN=1h
AUTH_REQUIRE_EMAIL_VERIFICATION=true   # false: tài khoản đăng ký được verify luôn
FRONTEND_URL=http://localhost:3000     # link trong email: {FRONTEND_URL}/verify-email?token=..., /reset-password?token=...
MAIL_DRIVER=console                    # console (in mail ra log) | smtp
```

Frontend nhận `token` từ query string rồi gọi `POST /auth/verify-email` hoặc `POST /auth/reset-password`.

## Đã loại bỏ so với code cũ

- Đăng nhập Google/Facebook (passport + express-session). Muốn thêm lại: xem `08-upgrade-roadmap.md` (Strategy cho identity provider).
- Lỗi bảo mật cũ đã sửa: login **không kiểm tra mật khẩu** (`isCorrectPassword = true`), và guard dùng `jwtService.decode` (không verify chữ ký → token giả mạo được chấp nhận).
