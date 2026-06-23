# VI TÍNH PHƯỚC TÀI POS - API

Cập nhật gần nhất: **23/06/2026**

Base URL:

```text
/api/v1
```

Admin endpoints, trừ login/refresh/logout, cần Bearer access token theo route/middleware thực tế.

## Public

```text
GET /health
GET /public/products
GET /public/products/:sku/inventory
GET /public/products/:sku/images
GET /public/products/:sku/images/:imageId/thumbnail
GET /public/products/:sku/images/:imageId/download
GET /public/categories
```

### `GET /public/products`

Query chính: `q`, `page`, `limit`.

- Search rỗng trả danh sách rỗng.
- Tối đa 8 token, logic AND, không cần liền nhau hoặc đúng thứ tự.
- Token match tên, SKU hoặc warranty note.
- Chỉ trả product active có tổng tồn lớn hơn 0.
- Count và pagination dùng cùng filter tồn.
- Không trả `sale_price`, snapshot tiền hoặc `sale_note`.

### Public inventory detail

`GET /public/products/:sku/inventory` giữ hành vi tương thích hiện tại: product active tồn 0 vẫn có thể được tra cứu trực tiếp. Public Lookup UI tạo kết quả bằng endpoint search/list, không dùng detail để bypass filter.

## Admin auth

```text
POST /admin/auth/login
POST /admin/auth/refresh
POST /admin/auth/logout
GET  /admin/auth/me
```

- Login rate limit 10 request/15 phút/IP.
- Vượt giới hạn trả 429, code `AUTH_LOGIN_RATE_LIMITED`.
- Limiter không áp dụng refresh/logout hoặc endpoint khác.

## Categories

```text
GET   /admin/categories
POST  /admin/categories
GET   /admin/categories/:id
PATCH /admin/categories/:id
PATCH /admin/categories/:id/deactivate
PATCH /admin/categories/:id/activate
```

## Products

```text
GET   /admin/products
POST  /admin/products
GET   /admin/products/:id
PATCH /admin/products/:id
PATCH /admin/products/:id/deactivate
PATCH /admin/products/:id/activate
```

Admin product API trả `sale_price` dạng number hoặc `null`. Giá hợp lệ là số nguyên 0..999999999999999.

Search admin hỗ trợ multi-token và category name. POS dùng:

```text
GET /admin/products?q=<keyword>&page=1&limit=12&is_active=true
```

Admin search vẫn có thể trả product hết hàng.

### Product images

```text
GET    /admin/products/:id/images
POST   /admin/products/:id/images
POST   /admin/products/:id/images/:imageId/replace
PATCH  /admin/products/:id/images/reorder
GET    /admin/products/:id/images/:imageId/thumbnail
GET    /admin/products/:id/images/:imageId/download
DELETE /admin/products/:id/images/:imageId
```

- Upload multipart field `images`.
- Tối đa 3 ảnh, 15 MB/file.
- JPEG/PNG/WebP hợp lệ.
- Backend giữ file gốc và tạo thumbnail WebP 720px.

## Customers

```text
GET   /admin/customers
POST  /admin/customers
GET   /admin/customers/:id
PATCH /admin/customers/:id
PATCH /admin/customers/:id/deactivate
PATCH /admin/customers/:id/activate
GET   /admin/customers/:id/transactions
```

## Suppliers

```text
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
      "sale_note": "Serial ABC"
    }
  ]
}
```

Frontend không gửi `unit_price`, `line_total`, `total_amount`. Backend lấy `products.sale_price`, validate stock và snapshot voucher trong cùng transaction.

## Inventory Check

```text
GET  /admin/inventory-check/products
GET  /admin/inventory-check/products/:sku
POST /admin/inventory-check/note-move
POST /admin/inventory-check/quantity-adjust
```

- `note-move`: chuyển group, không đổi total.
- `quantity-adjust`: tăng/giảm total và selected group; history lưu group quantity trước/sau.

Inventory overview:

```text
GET /admin/inventory
```

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
items[].unit_price
items[].line_total
```

Legacy voucher có thể trả money/sale note `null`.

## Warranty batch legacy

```text
GET   /admin/products/:productId/batches
POST  /admin/products/:productId/batches
GET   /admin/batches/:id
PATCH /admin/batches/:id
PATCH /admin/batches/:id/deactivate
PATCH /admin/batches/:id/activate
```

Không phải workflow chính của POS hiện tại.

## Nguyên tắc mở rộng API

- Không thêm price/payment/debt/invoice vào public.
- Stock-in chưa có giá nhập.
- Warranty group không phải bảng giá.
- Discount VND theo dòng là next task, chưa có contract API.
- Không thay đổi inventory payload/schema nếu chưa có phase được duyệt.
