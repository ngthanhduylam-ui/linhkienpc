# Business Rules

## Phạm vi hệ thống

LINHKIENPC là hệ thống tra cứu tồn kho và quản lý nhập/xuất linh kiện PC.

Không có các tính năng sau:

- Giỏ hàng.
- Checkout.
- Đơn hàng bán hàng.
- Tài khoản khách công khai.
- Hình ảnh sản phẩm.
- Giá nhập.
- Giá bán.
- Doanh thu.
- Công nợ.
- Thanh toán.
- Kế toán.
- Dashboard biểu đồ.

## Quy tắc sản phẩm

- SKU đại diện cho model sản phẩm, ví dụ `cpu.intel.12400f`.
- SKU là unique.
- Product có `is_active` để soft delete/deactivate.
- Product inactive không xuất hiện trong public search và admin list mặc định.
- Product creation tạo luôn một dòng tồn kho trong `product_inventory_balances` với số lượng 0.
- Product thuộc một category.
- Category inactive không tự động ẩn/deactivate product đang active.

## Quy tắc danh mục

- Danh mục lưu trong bảng `categories`.
- Backend hiện yêu cầu `code` và `name` khi tạo category.
- Frontend có thể tự tạo `code` từ tên category để đơn giản hóa UI.
- Category dùng `is_active` để deactivate.
- Deactivate category không cascade sang product.
- Product active vẫn có thể hiển thị dù category inactive, tùy API/list đang gọi.

## Quy tắc tồn kho

- Tồn kho chính là tồn theo sản phẩm trong `product_inventory_balances`.
- Admin không được chỉnh trực tiếp số lượng tồn từ UI.
- Tồn chỉ thay đổi qua stock-in hoặc stock-out.
- Mỗi lần thay đổi tồn phải tạo một dòng `stock_transactions`.
- Stock-in và stock-out chạy trong MySQL transaction.
- Backend lock tồn kho bằng `SELECT ... FOR UPDATE` trước khi cập nhật.
- Stock-out phải kiểm tra đủ tồn.
- Nếu không đủ tồn, backend trả lỗi `INSUFFICIENT_STOCK`.
- Timestamp giao dịch do backend/database tạo bằng `CURRENT_TIMESTAMP`.

## Workflow nhập hàng

- Endpoint hiện tại: `POST /api/v1/admin/stock-in`.
- Body bắt buộc: `sku`, `quantity`.
- Body optional: `note`, `supplier_id`.
- Backend validate SKU tồn tại và product active.
- Backend validate supplier nếu có `supplier_id`.
- Stock-in cộng vào `product_inventory_balances.quantity`.
- Stock-in ghi transaction `txn_type = 'IN'`.
- Note nhập hàng có thể chứa thông tin bảo hành như `BH04.28`.

## Workflow xuất hàng

- Endpoint hiện tại: `POST /api/v1/admin/stock-out`.
- Body bắt buộc: `sku`, `quantity`.
- Body optional: `note`, `warranty_note`, `customer_id`.
- Backend validate SKU tồn tại và product active.
- Backend validate customer nếu có `customer_id`.
- Backend kiểm tra tổng tồn đủ xuất.
- Nếu sản phẩm có nhóm ghi chú bảo hành còn tồn, admin phải chọn `warranty_note` hoặc gửi note tương ứng.
- Stock-out không được vượt quá số lượng còn lại của nhóm ghi chú bảo hành được chọn.
- Stock-out trừ `product_inventory_balances.quantity`.
- Stock-out ghi transaction `txn_type = 'OUT'`.

## Quy tắc bảo hành hiện tại

- Workflow hiện tại không dùng `warranty_batches` làm đơn vị tồn kho.
- Không có lot tracking thật.
- Không có FIFO/FEFO.
- Không quản lý hạn bảo hành bằng batch trong UI hiện tại.
- Thông tin bảo hành được lưu trong `stock_transactions.note`.
- Nhóm bảo hành được tính từ note đã normalize.
- Remaining quantity theo note:

```text
SUM(IN quantity theo note) - SUM(OUT quantity theo note)
```

- Chỉ hiển thị note group có remaining > 0.
- Public search hiển thị note group còn tồn trong phần “Thông tin bảo hành”.
- Stock-out ghi lại note bảo hành đã chọn để remaining group giảm đúng.

## Quy tắc khách hàng

- Customer là optional trong stock-out.
- Customer có các trường: `name`, `phone`, `address`.
- Customer inactive không xuất hiện trong list mặc định.
- Customer có thể được tạo inline trong màn hình xuất hàng hoặc trong trang Khách hàng.
- Transaction history trả về customer nếu `stock_transactions.customer_id` có dữ liệu.
- Không có CRM, công nợ, thanh toán hoặc lịch sử mua bán ngoài stock transaction.

## Quy tắc nhà cung cấp

- Supplier là optional trong stock-in.
- Supplier có các trường: `name`, `phone`, `address`.
- Supplier inactive không xuất hiện trong list mặc định.
- Supplier có thể được tạo inline trong màn hình nhập hàng hoặc trong trang Nhà cung cấp.
- Transaction history trả về supplier nếu `stock_transactions.supplier_id` có dữ liệu.
- Không có purchase order, công nợ, thanh toán hoặc kế toán nhà cung cấp.

## Quy tắc public search

- Public user không cần login.
- Public search không hiển thị tất cả sản phẩm khi chưa nhập keyword ở frontend hiện tại.
- Public API tìm theo:
  - SKU.
  - Tên sản phẩm.
  - Note của stock-in transaction.
- Public response trả:
  - `sku`.
  - `name`.
  - `total_quantity`.
  - `note_groups`.
- Không trả giá, hình ảnh, giỏ hàng, checkout hoặc thông tin khách/admin.

## Quy tắc auth

- Admin login bằng username/password.
- Password lưu bằng bcrypt hash.
- Access token dùng JWT.
- Refresh token dùng JWT và chỉ lưu hash trong database.
- Refresh token được rotate khi refresh.
- Logout revoke refresh token bằng `revoked_at`.
- Admin inactive không được login.
- Protected admin API dùng `requireAuth` middleware.
## Định hướng phát triển tương lai

Các tính năng có thể triển khai trong tương lai nhưng hiện chưa tồn tại:

- Giá vốn
- Giá bán
- Công nợ khách hàng
- Công nợ nhà cung cấp
- Purchase Order
- Sales Order
- Import Excel
- Export Excel
- Barcode
- QR Code

Không được giả định các tính năng này đã tồn tại khi phát triển hệ thống.
