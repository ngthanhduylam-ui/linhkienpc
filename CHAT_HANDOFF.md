# CHAT HANDOFF - VI TÍNH PHƯỚC TÀI POS

Cập nhật gần nhất: **26/06/2026**

Tài liệu này dùng để mở chat Codex mới. Khi nội dung mâu thuẫn, ưu tiên code, migrations, routes, Git history và `git status` hiện tại.

## Current production baseline

```text
Branch:        codex-dev
Stable commit: f736ca2 Revert "feat: persist unfinished POS order drafts"
```

Production currently tested stable after reverting POS draft persistence.

Do not expose `.env`, passwords, tokens, database credentials or secret backup contents.

## Current product direction

```text
POS First
Self-Hosted
Sapo-inspired workflow
Stability First
Not an ERP
```

Priority: stable shop-counter selling, correct inventory, public lookup, voucher snapshots, product images, backups and security. Financial/accounting work is deferred.

## Production environment

```text
Domain:           https://vitinhphuoctai.duckdns.org
Repo:             /opt/linhkienpc/linhkienpc
Branch:           codex-dev
Frontend:         Nginx
Backend:          PM2 process linhkienpc-api
Backend bind:     127.0.0.1:3000
Database:         MySQL localhost
Product uploads:  /opt/linhkienpc/uploads/products
```

Do not access production/SSH unless the user explicitly asks.

## Completed features

- Admin login, refresh flow and login rate limit.
- Public Lookup, no login.
- Public Lookup hides zero-stock products.
- Product Admin add/edit/list/search/filter.
- Product category rename.
- Safe deletion of unused categories.
- Product images, maximum 3 images.
- Multi-token AND product search.
- Bulk stock-in.
- POS full-screen `/admin/stock-out`.
- Product/customer search in POS.
- Multi-order POS tabs, currently in-memory only.
- Optional POS pricing: products with no configured `sale_price` can still be sold.
- Per-line fixed VND discount snapshots.
- Sale note/serial note per POS line.
- Voucher history/list/detail.
- Voucher detail responsive layout.
- Existing voucher print page; further print work paused.
- Inventory note-group discrepancy fixed.
- Production backup to separate Samsung SSD:
  - daily database backup;
  - uploads backup;
  - backend configuration backup;
  - manifest;
  - SHA256 checksums;
  - restore guide;
  - 30-day retention;
  - cron at 23:00.

## Important rollback

Do not treat POS draft persistence as implemented.

```text
3dd615e feat: persist unfinished POS order drafts
f736ca2 Revert "feat: persist unfinished POS order drafts"
```

Current behavior:

- unfinished POS tabs are not persisted across F5/browser restart;
- this feature was attempted and reverted after production verification failed;
- future reimplementation requires simpler design and full browser testing for:
  - closing one tab;
  - selling one tab;
  - preserving sibling tabs;
  - refreshing immediately afterward;
  - browser restart.

## Key routes

Frontend:

```text
/
/admin/login
/admin/products
/admin/products/new
/admin/products/:id/edit
/admin/stock-in
/admin/stock-out
/admin/inventory-check
/admin/customers
/admin/customers/:id
/admin/suppliers
/admin/transaction-history
/admin/transaction-history/:voucherId
/admin/transaction-history/:voucherId/print
```

Important Admin API:

```text
POST /api/v1/admin/auth/login
GET  /api/v1/admin/products
GET  /api/v1/admin/categories
PATCH /api/v1/admin/categories/:id
DELETE /api/v1/admin/categories/:id
POST /api/v1/admin/stock-in/bulk
POST /api/v1/admin/stock-out/bulk
GET  /api/v1/admin/inventory-check/products/:sku
POST /api/v1/admin/inventory-check/note-move
POST /api/v1/admin/inventory-check/quantity-adjust
GET  /api/v1/admin/stock-vouchers
GET  /api/v1/admin/stock-vouchers/:id
GET  /api/v1/public/products
GET  /api/v1/public/products/:sku/inventory
```

## Current database/migration highlights

Current migrations: `001` through `021`.

Recent important migrations:

- `018_add_phase_2a_sale_price_snapshot_schema.sql`
  - `products.sale_price`;
  - `stock_vouchers.total_amount`;
  - creates `stock_voucher_items`.
- `019_add_sale_note_snapshot_to_stock_voucher_items.sql`
  - `stock_voucher_items.sale_note_snapshot`.
- `020_create_product_images.sql`
  - product image metadata.
- `021_add_pos_line_discount_snapshots.sql`
  - `stock_voucher_items.reference_unit_price`;
  - `stock_voucher_items.discount_amount`;
  - backfills legacy reference price from `unit_price`.

## POS pricing rules

- `sale_price = NULL`: no configured reference price; sale is allowed.
- Manual unit price is optional for no-reference-price products.
- If no reference price and no manual price, line money snapshots can be `NULL`.
- `sale_price = 0`: valid configured reference price.
- `discount_amount`: fixed VND discount per unit.
- Backend calculates final unit price, line total and voucher total.
- Frontend must not send `reference_unit_price`, `final_unit_price`, `unit_price`, `line_total` or `total_amount`.

## Print status

Print work is paused.

Current agreed direction for future review:

- title: `Phiếu bán & giao hàng`;
- A4 and A5 support;
- dynamic product rows;
- long text wraps automatically;
- no separate SKU/code column;
- signatures: `Người bán` and `Khách hàng`;
- print requirements must be reviewed again before implementation.

## Deferred

- Customer payment/debt.
- Supplier debt.
- Cost price / giá vốn.
- Financial/accounting reports.
- Order-wide discount.
- Advanced invoice/accounting work.
- Print redesign/implementation.
- ERP workflow.

## Standard local verification

```bash
git branch --show-current
git status --short
git log -1 --oneline
cd frontend
npm run build
cd ..
git diff --check
```

Only run migrations or production operations when the user explicitly requests them.
