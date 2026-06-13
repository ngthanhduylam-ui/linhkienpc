# Backend README

Backend của **VI TÍNH PHƯỚC TÀI POS** là Express API phục vụ admin inventory/POS và public lookup.

## 1. Stack

- Node.js >= 18
- Express
- MySQL
- JWT auth
- bcrypt
- dotenv

## 2. Cài đặt local

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Cập nhật `backend/.env` theo MySQL local.

Tạo database:

```sql
CREATE DATABASE linhkienpc CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Setup schema + seed:

```powershell
npm run db:setup
```

Chạy dev:

```powershell
npm run dev
```

Chạy production:

```powershell
npm start
```

## 3. Scripts

```text
npm start       chạy server thường
npm run dev     chạy nodemon
npm run migrate chạy migrations
npm run seed    seed dữ liệu ban đầu
npm run db:setup migrate + seed
```

## 4. API chính

Base URL:

```text
/api/v1
```

Public:

```text
GET /health
GET /public/products
GET /public/products/:sku/inventory
GET /public/categories
```

Admin:

```text
/admin/auth/*
/admin/products/*
/admin/categories/*
/admin/customers/*
/admin/suppliers/*
/admin/stock-in
/admin/stock-in/bulk
/admin/stock-out
/admin/stock-out/bulk
/admin/inventory-check/*
/admin/stock-vouchers/*
```

Xem chi tiết tại `docs/API.md`.

## 5. Database

Schema tổng hợp:

```text
database/schema/schema.sql
```

Migrations:

```text
database/migrations/
```

Nguồn tồn hiện tại:

```text
product_inventory_balances
```

Lịch sử nhập/xuất:

```text
stock_transactions
stock_vouchers
```

## 6. Quy tắc scope

Backend hiện không triển khai:

- price/pricing,
- payment,
- debt/công nợ,
- invoice,
- accounting/reporting,
- search tags/aliases/compatibility.

Không thêm các phần này nếu chưa có phase riêng.

## 7. Secrets

Không commit:

- `backend/.env`
- file backup database
- JWT secret thật
- mật khẩu MySQL/server

Chỉ commit `.env.example` nếu cần cập nhật biến mẫu.
