# Database

Database dùng MySQL, charset `utf8mb4`, collation `utf8mb4_unicode_ci`.

Schema chính được khai báo trong `database/schema/*.sql`. Migration nằm trong `database/migrations`.

## Bảng admins

Lưu tài khoản admin.

Trường quan trọng:

- `id`: khóa chính.
- `username`: unique.
- `password_hash`: mật khẩu đã hash bằng bcrypt.
- `display_name`: tên hiển thị.
- `is_active`: admin inactive không được login.
- `created_at`, `updated_at`: timestamp server/database.

Quan hệ:

- `admin_refresh_tokens.admin_id` tham chiếu `admins.id`.
- `stock_transactions.created_by_admin_id` tham chiếu `admins.id`.

## Bảng admin_refresh_tokens

Lưu refresh token đã hash.

Trường quan trọng:

- `admin_id`: admin sở hữu token.
- `token_hash`: SHA-256 hash của refresh token, không lưu token gốc.
- `expires_at`: thời điểm hết hạn.
- `revoked_at`: thời điểm thu hồi token.

## Bảng categories

Lưu danh mục sản phẩm.

Trường quan trọng:

- `id`: khóa chính.
- `code`: mã danh mục, unique.
- `name`: tên danh mục, unique.
- `description`: mô tả.
- `is_active`: soft delete/deactivate.

Quan hệ:

- `products.category_id` tham chiếu `categories.id`.

Lưu ý hiện tại: backend vẫn yêu cầu `code` khi tạo category. Frontend tạo code tự động từ tên category khi cần.

## Bảng products

Lưu model sản phẩm.

Trường quan trọng:

- `id`: khóa chính nội bộ.
- `sku`: mã model sản phẩm, unique, ví dụ `cpu.intel.12400f`.
- `name`: tên sản phẩm.
- `category_id`: danh mục.
- `spec_summary`: mô tả/spec ngắn.
- `is_active`: sản phẩm inactive không hiện trong public search và list mặc định.
- `created_at`, `updated_at`.

Index:

- Unique `sku`.
- Index `name`.
- Fulltext index `ft_products_name` trên `name` nếu MySQL hỗ trợ.

Quan hệ:

- Một product thuộc một category.
- Một product có một dòng tồn trong `product_inventory_balances`.
- Một product có nhiều `stock_transactions`.

## Bảng product_inventory_balances

Đây là bảng tồn kho chính hiện tại.

Trường quan trọng:

- `product_id`: unique, tham chiếu `products.id`.
- `quantity`: tổng tồn hiện tại theo sản phẩm.
- `updated_at`: thời điểm cập nhật tồn.

Quy tắc:

- Không chỉnh trực tiếp từ UI.
- Chỉ thay đổi qua stock-in hoặc stock-out.
- Stock operation chạy trong database transaction.

## Bảng stock_transactions

Lưu lịch sử nhập/xuất kho.

Trường quan trọng:

- `txn_type`: `IN` hoặc `OUT`.
- `product_id`: sản phẩm.
- `warranty_batch_id`: nullable, còn lại từ module cũ.
- `customer_id`: nullable, đang dùng cho stock-out nếu chọn khách hàng.
- `supplier_id`: nullable, đang dùng cho stock-in nếu chọn nhà cung cấp.
- `quantity`: số lượng giao dịch.
- `note`: ghi chú giao dịch; cũng là nguồn dữ liệu nhóm bảo hành hiện tại.
- `created_by_admin_id`: admin tạo giao dịch.
- `occurred_at`: timestamp server/database.

Quan hệ:

- `product_id` -> `products.id`.
- `customer_id` -> `customers.id`.
- `supplier_id` -> `suppliers.id`.
- `warranty_batch_id` -> `warranty_batches.id` nếu có.
- `created_by_admin_id` -> `admins.id`.

## Bảng customers

Lưu khách hàng/contact.

Trường quan trọng:

- `id`: khóa chính.
- `name`: tên khách hàng.
- `phone`: số điện thoại.
- `address`: địa chỉ.
- `is_active`: chỉ list customer active.
- `created_at`, `updated_at`.

Quan hệ:

- `stock_transactions.customer_id` tham chiếu `customers.id`.

## Bảng suppliers

Lưu nhà cung cấp/contact.

Trường quan trọng:

- `id`: khóa chính.
- `name`: tên nhà cung cấp.
- `phone`: số điện thoại.
- `address`: địa chỉ.
- `is_active`: chỉ list supplier active.
- `created_at`, `updated_at`.

Quan hệ:

- `stock_transactions.supplier_id` tham chiếu `suppliers.id`.

## Bảng warranty_batches

Module lô bảo hành cũ vẫn tồn tại trong backend/database.

Trường quan trọng:

- `product_id`: sản phẩm.
- `batch_code`: mã lô bảo hành.
- `warranty_end_month`, `warranty_end_year`.
- `is_active`.

Lưu ý nghiệp vụ hiện tại:

- UI tồn kho hiện tại không dùng warranty batch làm đơn vị nhập/xuất.
- Ghi chú bảo hành hiện tại lấy từ `stock_transactions.note`.

## Bảng inventory_balances

Bảng tồn kho theo warranty batch từ kiến trúc cũ.

Trường quan trọng:

- `product_id`.
- `warranty_batch_id`.
- `quantity`.

Lưu ý nghiệp vụ hiện tại:

- Workflow tồn kho chính hiện tại dùng `product_inventory_balances`, không dùng `inventory_balances`.

## Migration hiện có

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
```
