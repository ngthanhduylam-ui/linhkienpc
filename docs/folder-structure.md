# Cấu trúc thư mục - LINHKIENPC

```text
linhkienpc/
├─ frontend/                  # React app (React Router)
├─ backend/                   # Node.js Express API
├─ database/                  # SQL schema, migration, seed
├─ docs/                      # Tài liệu yêu cầu, DB, API, triển khai
├─ backups/                   # Nơi lưu backup dữ liệu
└─ PROJECT_RULES.md           # Quy tắc bất biến của dự án
```

## Gợi ý chi tiết (chưa tạo code)
- `frontend/src/pages/`:
  - `PublicInventoryPage` cho route `/`
  - Nhóm trang admin dưới `/admin/*`
- `backend/src/modules/`:
  - `auth`, `products`, `batches`, `inventory`, `transactions`
- `database/`:
  - `schema.sql`, `migrations/`, `seeds/`

## Nguyên tắc route
- Public: `/`
- Admin: `/admin/*`
