# ARCHITECTURE.md

Tài liệu này mô tả kiến trúc hiện tại của **VI TÍNH PHƯỚC TÀI POS**. Hướng chính hiện nay là POS-first, tồn kho thực tế, chạy nội bộ/offline-first; không phải ERP tài chính.

## 1. Tổng quan

```text
Browser
  -> React/Vite frontend
  -> API client
  -> Express backend /api/v1
  -> MySQL
```

Stack chính:

- Frontend: React 18, Vite, React Router, TailwindCSS.
- Backend: Node.js, Express, MySQL, JWT, bcrypt.
- Database: MySQL, schema tổng hợp tại `database/schema/schema.sql`.

## 2. Frontend

Thư mục chính:

```text
frontend/src/api/          API client, refresh token handling
frontend/src/components/   shared UI components
frontend/src/contexts/     AuthContext
frontend/src/layouts/      AdminLayout
frontend/src/pages/        route pages
frontend/src/services/     API service wrappers
frontend/src/utils/        format/normalize helpers
frontend/src/router.jsx    route config
```

Routes public:

```text
/                              PublicSearchPage
```

Routes admin chính:

```text
/admin/login                   AdminLoginPage
/admin                         redirect /admin/stock-in
/admin/products                ProductManagementPage
/admin/products/new            ProductFormPage
/admin/products/:id/edit       ProductFormPage
/admin/stock-in                StockInBulkPage
/admin/stock-out               StockOutBulkPage, full-screen POS
/admin/inventory-check         InventoryCheckPage
/admin/customers               CustomerListPage
/admin/customers/:id           CustomerDetailPage
/admin/suppliers               SupplierListPage
/admin/transaction-history     TransactionHistoryPage
/admin/transaction-history/:voucherId TransactionVoucherDetailPage
```

Routes còn giữ để tương thích:

```text
/admin/inventory-workbench     redirect /admin/stock-in
/admin/stock-out-bulk          redirect /admin/stock-out
/admin/stock-in-single         StockInPage, legacy/single flow
/admin/stock-out-single        StockOutPage, legacy/single flow
```

## 3. Auth frontend

- `AuthContext.jsx` giữ trạng thái admin.
- Access token và refresh token hiện lưu ở `localStorage`.
- `apiClient.js` gắn `Authorization: Bearer <access_token>` cho admin request.
- Khi API trả 401, client thử `/admin/auth/refresh` và retry request một lần.
- Nếu refresh thất bại, token bị xóa và admin quay về `/admin/login`.

## 4. Backend

Thư mục chính:

```text
backend/src/app.js
backend/src/server.js
backend/src/config/
backend/src/middlewares/
backend/src/modules/
backend/src/routes/index.js
backend/src/utils/
```

Modules chính:

- `auth`: login, refresh, logout, profile.
- `category`: loại sản phẩm/category.
- `product`: product CRUD, public search, inventory group lookup.
- `customer`: khách hàng, trạng thái active/inactive.
- `supplier`: nhà cung cấp, trạng thái active/inactive.
- `stockTransaction`: stock-in, stock-out, bulk operations, transaction list.
- `stockVoucher`: danh sách/detail phiếu nhập và phiếu bán.
- `inventory`: inventory overview.
- `inventoryCheck`: tìm sản phẩm, chuyển nhóm ghi chú, điều chỉnh tồn.
- `warrantyBatch`: module legacy, không phải workflow UI chính.

## 5. Route mounting backend

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

Legacy warranty batch routes vẫn được mount dưới `/admin`, nhưng không dùng làm hướng chính cho POS/nhập hàng.

## 6. Request flow

Admin request:

```text
React page
  -> service function
  -> apiClient
  -> Express route
  -> requireAuth middleware
  -> validation middleware
  -> controller
  -> service
  -> MySQL transaction/query
```

Public request:

```text
PublicSearchPage
  -> publicSearch.service.js
  -> GET /public/products?q=...
  -> product service
  -> MySQL
```

