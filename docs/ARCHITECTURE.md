# VI TÍNH PHƯỚC TÀI POS - Architecture

Cập nhật gần nhất: **26/06/2026**

## Tổng quan

```text
Browser
  -> Nginx (HTTPS, frontend/dist)
  -> /api/v1 reverse proxy
  -> Express under PM2 at 127.0.0.1:3000
  -> MySQL localhost
```

Frontend production dùng `VITE_API_BASE_URL=/api/v1`. API client ghép base tương đối bằng string, hỗ trợ base tuyệt đối ở local, giữ query parameters và refresh flow.

## Frontend

```text
frontend/src/
  api/          API client
  components/   shared components
  contexts/     AuthContext
  layouts/      AdminLayout
  pages/        route pages
  services/     API wrappers
  utils/        recent items, warranty helpers
  router.jsx
```

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

POS và print route được bảo vệ bởi `ProtectedRoute` nhưng không dùng `AdminLayout`.

## Backend

```text
backend/src/
  app.js
  server.js
  config/
  middlewares/
  modules/
  routes/
  utils/
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

`app.js` mount API dưới `/api/v1` và dùng `app.set('trust proxy', 'loopback')`. `server.js` listen bằng `env.port` và `env.host`.

## Search architecture

- Admin product list và POS dùng `GET /admin/products`.
- POS search gọi server với `q`, `page=1`, `limit=12`, `is_active=true`.
- Request sequence guard ngăn response cũ ghi đè query mới.
- Public search dùng cùng token builder nhưng thêm warranty-note matching và filter tồn lớn hơn 0.
- Public search rỗng trả danh sách rỗng.

## Inventory architecture

```text
Current total: product_inventory_balances
Stock ledger:  stock_transactions
Group moves:   inventory_note_adjustments
Qty changes:   inventory_quantity_adjustments
```

`inventoryNoteGroups` tổng hợp group từ ba nguồn ledger và đối chiếu với total balance.

Quantity adjustment:

1. Begin transaction.
2. Lock product/balance bằng `FOR UPDATE`.
3. Tính group ledger sau locking read.
4. Validate total và selected group.
5. Update balance và insert history.
6. Commit; lỗi thì rollback.

## POS và voucher snapshot

POS gửi:

```text
customer_id?
items[].sku
items[].quantity
items[].warranty_note
items[].sale_note
items[].discount_amount
items[].manual_unit_price?
```

POS không gửi field tiền do backend tính như `reference_unit_price`, `final_unit_price`, `unit_price`, `line_total` hoặc `total_amount`.

Backend lấy `products.sale_price`, phân biệt `NULL` và `0`, validate discount/manual price, tính và snapshot vào:

```text
stock_voucher_items:
  sku_snapshot
  product_name_snapshot
  warranty_note_snapshot
  sale_note_snapshot
  quantity
  reference_unit_price
  discount_amount
  unit_price
  line_total

stock_vouchers:
  total_amount
```

Nếu một dòng không có giá tham chiếu và không nhập manual price, `unit_price`, `line_total` và `total_amount` có thể là `NULL`.

`stock_transactions.note` chỉ phục vụ nhóm tồn.

## Product images

Filesystem:

```text
PRODUCT_UPLOAD_ROOT/
  originals/
  thumbnails/
  temp/
```

- File gốc được giữ nguyên.
- Thumbnail WebP rộng tối đa 720px.
- MySQL lưu metadata trong `product_images`.
- Admin thumbnail cần auth; public image endpoint chỉ cho product active.
- Production upload root: `/opt/linhkienpc/uploads/products`.

## Auth và security

- Access/refresh token hiện lưu trong `localStorage`.
- API client refresh và retry một lần khi gặp 401.
- Refresh thất bại xóa token và chuyển login.
- Login limiter chỉ gắn `POST /admin/auth/login`.
- Limiter memory store phù hợp một PM2 instance; cluster cần shared store.

## Production boundaries

- Nginx là public entry point.
- Backend và MySQL không expose trực tiếp.
- Upload ảnh nằm ngoài Git repo.
- Production backup SSD hiện bao gồm database, uploads, backend configuration, manifest, SHA256 checksums và restore guide.
- Không có payment, debt, cost, invoice hoặc reporting architecture ở phase hiện tại.
- POS draft persistence đã revert ở `f736ca2`; hiện không có architecture persist unfinished tabs qua reload.
