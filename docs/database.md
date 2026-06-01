# Thiết kế cơ sở dữ liệu (đề xuất) - LINHKIENPC

## Nguyên tắc
- Mô hình tồn kho theo cặp khóa: `product_id + warranty_batch_id`.
- Không gộp lô bảo hành.
- Tất cả thời điểm (`created_at`, `updated_at`, `occurred_at`) dùng thời gian server.
- Soft delete qua `is_active`, không hard delete mặc định với `products` và `warranty_batches`.
- Dữ liệu lịch sử (`stock_transactions`) phải được giữ nguyên để truy vết.

## 1) Bảng `admins`
- `id` BIGINT PK AI
- `username` VARCHAR(50) UNIQUE NOT NULL
- `password_hash` VARCHAR(255) NOT NULL
- `display_name` VARCHAR(100) NULL
- `is_active` TINYINT(1) NOT NULL DEFAULT 1
- `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
- `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

## 2) Bảng `categories` (master table)
- `id` BIGINT PK AI
- `code` VARCHAR(50) UNIQUE NOT NULL
- `name` VARCHAR(120) UNIQUE NOT NULL
- `description` VARCHAR(255) NULL
- `is_active` TINYINT(1) NOT NULL DEFAULT 1
- `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
- `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

## 3) Bảng `products`
- `id` BIGINT PK AI
- `sku` VARCHAR(120) UNIQUE NOT NULL  (vd: cpu.intel.12400f)
- `name` VARCHAR(255) NOT NULL
- `category_id` BIGINT NOT NULL FK -> categories(id)
- `spec_summary` TEXT NULL
- `is_active` TINYINT(1) NOT NULL DEFAULT 1
- `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
- `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

## 4) Bảng `warranty_batches`
- `id` BIGINT PK AI
- `product_id` BIGINT NOT NULL FK -> products(id)
- `batch_code` VARCHAR(50) NOT NULL (vd: BH 07.26)
- `warranty_end_month` TINYINT NULL
- `warranty_end_year` SMALLINT NULL
- `is_active` TINYINT(1) NOT NULL DEFAULT 1
- `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
- `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
- UNIQUE(`product_id`, `batch_code`)

## 5) Bảng `inventory_balances`
- `id` BIGINT PK AI
- `product_id` BIGINT NOT NULL FK -> products(id)
- `warranty_batch_id` BIGINT NOT NULL FK -> warranty_batches(id)
- `quantity` INT NOT NULL DEFAULT 0
- `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
- UNIQUE(`product_id`, `warranty_batch_id`)

## 6) Bảng `stock_transactions`
- `id` BIGINT PK AI
- `txn_type` ENUM('IN','OUT') NOT NULL
- `product_id` BIGINT NOT NULL FK -> products(id)
- `warranty_batch_id` BIGINT NOT NULL FK -> warranty_batches(id)
- `quantity` INT NOT NULL
- `note` VARCHAR(500) NULL
- `created_by_admin_id` BIGINT NOT NULL FK -> admins(id)
- `occurred_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP

## 7) Bảng `admin_refresh_tokens` (JWT refresh token rotation)
- `id` BIGINT PK AI
- `admin_id` BIGINT NOT NULL FK -> admins(id)
- `token_hash` VARCHAR(255) NOT NULL
- `expires_at` DATETIME NOT NULL
- `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
- `revoked_at` DATETIME NULL

## Chỉ mục đề xuất
- `categories(code)`
- `categories(name)`
- `products(sku)`
- `products(name)`
- `FULLTEXT products(name)` (nếu MySQL hỗ trợ)
- `products(category_id, is_active)`
- `warranty_batches(product_id, batch_code)`
- `warranty_batches(product_id, is_active)`
- `inventory_balances(product_id, warranty_batch_id)`
- `stock_transactions(product_id, warranty_batch_id, occurred_at)`
- `stock_transactions(created_by_admin_id, occurred_at)`

## Tối ưu tìm kiếm
- Ưu tiên tạo `FULLTEXT INDEX ft_products_name (name)` để tăng tốc fuzzy search theo tên sản phẩm khi MySQL hỗ trợ.
- Fallback khi môi trường không hỗ trợ FULLTEXT: dùng `LIKE`/`LOWER(... LIKE ...)` kết hợp chỉ mục B-Tree hiện có và phân trang bắt buộc.

## Quy tắc hiển thị dữ liệu
- Danh sách sản phẩm public và admin mặc định chỉ lọc theo `products.is_active = 1`.
- Category inactive không làm ẩn tự động sản phẩm active thuộc category đó.
- Deactivate category không cascade deactivate xuống `products`.
- Trong admin UI, tên category vẫn hiển thị kèm nhãn `inactive` nếu category đã tắt.
- Có thể hỗ trợ tham số `include_inactive=true` riêng cho admin khi cần tra cứu sản phẩm/batch inactive.
- `stock_transactions` luôn giữ lịch sử, không bị ảnh hưởng bởi việc deactivate category/product/batch.

## Luồng cập nhật tồn kho (bắt buộc dùng transaction)
1. `BEGIN TRANSACTION`.
2. Validate SKU.
3. Validate batch.
4. Validate quantity.
5. Với stock-out: kiểm tra tồn kho khả dụng, nếu không đủ thì reject.
6. Cập nhật `inventory_balances`.
7. Ghi `stock_transactions`.
8. `COMMIT`.
9. `ROLLBACK` khi có bất kỳ lỗi nào.

## SKU-centric lookup cho nhập/xuất kho
- API nhập/xuất kho nhận `sku` (bắt buộc) và `batch_code` (tuỳ chọn) từ client.
- Backend tra `products.sku` để lấy `product_id` nội bộ.
- Nếu có `batch_code`, backend tra `warranty_batches` theo cặp (`product_id`, `batch_code`) để lấy `warranty_batch_id`.
- Nếu không có `batch_code` và SKU có nhiều batch active, backend trả lỗi yêu cầu chỉ rõ batch.
- Sau khi resolve ID, backend mới ghi `stock_transactions` và cập nhật `inventory_balances`.
