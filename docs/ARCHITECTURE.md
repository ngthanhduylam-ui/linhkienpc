# VI TÍNH PHƯỚC TÀI POS - Architecture

Cập nhật: **19/06/2026**

## 1. Tổng quan

Local:

```text
Browser -> React/Vite -> Express /api/v1 -> MySQL
```

Production:

```text
Browser
  -> HTTPS https://vitinhphuoctai.duckdns.org
  -> Nginx
     -> frontend/dist
     -> reverse proxy /api/v1
  -> Express under PM2: linhkienpc-api
  -> 127.0.0.1:3000
  -> MySQL localhost
```

Stack:

- React 18, Vite, React Router, TailwindCSS
- Node.js 18+, Express
- MySQL
- JWT access/refresh token, bcrypt
- Nginx, PM2, Let's Encrypt/Certbot

## 2. Frontend

```text
frontend/src/api/          API client và refresh flow
frontend/src/components/   shared UI
frontend/src/contexts/     AuthContext
frontend/src/layouts/      AdminLayout
frontend/src/pages/        route pages
frontend/src/services/     API wrappers
frontend/src/utils/        format/normalize helpers
frontend/src/router.jsx    route config
```

Frontend production dùng `VITE_API_BASE_URL=/api/v1`. API client hỗ trợ base URL tương đối và tuyệt đối, chuẩn hóa dấu `/` và giữ query parameters.

Ảnh sản phẩm dùng endpoint backend có kiểm soát. Admin thumbnail được tải bằng Bearer token; Public Lookup chỉ dùng endpoint public của sản phẩm active.

Routes chính:

```text
/                                      PublicSearchPage
/admin/login                           AdminLoginPage
/admin/products                        ProductManagementPage
/admin/products/new                    ProductFormPage
/admin/products/:id/edit               ProductFormPage
/admin/stock-in                        StockInBulkPage
/admin/stock-out                       StockOutBulkPage
/admin/inventory-check                 InventoryCheckPage
/admin/customers                       CustomerListPage
/admin/customers/:id                   CustomerDetailPage
/admin/suppliers                       SupplierListPage
/admin/transaction-history             TransactionHistoryPage
/admin/transaction-history/:voucherId  TransactionVoucherDetailPage
/admin/transaction-history/:voucherId/print TransactionVoucherPrintPage
```

POS và trang print dùng layout riêng; print route vẫn được bảo vệ bởi admin authentication nhưng không bọc `AdminLayout`.

## 3. Auth

- Access token và refresh token hiện lưu trong `localStorage`.
- API client gắn Bearer token cho admin request.
- Khi gặp 401, client thử refresh và retry một lần.
- Refresh thất bại sẽ xóa token và chuyển về login.
- Login limiter chỉ gắn tại `POST /admin/auth/login`.
- Giới hạn: 10 request/15 phút/IP; request vượt giới hạn trả 429.
- `app.set("trust proxy", "loopback")` chỉ tin Nginx chạy qua loopback.
- Limiter memory store phù hợp một PM2 instance; multi-instance cần shared store.

## 4. Backend

```text
backend/src/app.js
backend/src/server.js
backend/src/config/
backend/src/middlewares/
backend/src/modules/
backend/src/routes/index.js
backend/src/utils/
```

Modules:

- `auth`
- `category`
- `product`
- `productImage`
- `customer`
- `supplier`
- `stockTransaction`
- `stockVoucher`
- `inventory`
- `inventoryCheck`
- `warrantyBatch` legacy

Production server dùng `app.listen(env.port, env.host)`, với `HOST=127.0.0.1`.

Product image storage:

```text
PRODUCT_UPLOAD_ROOT/
  originals/   file gốc giữ nguyên byte
  thumbnails/  thumbnail WebP
  temp/        file upload tạm, được dọn sau xử lý
```

MySQL lưu metadata trong `product_images`. Product list/search lấy ảnh chính bằng một derived join, không query từng sản phẩm.

Admin bootstrap:

- Không có mật khẩu hard-code.
- Chỉ lấy `DEFAULT_ADMIN_PASSWORD` từ environment.
- Admin đã tồn tại không bị reset.
- Chưa có admin và thiếu password sẽ báo lỗi rõ ràng.

## 5. Route mounting

Base URL:

```text
/api/v1
```

Public:

```text
GET /health
GET /public/products
GET /public/products/:sku/inventory
GET /public/categories
```

Admin auth:

```text
POST /admin/auth/login
POST /admin/auth/refresh
POST /admin/auth/logout
GET  /admin/auth/me
```

Protected admin:

```text
/admin/categories/*
/admin/customers/*
/admin/suppliers/*
/admin/products/*
/admin/inventory-check/*
/admin/stock-vouchers/*
/admin/inventory/*
/admin/stock-in
/admin/stock-in/bulk
/admin/stock-out
/admin/stock-out/bulk
/admin/stock-transactions
```

## 6. Stock-in

- Frontend chọn supplier optional, sản phẩm, quantity và nhóm bảo hành.
- Backend bulk stock-in validate và cộng `product_inventory_balances`.
- Ghi `stock_transactions` và tạo `stock_vouchers`.
- Không có giá nhập, payment hoặc debt.

## 7. POS / Stock-out

- Full-screen POS, search/recent products, customer và multi-order.
- Cart merge theo SKU + nhóm bảo hành.
- `sale_note` thuộc từng cart row nhưng không tham gia merge key.
- POS hiển thị giá, line total và cart total dạng chỉ đọc.
- Payload gửi SKU, quantity, warranty note và sale note; không gửi field tiền.
- Backend validate stock, tự lấy `products.sale_price`, trừ tồn và snapshot voucher.

Snapshot:

```text
stock_voucher_items
  sku_snapshot
  product_name_snapshot
  warranty_note_snapshot
  sale_note_snapshot
  quantity
  unit_price
  line_total

stock_vouchers
  total_amount
```

`stock_transactions.note` chỉ giữ nhóm bảo hành/tồn kho, không giữ sale note.

## 8. Voucher detail và print

- List/detail dùng stock voucher API.
- Detail phiếu OUT hiển thị snapshot SKU/name/warranty/sale note/money.
- Legacy voucher fallback không crash và có thể trả giá/sale note `NULL`.
- Phiếu IN không hiển thị giá nhập giả.
- Print route lấy voucher detail API, không lấy cart.
- `window.print()` chỉ được gọi khi nhấn nút In phiếu.
- CSS print dùng A4, table header lặp lại và tránh cắt row.

## 9. Database

Nguồn tồn:

```text
product_inventory_balances
```

Lịch sử và phiếu:

```text
stock_transactions
stock_vouchers
stock_voucher_items
```

Các bảng legacy `warranty_batches` và `inventory_balances` vẫn được giữ để tương thích, không phải workflow mới.

## 10. Production boundaries

- Nginx là public entry point duy nhất cho web/API.
- Backend chỉ bind loopback.
- MySQL chỉ localhost.
- UFW mở 80/443 public, SSH từ LAN; không mở 3000/3306.
- DuckDNS cập nhật mỗi 5 phút.
- Backup MySQL hằng ngày lúc 23:00, retention 14 ngày.
- Hệ thống chưa có giá nhập, discount, payment, debt, invoice hoặc financial reporting.
