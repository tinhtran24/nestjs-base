# 5. Design patterns được áp dụng

| Pattern | Ở đâu | Giải quyết vấn đề gì |
|---------|-------|----------------------|
| **Decorator** (metadata-driven) | `@Crud`, `@Public`, `@Roles`, `@AllowOwner`, `@ResponseMessage`, `@IsPassword` | Khai báo *cái gì* thay vì viết lặp *làm thế nào* |
| **Template Method** | `CrudService` (`create/update/remove/findMany`) + hook `before*/after*/scope/readOptions` | Cố định thuật toán (transaction, scope, 404, reload); module chỉ điền phần khác biệt |
| **Repository** | `SequelizeRepository<M>` | Gom truy cập dữ liệu; service dễ test với fake repository; thay ORM chỉ đụng 1 lớp |
| **Strategy + Registry** | `FilterOperators` (eq, like, in…) | Thêm operator mới không sửa parser (Open/Closed) |
| **Strategy + Factory provider** | `MailSender` ← `ConsoleMailSender` / `SmtpMailSender`, chọn trong `MailModule` theo `MAIL_DRIVER` | Đổi hạ tầng gửi mail (SES, SendGrid…) không đụng `AuthService` |
| **Chain of Responsibility** | Pipeline Nest: `JwtAuthGuard → RolesGuard → ValidationPipe → handler → ResponseInterceptor / AllExceptionsFilter` | Mỗi mắt xích lo một việc, đăng ký toàn cục một lần |
| **Adapter / Facade** | `AllExceptionsFilter` (lỗi Sequelize → HTTP), `ResponseInterceptor` (kết quả → envelope), `TokenService` (bọc `JwtService` + quy tắc `typ`) | Che chi tiết thư viện sau một API ổn định |
| **Dependency Injection / IoC** | Toàn bộ (Nest container); abstract class `MailSender` làm DI token | Giảm phụ thuộc cứng, dễ thay thế khi test |
| **Value Object** | `Paginated<T>` + `PageMeta`, `AuthUser` | Kiểu dữ liệu rõ ràng đi qua các lớp |

## Decorator — `@Crud`

Code cũ dùng hàm factory `buildBaseControllerCRUD(config)` trả về class rồi `extends` (cần `@ts-ignore`, khó override, swagger lẫn lộn). `@Crud` thay bằng class decorator: controller giữ nguyên là class thường, constructor của riêng nó, route sinh ra là method bình thường có metadata chuẩn của Nest. Chi tiết: tài liệu 2.

## Template Method — `CrudService`

```ts
// cố định
async create(dto, ctx) {
  return reload(await transaction(async (t) => {
    const values = await this.beforeCreate(dto, { ...ctx, transaction: t }); // hook
    const entity = await this.repository.create(values, { transaction: t });
    await this.afterCreate(entity, dto, { ...ctx, transaction: t });          // hook
    return entity;
  }));
}
```

Subclass **không** override `create` — chỉ override hook. Nhờ vậy mọi module đều có transaction, kiểm tra scope, xử lý 404 giống nhau.

## Strategy — FilterOperators, MailSender

Thêm cách gửi mail mới:

```ts
export class SesMailSender extends MailSender {
  async send(message: MailMessage) { /* gọi AWS SES */ }
}
// mail.module.ts
case 'ses': return new SesMailSender(...);
```

`AuthService` chỉ biết `MailSender` → không phải sửa.

## Vì sao không dùng thư viện CRUD có sẵn (`@nestjsx/crud`)?

- `@nestjsx/crud` gắn với TypeORM và không còn được bảo trì tích cực.
- Core tự viết ~850 dòng, đọc hiểu được trong 30 phút, kiểm soát hoàn toàn bảo mật (allowlist filter, ownership).

## Nguyên tắc khi mở rộng

1. Logic nghiệp vụ ở **service hook**, không ở controller.
2. Truy vấn trong hook luôn kèm `ctx.transaction`.
3. Quyền truy cập khai báo qua `access`/`routes` của `@Crud` hoặc `@Roles` — không check role thủ công trong handler.
4. Cột filter/sort phải liệt kê tường minh.
5. `core/` không import từ `modules/`.
