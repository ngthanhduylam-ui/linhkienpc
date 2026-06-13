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

Public lookup không yêu cầu login và không trả price/payment/debt/admin actions.

## 3. Auth admin

```text
POST /admin/auth/login
POST /admin/auth/refresh
POST /admin/auth/logout
GET  /admin/auth/me
```

Ghi chú:

- Login bằng username/password.
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
- Không gửi price/payment/debt/invoice fields.

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
- danh sách sản phẩm.

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
- Không thêm price/payment/debt/invoice vào API hiện tại.
- Không đổi schema/route public lookup nếu không cần.
- Nếu backend trả lỗi cụ thể, frontend phải hiển thị rõ thay vì thông báo mơ hồ.
