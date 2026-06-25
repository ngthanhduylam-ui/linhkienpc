# VI TÍNH PHƯỚC TÀI POS - API Notes

Cập nhật gần nhất: **26/06/2026**

Base path production: `/api/v1`

Admin endpoints, trừ login/refresh/logout, cần Bearer access token theo route/middleware thực tế.

## Public Lookup

```text
GET /public/products
GET /public/products/:sku/inventory
GET /public/categories
```

Public search/list chỉ trả product active có tổng tồn lớn hơn 0. Public không trả `sale_price`, snapshot tiền hoặc `sale_note`.

## Admin auth

```text
POST /admin/auth/login
POST /admin/auth/refresh
POST /admin/auth/logout
GET  /admin/auth/me
```

- Login rate limit 10 request/15 phút/IP.
- Refresh token lưu dạng hash.

## Categories

```text
GET    /admin/categories
POST   /admin/categories
GET    /admin/categories/:id
PATCH  /admin/categories/:id
PATCH  /admin/categories/:id/deactivate
PATCH  /admin/categories/:id/activate
DELETE /admin/categories/:id
```

Category management hiện hỗ trợ:

- tạo category;
- đổi tên/update category;
- deactivate/activate;
- xóa category chỉ khi chưa có product sử dụng.

`DELETE /admin/categories/:id` trả HTTP 409 với code `CATEGORY_IN_USE` nếu còn product liên kết.

## Products

```text
GET    /admin/products
POST   /admin/products
GET    /admin/products/:id
PATCH  /admin/products/:id
PATCH  /admin/products/:id/deactivate
PATCH  /admin/products/:id/activate
```

Admin product API trả `sale_price` dạng number hoặc `null`. Giá hợp lệ là số nguyên `0..999999999999999`.

Admin search hỗ trợ multi-token AND và category name. POS dùng:

```text
GET /admin/products?q=<keyword>&page=1&limit=12&is_active=true
```

## Product images

```text
GET    /admin/products/:id/images
POST   /admin/products/:id/images
POST   /admin/products/:id/images/:imageId/replace
PATCH  /admin/products/:id/images/reorder
GET    /admin/products/:id/images/:imageId/thumbnail
GET    /admin/products/:id/images/:imageId/download
DELETE /admin/products/:id/images/:imageId
```

Maximum: 3 images/product.

## Customers / Suppliers

```text
GET   /admin/customers
POST  /admin/customers
GET   /admin/customers/:id
PATCH /admin/customers/:id
PATCH /admin/customers/:id/deactivate
PATCH /admin/customers/:id/activate
GET   /admin/customers/:id/transactions

GET   /admin/suppliers
POST  /admin/suppliers
PATCH /admin/suppliers/:id
PATCH /admin/suppliers/:id/deactivate
PATCH /admin/suppliers/:id/activate
```

Không có supplier detail route riêng.

## Stock-in / Stock-out

```text
POST /admin/stock-in
POST /admin/stock-in/bulk
POST /admin/stock-out
POST /admin/stock-out/bulk
GET  /admin/stock-transactions
```

Bulk stock-out payload hiện tại:

```json
{
  "customer_id": 1,
  "items": [
    {
      "sku": "2nd.main.asus.b760m.k",
      "quantity": 1,
      "warranty_note": "BH 7.28",
      "sale_note": "Serial ABC",
      "discount_amount": 100000,
      "manual_unit_price": 0
    }
  ]
}
```

Rules:

- `discount_amount` là fixed VND discount trên mỗi đơn vị, mặc định `0`.
- `manual_unit_price` chỉ hợp lệ khi product không có `sale_price`.
- Product `sale_price = NULL` vẫn bán được dù không gửi `manual_unit_price`; money snapshots có thể là `NULL`.
- Product `sale_price = 0` là configured reference price hợp lệ.
- Frontend không gửi `reference_unit_price`, `final_unit_price`, `unit_price`, `line_total`, `total_amount`.
- Backend lấy `products.sale_price`, validate stock/money/discount và snapshot voucher trong cùng transaction.

## Inventory Check

```text
GET  /admin/inventory-check/products
GET  /admin/inventory-check/products/:sku
POST /admin/inventory-check/note-move
POST /admin/inventory-check/quantity-adjust
GET  /admin/inventory
```

- `note-move`: chuyển group, không đổi total.
- `quantity-adjust`: tăng/giảm total và selected group; history lưu group quantity trước/sau.

## Stock vouchers

```text
GET /admin/stock-vouchers
GET /admin/stock-vouchers/:id
```

OUT detail có thể trả:

```text
voucher.total_amount
items[].sku
items[].name
items[].warranty_note
items[].sale_note
items[].quantity
items[].reference_unit_price
items[].discount_amount
items[].unit_price
items[].line_total
```

Legacy voucher hoặc optional-price sale có thể trả money/sale note `null`.

## Boundaries

- Không thêm price/payment/debt/invoice vào public.
- Stock-in chưa có giá nhập.
- Không thay đổi inventory payload/schema nếu chưa có phase được duyệt.
- Payment/debt/cost/reporting vẫn deferred.
