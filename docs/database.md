# VI TÍNH PHƯỚC TÀI POS - Database Notes

Cập nhật gần nhất: **26/06/2026**

MySQL dùng `utf8mb4`. Migration runner đọc `database/migrations/*.sql`, ghi file đã chạy vào `schema_migrations` và skip khi chạy lại.

## Core tables

- `admins`: tài khoản admin, bcrypt `password_hash`.
- `admin_refresh_tokens`: refresh token hash, expiry và revoke state.
- `categories`: loại sản phẩm.
- `products`: SKU, tên, category, mô tả, `sale_price`, trạng thái.
- `product_images`: metadata ảnh; file nằm trên filesystem.
- `customers`, `suppliers`.
- `product_inventory_balances`: nguồn tổng tồn hiện tại.
- `stock_transactions`: ledger IN/OUT; `note` là warranty/inventory group.
- `inventory_note_adjustments`: chuyển quantity giữa group, không đổi total.
- `inventory_quantity_adjustments`: tăng/giảm quantity theo group.
- `stock_vouchers`: header phiếu IN/OUT, đối tác, người tạo, thời gian, `total_amount`.
- `stock_voucher_items`: snapshot dòng phiếu bán.

## Price rules

`products.sale_price DECIMAL(15,0) NULL`:

- `NULL`: chưa thiết lập giá tham chiếu.
- `0`: giá tham chiếu hợp lệ.
- dương: giá tham chiếu VND.

Money columns use `DECIMAL(15,0)`, maximum supported value `999999999999999`.

## POS voucher snapshots

`stock_voucher_items` includes:

```text
voucher_id
product_id
sku_snapshot
name_snapshot
warranty_note_snapshot
sale_note_snapshot
quantity
reference_unit_price
discount_amount
unit_price
line_total
```

Rules:

- `reference_unit_price` snapshots `products.sale_price`; can be `NULL`.
- `discount_amount` is fixed VND discount per unit; default `0`.
- `unit_price` is final selling price per unit; can be `NULL` when no configured price and no manual price.
- `line_total` can be `NULL` for optional-price sales without known line total.
- `stock_vouchers.total_amount` is `NULL` if any line total is `NULL`.
- Legacy vouchers may have missing snapshots and must remain readable.

## Inventory note groups

Group availability is derived from:

1. `stock_transactions`;
2. `inventory_quantity_adjustments`;
3. `inventory_note_adjustments`.

Previous note-group discrepancy was fixed and should not be treated as active backlog.

## Public Lookup stock filter

Public search/list join `product_inventory_balances` and only return:

```text
products.is_active = 1
product_inventory_balances.quantity > 0
```

Admin/POS/Inventory Check do not apply this public zero-stock hiding rule.

## Migrations hiện có

```text
001_create_admins.sql
002_create_categories.sql
003_create_products.sql
004_create_warranty_batches.sql
005_create_inventory_balances.sql
006_create_stock_transactions.sql
007_create_admin_refresh_tokens.sql
008_create_product_inventory_balances.sql
009_alter_stock_transactions_warranty_batch_nullable.sql
010_ensure_product_inventory_balances.sql
011_create_customers.sql
012_alter_stock_transactions_add_customer_id.sql
013_create_suppliers.sql
014_alter_stock_transactions_add_supplier_id.sql
015_create_inventory_note_adjustments.sql
016_create_stock_voucher_history.sql
017_create_inventory_quantity_adjustments.sql
018_add_phase_2a_sale_price_snapshot_schema.sql
019_add_sale_note_snapshot_to_stock_voucher_items.sql
020_create_product_images.sql
021_add_pos_line_discount_snapshots.sql
```

Important recent migrations:

- `018`: thêm `products.sale_price`, `stock_vouchers.total_amount`, tạo `stock_voucher_items`.
- `019`: thêm `stock_voucher_items.sale_note_snapshot`.
- `020`: tạo `product_images`.
- `021`: thêm `reference_unit_price`, `discount_amount` và backfill reference price từ legacy `unit_price`.

## Backup

Production backup currently targets a separate Samsung SSD:

- database backup;
- uploads backup;
- backend configuration backup;
- manifest;
- SHA256 checksums;
- restore guide;
- 30-day retention;
- cron at 23:00.

Không chạy migration production nếu chưa backup, chưa test local hoặc chưa xác định rollback.