## 7. Nhập hàng

Route chính: `/admin/stock-in`

Frontend:

- Chọn nhà cung cấp nếu có.
- Tìm và thêm nhiều sản phẩm.
- Mỗi dòng có số lượng nhập.
- Mỗi dòng có nhóm bảo hành / ghi chú.

Backend:

- `POST /admin/stock-in/bulk`
- Validate product active.
- Validate supplier active nếu có `supplier_id`.
- Cộng tồn trong `product_inventory_balances`.
- Ghi `stock_transactions`.
- Tạo `stock_vouchers`.

Không có giá nhập, thanh toán, công nợ hoặc tổng tiền trong workflow hiện tại.

## 8. Bán tại quầy / Stock-out POS

Route chính: `/admin/stock-out`

Frontend:

- Full-screen POS.
- Tìm sản phẩm và xem sản phẩm gần đây.
- Chọn nhóm bảo hành / ghi chú trước khi thêm vào cart.
- Cart nội bộ cho từng đơn local.
- Sửa số lượng trong cart.
- Chọn khách hàng nếu cần.
- Hỗ trợ nhiều đơn local trên frontend.

Backend:

- `POST /admin/stock-out/bulk`
- Validate product active.
- Validate customer active nếu có `customer_id`.
- Validate tổng tồn và tồn theo nhóm ghi chú.
- Trừ tồn trong `product_inventory_balances`.
- Ghi `stock_transactions`.
- Tạo `stock_vouchers`.

Phiếu bán là phiếu xuất kho nội bộ, không phải hóa đơn thanh toán.

## 9. Kiểm hàng

Route: `/admin/inventory-check`

Hành vi hiện tại:

- Tìm và chọn sản phẩm.
- Xem tổng tồn và các nhóm ghi chú.
- Tăng/giảm số lượng theo nhóm ghi chú.
- Ghi lý do điều chỉnh.
- Xem các điều chỉnh gần đây.

Endpoints:

```text
GET  /admin/inventory-check/products
GET  /admin/inventory-check/products/:sku
POST /admin/inventory-check/note-move
POST /admin/inventory-check/quantity-adjust
```

Đây là workflow điều chỉnh tồn trực tiếp, chưa phải hệ thống phiếu kiểm hàng/draft/cân bằng đầy đủ.

## 10. Lịch sử giao dịch / phiếu kho

Routes:

```text
/admin/transaction-history
/admin/transaction-history/:voucherId
```

Backend:

```text
GET /admin/stock-vouchers
GET /admin/stock-vouchers/:id
```

Detail phiếu hiển thị:

- Mã phiếu.
- Loại phiếu: Phiếu nhập / Phiếu bán.
- Ngày tạo.
- Người tạo.
- Nhà cung cấp hoặc khách hàng nếu có.
- Tổng số lượng.
- Số dòng.
- Ghi chú nếu có.
- Danh sách sản phẩm, SKU, nhóm bảo hành/ghi chú, số lượng.

Không hiển thị giá, thanh toán, công nợ, hóa đơn hoặc kế toán.

## 11. Database

Nguồn tồn hiện tại:

```text
product_inventory_balances
```

Sổ giao dịch:

```text
stock_transactions
```

Nhóm phiếu:

```text
stock_vouchers
stock_transactions.voucher_id
```

Nhóm bảo hành/ghi chú được tính từ `stock_transactions.note` và các bảng điều chỉnh tồn, không lấy `warranty_batches` làm workflow chính.

## 12. Thành phần legacy

Các phần sau còn tồn tại để tương thích hoặc chờ dọn sau:

- Backend module `warrantyBatch`.
- Bảng `warranty_batches`.
- Bảng `inventory_balances`.
- Trang single stock-in/stock-out.
- Redirect `inventory-workbench`.

Không dùng các phần legacy này làm hướng thiết kế mới.
