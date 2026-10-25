# 3. Query: phân trang, sort, filter

Áp dụng cho mọi route `getMany` sinh bởi `@Crud`. Code: `src/core/crud/query/`.

## Phân trang

| Param | Mặc định | Ràng buộc |
|-------|----------|-----------|
| `page` | 1 | số nguyên ≥ 1 |
| `pageSize` | 10 (`query.defaultPageSize`) | 1 … `query.maxPageSize` (mặc định 100) |

## Sort

```
?sort=createdAt:desc
?sort=lastName:asc,createdAt:desc
?sort=email            # hướng mặc định asc
```

Chỉ cột trong `sortable` được phép. `sortable` = `query.sortable` ∪ `query.filterable` ∪ `createdAt`. Mặc định: `query.defaultSort` hoặc `['createdAt','DESC']`.

## Filter

Cú pháp: `?<field>=<value>` (bằng) hoặc `?<field>.<operator>=<value>`.

| Operator | Ý nghĩa | Ví dụ |
|----------|---------|-------|
| `eq` (mặc định) | = | `?isActive=true`, `?email.eq=a@b.io` |
| `ne` | ≠ | `?status.ne=DRAFT` |
| `gt`, `gte`, `lt`, `lte` | so sánh | `?price.gte=10&price.lt=100` |
| `like` | chứa, **không phân biệt hoa thường** (`ILIKE '%v%'`, đã escape `%` `_`) | `?email.like=example` |
| `in`, `nin` | trong / ngoài danh sách (phân tách bởi dấu phẩy) | `?status.in=A,B` |
| `isnull` | `true` → IS NULL, `false` → IS NOT NULL | `?deletedAt.isnull=true` |

Nhiều operator trên cùng field được AND: `?age.gte=18&age.lt=30`.

### Bảo mật: allowlist

Chỉ cột trong `query.filterable` được filter. **Mặc định không cho filter cột nào.** Lý do: nếu cho filter mọi cột, client có thể dò `?password.like=$2a$10$...` từng ký tự. Cột không hợp lệ → `400` kèm danh sách cột hợp lệ.

### Ép kiểu theo kiểu cột

Giá trị được convert theo kiểu khai báo trong model (`model.getAttributes()`), không đoán theo hình dạng chuỗi:

| Kiểu cột | Xử lý | Sai định dạng |
|----------|-------|---------------|
| INTEGER, FLOAT, DECIMAL, … | `Number()` | 400 |
| BOOLEAN | `true/false/1/0` | 400 |
| DATE, DATEONLY | `new Date()` (ISO) | 400 |
| UUID | kiểm tra regex | 400 (tránh lỗi 500 từ Postgres) |
| STRING, TEXT, … | giữ nguyên | — |

Ví dụ: `?phone=0123` vẫn là chuỗi `'0123'` (code cũ biến thành số `123`).

## Thêm operator mới (Strategy registry)

```ts
// ví dụ trong main.ts hoặc một file được import khi bootstrap
import { Op } from 'sequelize';
import { FilterOperators } from './core/crud';

FilterOperators.register({
  name: 'startswith',
  build: (value) => ({ [Op.iLike]: `${value}%` }),
});
// => ?name.startswith=Jo
```

Thuộc tính của một operator:

```ts
interface FilterOperator {
  name: string;
  multi?: boolean;   // giá trị là danh sách "a,b,c" → mảng đã ép kiểu từng phần tử
  flag?: boolean;    // giá trị là true/false (không ép theo kiểu cột), như isnull
  build(value): WhereOperators;
}
```

Swagger tự liệt kê operator đã đăng ký trong mô tả từng query param.

## Giới hạn hiện tại

- Chưa filter theo cột của bảng quan hệ (vd `profile.city`). Hướng mở rộng: dùng cú pháp `$profile.city$` của Sequelize cho quan hệ 1-1 (HasOne/BelongsTo) kèm `subQuery: false`; xem `08-upgrade-roadmap.md`.
- `like` dùng `ILIKE` → riêng PostgreSQL.
