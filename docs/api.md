# API.md

Tài liệu này tóm tắt API hiện tại của **VI TÍNH PHƯỚC TÀI POS**. Base URL:

```text
/api/v1
```

Admin endpoints, trừ auth, cần header:

```http
Authorization: Bearer <access_token>
```

## 1. Response format

Success:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "server_time": "2026-06-13T00:00:00.000Z"
  }
}
```

List:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "server_time": "2026-06-13T00:00:00.000Z"
  }
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed."
  },
  "meta": {
    "request_id": null,
    "server_time": "2026-06-13T00:00:00.000Z"
  }
}
```

## 2. Public endpoints

```text
GET /health
GET /public/products
GET /public/products/:sku/inventory
GET /public/categories
```

Public lookup không yêu cầu login và không trả `sale_price`, `unit_price`, `line_total`, `total_amount`, `sale_note`, payment/debt hoặc admin actions.

Product search qua `q` hỗ trợ tối đa 8 token theo logic AND. Các token không cần liền nhau hoặc đúng thứ tự; mỗi token có thể match tên, SKU, và với Public Lookup là ghi chú bảo hành. Đây là substring search có normalize cơ bản, chưa phải alias/compatibility/fuzzy search đầy đủ.

## 3. Auth admin

```text
POST /admin/auth/login
POST /admin/auth/refresh
POST /admin/auth/logout
GET  /admin/auth/me
```

Ghi chú:

- Login bằng username/password.
- `POST /admin/auth/login` giới hạn 10 request trong 15 phút theo IP; request thứ 11 trong cùng cửa sổ trả HTTP 429.
- Lỗi giới hạn dùng code `AUTH_LOGIN_RATE_LIMITED` và không lộ stack trace/secret.
- Production nhận IP client qua Nginx với Express `trust proxy` đặt là `loopback`.
- Rate limit chỉ áp dụng cho login, không áp dụng cho refresh/logout hoặc API khác.
- Refresh token được rotate.
- Logout revoke refresh token.
- `/admin/auth/me` cần access token.

## 4. Loại sản phẩm / categories

```text
GET   /admin/categories
POST  /admin/categories
GET   /admin/categories/:id
PATCH /admin/categories/:id
PATCH /admin/categories/:id/deactivate
PATCH /admin/categories/:id/activate
```

UI gọi là “Loại sản phẩm”, backend/database vẫn dùng `category`.

## 5. Products

```text
GET   /admin/products
POST  /admin/products
GET   /admin/products/:id
PATCH /admin/products/:id
PATCH /admin/products/:id/deactivate
PATCH /admin/products/:id/activate
```

Admin product API hỗ trợ `sale_price` cho giá bán mặc định:

- `sale_price` chỉ xuất hiện trong admin product list/detail/create/update response.
- `sale_price` là optional và nullable; `NULL` nghĩa là chưa thiết lập giá bán, `0` là giá bán thực sự bằng 0.
- Giá hợp lệ là số nguyên không âm, tối đa `999999999999999`.
- Public lookup không trả `sale_price`.

Quy tắc SKU:

- Unique.
- Chữ thường, số, dấu chấm.
- Không dùng dấu cách, dấu gạch ngang hoặc ký tự đặc biệt.

Lỗi duplicate SKU cần hiển thị rõ ở UI:

```text
SKU này đã tồn tại. Vui lòng dùng SKU khác.
```

## 6. Customers

```text
GET   /admin/customers
POST  /admin/customers
GET   /admin/customers/:id
PATCH /admin/customers/:id
PATCH /admin/customers/:id/deactivate
PATCH /admin/customers/:id/activate
GET   /admin/customers/:id/transactions
```

Trường UI đang dùng thực tế:

- `name`
- `phone`
- `address`
- `is_active`

Không giả định customer group, debt, tax, tags hoặc địa chỉ tách tỉnh/huyện/xã đã tồn tại.

## 7. Suppliers

```text
GET   /admin/suppliers
POST  /admin/suppliers
PATCH /admin/suppliers/:id
PATCH /admin/suppliers/:id/deactivate
PATCH /admin/suppliers/:id/activate
```

Trường UI đang dùng thực tế:

- `name`
- `phone`
- `address`
- `is_active`

Không có route detail supplier riêng trong router hiện tại.

## 8. Stock-in

Primary bulk endpoint:

```text
POST /admin/stock-in/bulk
```

Legacy/single endpoint:

```text
POST /admin/stock-in
```

