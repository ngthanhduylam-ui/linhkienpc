# VI TÍNH PHƯỚC TÀI POS - Database

Cập nhật gần nhất: **23/06/2026**

MySQL dùng `utf8mb4`. Migration runner đọc `database/migrations/*.sql`, ghi file đã chạy vào `schema_migrations` và skip khi chạy lại.

## Bảng chính

### Auth

- `admins`: tài khoản admin, bcrypt `password_hash`.
- `admin_refresh_tokens`: refresh token hash, expiry và revoke state.

### Product

- `categories`: `code`, `name`, `description`, `is_active`.
- `products`: SKU, tên, category, mô tả, `sale_price`, trạng thái.
- `product_images`: metadata file gốc/thumbnail và `sort_order` 1-3.

`products.sale_price DECIMAL(15,0) NULL`:

- `NULL`: chưa thiết lập.
- `0`: giá hợp lệ.
- Check không âm.

### Inventory

- `product_inventory_balances`: nguồn tổng tồn hiện tại, unique theo `product_id`.
- `stock_transactions`: ledger IN/OUT; `note` là warranty/inventory group.
- `inventory_note_adjustments`: chuyển quantity giữa group, không đổi total.
- `inventory_quantity_adjustments`: tăng/giảm quantity theo group.

`inventory_quantity_adjustments.from_quantity/to_quantity` biểu diễn tồn group trước/sau thao tác. Service hiện khóa balance trước khi tính ledger để chống stale snapshot.

### Vouchers

- `stock_vouchers`: header phiếu IN/OUT, đối tác, người tạo, thời gian, `total_amount`.
- `stock_voucher_items`: snapshot dòng phiếu bán.

Các field snapshot:

```text
voucher_id
stock_transaction_id
product_id
sku_snapshot
product_name_snapshot
warranty_note_snapshot
sale_note_snapshot
quantity
unit_price
line_total
```

- `warranty_note_snapshot`: group tồn đã chọn.
- `sale_note_snapshot`: Serial/Ghi chú bán hàng, không dùng tính tồn.
- `unit_price`, `line_total`, `total_amount` nullable để tương thích giá thiếu và phiếu legacy.

### Partners

- `customers`: name, phone, address, active.
- `suppliers`: name, phone, address, active.

### Legacy

- `warranty_batches`
- `inventory_balances`

Workflow hiện tại không dùng hai bảng này làm nguồn tồn chính. Không xóa nếu chưa có migration cleanup riêng.

## Cách tính tồn theo group

Group ledger được tổng hợp từ:

1. `stock_transactions`: IN cộng, OUT trừ.
2. `inventory_quantity_adjustments`: INCREASE cộng, DECREASE trừ.
3. `inventory_note_adjustments`: trừ source, cộng destination.

Sau đó đối chiếu với `product_inventory_balances.quantity`; phần total chưa có group được đưa vào group không ghi chú. Nếu tổng group lớn hơn balance, service cảnh báo integrity.

## Public stock rule

Public search/list join `product_inventory_balances` và chỉ trả:

```sql
p.is_active = 1
AND COALESCE(pib.quantity, 0) > 0
```

Admin/POS/Inventory Check không áp dụng filter này.

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
```

## Migration 018-020

- `018`: thêm `products.sale_price`, `stock_vouchers.total_amount`, tạo `stock_voucher_items`.
- `019`: thêm `stock_voucher_items.sale_note_snapshot`.
- `020`: tạo `product_images`.

## Backup

Database:

```text
/home/vitinhphuoctai/backup_linhkienpc.sh
/home/vitinhphuoctai/backups
/home/vitinhphuoctai/backup.log
23:00 daily, retention 14 days
```

Ảnh nằm tại `/opt/linhkienpc/uploads/products` và không có trong MySQL backup. Backup ảnh sang HDD riêng hiện chưa tự động hóa.

Không chạy migration production nếu chưa backup, chưa test local hoặc chưa xác định rollback.
