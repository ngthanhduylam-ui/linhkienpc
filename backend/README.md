# VI TÍNH PHƯỚC TÀI POS - Backend

Express API cho admin POS/inventory và Public Lookup.

## Runtime

- Node.js / Express.
- MySQL.
- JWT access token + refresh token hash.
- File uploads for product images.

## Local

```bash
npm install
npm run dev
```

Database setup for a fresh local environment:

```bash
npm run db:setup
npm run migrate
```

`db:setup` phù hợp local mới. Production dùng migration runner và không seed tùy tiện.

## Main modules

- auth;
- category;
- product;
- customer;
- supplier;
- stock-in/out;
- inventory-check;
- stock-vouchers;
- inventory;
- public lookup.

## Database

- Migration table: `schema_migrations`.
- Current migrations: `001` đến `022`.
- Total stock: `product_inventory_balances`.
- Group ledger: stock transactions + note adjustments + quantity adjustments.
- Voucher snapshots: `stock_vouchers`, `stock_voucher_items`.

See `docs/DATABASE.md`.

## Product images

Default local:

```env
PRODUCT_UPLOAD_ROOT=./uploads/products
PRODUCT_IMAGE_MAX_BYTES=15728640
PRODUCT_IMAGE_MAX_COUNT=5
```

Production upload root:

```text
/opt/linhkienpc/uploads/products
```

Filesystem giữ originals/thumbnails; MySQL chỉ giữ metadata.

## POS pricing behavior

Backend is the source of truth for stock-out pricing:

- reads `products.sale_price`;
- distinguishes `sale_price = NULL` from `sale_price = 0`;
- allows sales with no configured price and no manual price;
- accepts `manual_unit_price` only when no reference price exists;
- validates `discount_amount` as fixed VND per unit;
- calculates `unit_price`, `line_total` and `total_amount`;
- stores `reference_unit_price`, `discount_amount`, `unit_price`, `line_total`.

Client request must not send backend-calculated fields:

- `reference_unit_price`;
- `final_unit_price`;
- `unit_price`;
- `line_total`;
- `total_amount`.

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

Backend hiện có sale price tham chiếu, optional POS pricing và fixed VND discount snapshots. Chưa có:

- giá nhập / cost price;
- payment/debt;
- invoice/accounting/reporting;
- order-wide discount;
- giá theo warranty group.

POS draft persistence was attempted in `3dd615e` and reverted by `f736ca2`; do not treat it as implemented.
