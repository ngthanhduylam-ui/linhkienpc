# Kiến Trúc

## Tổng quan

LINHKIENPC gồm một React app, một Express backend và một MySQL database.

```text
Frontend React
  -> API client
  -> Backend Express /api/v1
  -> MySQL
```

Frontend chịu trách nhiệm giao diện tra cứu công khai và màn hình admin. Backend chịu trách nhiệm xác thực, validate request, xử lý transaction tồn kho và lưu lịch sử.

## Frontend

Thư mục chính:

```text
frontend/src/api/          API client dùng fetch
frontend/src/components/   component dùng chung
frontend/src/contexts/     AuthContext
frontend/src/layouts/      AdminLayout
frontend/src/pages/        page theo route
frontend/src/services/     service gọi API
frontend/src/router.jsx    cấu hình React Router
```

Các route hiện có:

```text
/                              PublicSearchPage
/admin/login                   AdminLoginPage
/admin                         redirect /admin/stock-in
/admin/inventory-workbench     legacy redirect /admin/stock-in
/admin/products                ProductManagementPage
/admin/suppliers               SupplierListPage
/admin/customers               CustomerListPage
/admin/customers/:id           CustomerDetailPage
/admin/stock-in                StockInPage
/admin/stock-out               StockOutPage
/admin/transaction-history     TransactionHistoryPage
```

Auth frontend:

- `AuthContext.jsx` lưu admin state.
- Token lưu trong `localStorage` với key `access_token` và `refresh_token`.
- `apiClient.js` tự gắn `Authorization: Bearer <token>` nếu có access token.
- Khi API trả 401, `apiClient.js` gọi `/admin/auth/refresh`, lưu token mới và retry request một lần.
- Nếu refresh thất bại, token local bị xóa và browser chuyển về `/admin/login`.

## Backend

Thư mục chính:

```text
backend/src/app.js              Express app bootstrap
backend/src/server.js           start server và test database connection
backend/src/config/             env và MySQL pool
backend/src/middlewares/        auth, validation, error handler
backend/src/modules/            module theo domain
backend/src/routes/index.js     route loader chính
backend/src/utils/              AppError, JWT, password, parser
```

Module backend hiện có:

```text
auth              đăng nhập, refresh, logout, profile
category          danh mục
product           sản phẩm, public search, note groups
customer          khách hàng và lịch sử theo khách
supplier          nhà cung cấp
stockTransaction  nhập hàng, xuất hàng, lịch sử giao dịch
inventory         overview tồn kho
warrantyBatch     module lô bảo hành cũ, không phải workflow tồn kho chính hiện tại
```

Route backend được mount dưới `/api/v1`.

Public route không cần login:

- `GET /public/products`
- `GET /public/products/:sku/inventory`
- `GET /public/categories`
- `GET /health`

Admin route cần JWT, trừ auth:

- `/admin/auth/*`
- `/admin/categories/*`
- `/admin/products/*`
- `/admin/customers/*`
- `/admin/suppliers/*`
- `/admin/stock-in`
- `/admin/stock-out`
- `/admin/stock-transactions`
- `/admin/inventory`

## Workflow tồn kho hiện tại

Tồn kho chính dùng bảng `product_inventory_balances` theo từng sản phẩm.

Nhập hàng:

1. Admin chọn SKU.
2. Backend validate SKU tồn tại và sản phẩm đang active.
3. Validate số lượng là số nguyên dương.
4. Nếu có `supplier_id`, validate supplier tồn tại và active.
5. Lock dòng tồn kho bằng `SELECT ... FOR UPDATE`.
6. Cộng tồn trong `product_inventory_balances`.
7. Insert dòng `stock_transactions` với `txn_type = 'IN'`.
8. Commit transaction.

Xuất hàng:

1. Admin chọn SKU.
2. Backend validate SKU tồn tại và sản phẩm đang active.
3. Validate số lượng là số nguyên dương.
4. Nếu có `customer_id`, validate customer tồn tại và active.
5. Lock dòng tồn kho bằng `SELECT ... FOR UPDATE`.
6. Kiểm tra tổng tồn đủ xuất.
7. Nếu sản phẩm có nhóm ghi chú bảo hành còn tồn, bắt buộc chọn `warranty_note` hoặc note tương ứng.
8. Kiểm tra số lượng xuất không vượt tồn còn lại của nhóm ghi chú bảo hành đã chọn.
9. Trừ tồn trong `product_inventory_balances`.
10. Insert dòng `stock_transactions` với `txn_type = 'OUT'`.
11. Commit transaction.

## Ghi chú bảo hành

Không dùng `warranty_batches` làm đơn vị tồn kho trong UI hiện tại.

Ghi chú bảo hành được lấy từ `stock_transactions.note`:

- Stock In có note, ví dụ `BH04.28`.
- Stock Out chọn note group còn tồn và ghi cùng note vào transaction OUT.
- Remaining note group = tổng IN theo note - tổng OUT theo note.
- Chỉ trả về note group có remaining > 0.

## Error handling

Backend dùng response lỗi chuẩn:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": []
  },
  "meta": {
    "request_id": null,
    "server_time": "2026-06-02T10:00:00.000Z"
  }
}
```