Ý nghĩa:

- Nhập hàng cộng tồn.
- Có thể gắn `supplier_id`.
- Mỗi dòng có SKU/product, quantity và note/nhóm bảo hành.
- Tạo stock transactions và stock voucher.
- Không gửi price/payment/debt fields.

## 9. Stock-out / POS

Primary bulk endpoint:

```text
POST /admin/stock-out/bulk
```

Legacy/single endpoint:

```text
POST /admin/stock-out
```

Ý nghĩa:

- Bán tại quầy / xuất kho trừ tồn.
- Có thể gắn `customer_id`.
- Validate tổng tồn và tồn theo nhóm note/warranty.
- Tạo stock transactions và stock voucher.
- Frontend không gửi `unit_price`; backend tự snapshot giá từ `products.sale_price`.
- Nếu sản phẩm có `sale_price`, backend lưu `unit_price` và `line_total` vào `stock_voucher_items`.
- Nếu có bất kỳ dòng nào chưa có giá (`sale_price IS NULL`), `stock_vouchers.total_amount` là `NULL`.
- Bulk stock-out item hỗ trợ optional nullable `sale_note` tối đa 500 ký tự. Backend trim trước khi lưu vào `stock_voucher_items.sale_note_snapshot`; chuỗi rỗng hoặc chỉ khoảng trắng lưu thành `NULL`.
- `sale_note` là Serial/Ghi chú bán hàng riêng của dòng, tách biệt với `warranty_note`, không dùng để chọn nhóm tồn và không ghi vào `stock_transactions.note`.
- Không gửi payment/debt/discount/invoice fields.

## 10. Stock transactions

```text
GET /admin/stock-transactions
```

Dùng cho lịch sử giao dịch dòng-level nếu cần. UI hiện ưu tiên voucher-level qua stock vouchers.

## 11. Stock vouchers

```text
GET /admin/stock-vouchers
GET /admin/stock-vouchers/:id
```

UI routes:

```text
/admin/transaction-history
/admin/transaction-history/:voucherId
```

Voucher dùng để xem:

- mã phiếu,
- loại phiếu,
- ngày tạo,
- người tạo,
- khách hàng/nhà cung cấp nếu có,
- tổng số lượng,
- `total_amount` nullable,
- danh sách sản phẩm.
- Với phiếu bán mới, detail item có `unit_price` và `line_total` nullable từ snapshot.
- Với phiếu bán mới, detail item có `sale_note` nullable từ `stock_voucher_items.sale_note_snapshot`, tách biệt với `warranty_note`.
- Với phiếu cũ chưa có snapshot, detail fallback về `stock_transactions` và giá là `NULL`.
- Với phiếu cũ hoặc dòng không có ghi chú bán hàng, `sale_note` là `NULL`.

Voucher không phải invoice.

## 12. Inventory check

```text
GET  /admin/inventory-check/products
GET  /admin/inventory-check/products/:sku
POST /admin/inventory-check/note-move
POST /admin/inventory-check/quantity-adjust
```

Dùng để:

- tìm sản phẩm khi kiểm hàng,
- xem tồn và nhóm ghi chú,
- chuyển tồn giữa nhóm ghi chú,
- tăng/giảm tồn có lý do.

## 13. Inventory overview

Mounted under:

```text
/admin/inventory/*
```

Xem tồn kho admin. Không phải nguồn chỉnh tồn trực tiếp.

## 14. Warranty batch legacy

Module `warrantyBatch` vẫn được mount dưới `/admin` để tương thích.

Không dùng các route batch làm workflow chính cho POS/stock-in hiện tại. Workflow hiện tại lấy nhóm bảo hành/ghi chú từ transaction notes và adjustment records.

## 15. Nguyên tắc thay đổi API

- Không đổi payload nhập/xuất tồn nếu chưa có phase riêng.
- Public lookup không trả giá, dữ liệu tiền, sale note, payment/debt/invoice hoặc admin actions.
- Stock-in không có giá nhập trong Phase 2A.
- Stock-out/voucher APIs chỉ snapshot giá bán mặc định theo Phase 2A; không thêm payment/debt/discount/invoice nếu chưa có task được duyệt rõ.
- Admin product API được phép lưu giá bán mặc định qua `sale_price`.
- Không đổi schema/route public lookup nếu không cần.
- Nếu backend trả lỗi cụ thể, frontend phải hiển thị rõ thay vì thông báo mơ hồ.
