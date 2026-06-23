# VI TÍNH PHƯỚC TÀI POS - Backend

Cập nhật gần nhất: **23/06/2026**

Express API cho admin POS/inventory và Public Lookup.

## Stack

- Node.js 18+
- Express 4
- MySQL via `mysql2`
- JWT, bcrypt
- `express-rate-limit`
- Multer và Sharp cho product images

## Local setup

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run db:setup
npm run dev
```

Scripts:

```text
npm start
npm run dev
npm run migrate
npm run seed
npm run db:setup
```

`db:setup` phù hợp local mới. Production dùng migration runner và không seed tùy tiện.

## API

Base:

```text
/api/v1
```

Public:

```text
GET /health
GET /public/products
GET /public/products/:sku/inventory
GET /public/products/:sku/images
GET /public/categories
```

Protected admin modules:

```text
auth
categories
products/images
customers
suppliers
stock-in/out
inventory-check
stock-vouchers
inventory
```

Xem [API](../docs/api.md).

## Database

- Migration table: `schema_migrations`.
- Current migrations: `001` đến `020`.
- Total stock: `product_inventory_balances`.
- Group ledger: stock transactions + note adjustments + quantity adjustments.
- Voucher snapshots: `stock_vouchers`, `stock_voucher_items`.

Xem [Database](../docs/database.md).

## Product images

Default local:

```env
PRODUCT_UPLOAD_ROOT=./uploads/products
PRODUCT_IMAGE_MAX_BYTES=15728640
PRODUCT_IMAGE_MAX_COUNT=3
```

Production:

```text
/opt/linhkienpc/uploads/products
```

Filesystem giữ originals/thumbnails; MySQL chỉ giữ metadata.

## Security

- `HOST` mặc định `127.0.0.1`.
- Production PM2 process: `linhkienpc-api`.
- `trust proxy` chỉ tin loopback.
- Admin login rate limit 10 request/15 phút/IP.
- `DEFAULT_ADMIN_PASSWORD` chỉ lấy từ environment.
- Seed không reset admin đã tồn tại.
- Nếu chưa có admin và thiếu password, seed báo lỗi.
- Không log hoặc commit secret.

## Business boundaries

Backend hiện có giá bán mặc định và snapshot tiền phiếu bán, nhưng chưa có:

- giá nhập;
- discount;
- payment/debt;
- invoice/accounting/reporting;
- giá theo warranty group.

Next task về discount VND theo dòng phải có thiết kế API/schema riêng; không tự thêm field trước khi được duyệt.
