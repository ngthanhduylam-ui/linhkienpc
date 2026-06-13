# DATABASE.md

Database hiện dùng MySQL với charset/collation `utf8mb4`. Schema tổng hợp nằm tại:

```text
database/schema/schema.sql
```

Migration nằm tại:

```text
database/migrations/
```

## 1. Nhóm bảng auth

### `admins`

Lưu tài khoản admin.

Trường chính:

- `username` unique.
- `password_hash` dùng bcrypt.
- `display_name`.
- `is_active`.

### `admin_refresh_tokens`

Lưu refresh token đã hash.

Trường chính:

- `admin_id`.
- `token_hash`.
- `expires_at`.
- `revoked_at`.

Không lưu refresh token gốc trong database.

## 2. Nhóm sản phẩm

### `categories`

Lưu loại sản phẩm.

Backend/database gọi là `category`, UI gọi là “Loại sản phẩm”.

Trường chính:

- `code` unique.
- `name` unique.
- `description`.
- `is_active`.

### `products`

Lưu model sản phẩm.

Trường chính:

- `sku` unique.
- `name`.
- `category_id`.
- `spec_summary`.
- `is_active`.

Quy tắc SKU hiện tại:

- chữ thường,
- số,
- dấu chấm,
- không dấu cách/dấu gạch ngang/ký tự đặc biệt.

## 3. Nhóm tồn kho

### `product_inventory_balances`

Nguồn tồn chính hiện tại.

Trường chính:

- `product_id` unique.
- `quantity`.
- `updated_at`.

Quy tắc:

- Không chỉnh trực tiếp từ UI.
- Chỉ thay đổi qua nhập hàng, bán/xuất hàng, kiểm hàng/điều chỉnh tồn.

### `stock_transactions`

Sổ giao dịch nhập/xuất.

Trường chính:

- `txn_type`: `IN` hoặc `OUT`.
- `product_id`.
- `quantity`.
- `note`: nhóm bảo hành/ghi chú hiện tại.
- `customer_id` nullable.
- `supplier_id` nullable.
- `voucher_id` nullable/linked với phiếu.
- `created_by_admin_id`.
- `occurred_at`.

`note` là nguồn chính để tính nhóm bảo hành/ghi chú trong POS/public lookup.

### `stock_vouchers`

Nhóm các dòng `stock_transactions` thành phiếu nhập hoặc phiếu bán.

Dùng cho:

- transaction history list,
- detail phiếu,
- kiểm tra sản phẩm/số lượng trong phiếu.

Không phải invoice và không chứa payment/debt logic.

## 4. Nhóm đối tác

### `customers`

Trường thực tế đang dùng:

- `name`.
- `phone`.
- `address`.
- `is_active`.

Được dùng trong POS/stock-out nếu chọn khách hàng.

### `suppliers`

Trường thực tế đang dùng:

- `name`.
- `phone`.
- `address`.
- `is_active`.

Được dùng trong stock-in nếu chọn nhà cung cấp.

## 5. Nhóm kiểm hàng

### `inventory_note_adjustments`

Ghi nhận thao tác chuyển tồn giữa các nhóm ghi chú/bảo hành.

### `inventory_quantity_adjustments`

Ghi nhận thao tác tăng/giảm tồn khi kiểm hàng.

Các bảng này hỗ trợ màn `/admin/inventory-check`.

## 6. Bảng legacy

### `warranty_batches`

Module lô bảo hành cũ. Hiện không phải workflow chính của POS/stock-in.

### `inventory_balances`

Bảng tồn theo warranty batch từ kiến trúc cũ. Workflow hiện tại dùng `product_inventory_balances`.

Không xóa các bảng legacy nếu chưa có migration/phase dọn riêng.

## 7. Migrations hiện có

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
```

## 8. Backup/restore

Trước khi deploy hoặc chạy migration trên server thật, luôn backup MySQL.

Ví dụ backup server đã từng được tạo:

```text
~/backups/linhkienpc_before_codex_20260611_1546.sql
```

Không commit file backup chứa dữ liệu thật vào repo.

## 9. Những bảng/chức năng chưa có

Chưa có schema cho:

- giá bán/giá nhập,
- thanh toán,
- công nợ,
- hóa đơn,
- kế toán,
- báo cáo tài chính,
- tags/aliases/compatibility search.

Không document hoặc code UI như thể các phần này đã tồn tại.
