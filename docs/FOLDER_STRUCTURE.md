# Cấu trúc thư mục hiện tại

Tài liệu này mô tả cấu trúc repo thực tế của **VI TÍNH PHƯỚC TÀI POS**. Không dùng các tên page/module cũ như `/admin/batches` hoặc `Inventory Workbench` làm hướng chính.

## 1. Cấu trúc cấp cao

```text
linhkienpc/
├─ backend/              # Express API, auth, nghiệp vụ tồn kho/POS
├─ database/             # schema, migrations, seed, script SQL
├─ docs/                 # tài liệu dự án
├─ frontend/             # React + Vite frontend
├─ backups/              # backup thủ công/local nếu có
├─ README.md             # landing page repo
└─ PROJECT_RULES.md      # quy tắc an toàn cố định
```

## 2. Frontend

```text
frontend/
├─ index.html
├─ package.json
├─ vite.config.js
├─ tailwind.config.js
└─ src/
   ├─ api/               # apiClient, refresh token handling
   ├─ components/        # shared UI components
   ├─ contexts/          # AuthContext
   ├─ layouts/           # AdminLayout
   ├─ pages/             # route pages
   ├─ services/          # API service wrappers
   ├─ utils/             # format/normalization helpers
   └─ router.jsx         # React Router config
```

Route pages chính:

- `PublicSearchPage.jsx` -> `/`
- `AdminLoginPage.jsx` -> `/admin/login`
- `ProductManagementPage.jsx` -> `/admin/products`
- `ProductFormPage.jsx` -> `/admin/products/new`, `/admin/products/:id/edit`
- `StockInBulkPage.jsx` -> `/admin/stock-in`
- `StockOutBulkPage.jsx` -> `/admin/stock-out`
- `InventoryCheckPage.jsx` -> `/admin/inventory-check`
- `CustomerListPage.jsx` -> `/admin/customers`
- `SupplierListPage.jsx` -> `/admin/suppliers`
- `TransactionHistoryPage.jsx` -> `/admin/transaction-history`
- `TransactionVoucherDetailPage.jsx` -> `/admin/transaction-history/:voucherId`

## 3. Backend

```text
backend/
├─ package.json
├─ .env.example
├─ scripts/
│  ├─ migrate.js
│  └─ seed.js
└─ src/
   ├─ app.js
   ├─ server.js
   ├─ config/
   ├─ middlewares/
   ├─ modules/
   ├─ routes/
   └─ utils/
```

Modules backend chính:

- `auth`
- `category`
- `product`
- `customer`
- `supplier`
- `stockTransaction`
- `stockVoucher`
- `inventory`
- `inventoryCheck`
- `warrantyBatch` legacy, không phải workflow UI chính

## 4. Database

```text
database/
├─ migrations/           # migration chạy theo thứ tự số
├─ schema/               # schema SQL theo bảng và file tổng hợp schema.sql
├─ seeds/                # seed SQL
└─ scripts/              # script SQL vận hành/test
```

Lưu ý:

- `database/schema/schema.sql` là file tổng hợp `SOURCE` các schema con.
- Migration hiện là nguồn setup chính khi chạy `npm run migrate`.

## 5. Documentation

Tài liệu chính:

- `docs/PROJECT_DIRECTION.md`
- `docs/PROJECT_STATUS.md`
- `docs/POS_SCREEN_GUIDE.md`
- `docs/CHANGELOG_POS.md`
- `docs/ARCHITECTURE.md`
- `docs/BUSINESS_RULES.md`
- `docs/API.md`
- `docs/DATABASE.md`
- `docs/DEPLOYMENT.md`
- `docs/FOLDER_STRUCTURE.md`

Root docs:

- `README.md`
- `PROJECT_RULES.md`

Backend docs:

- `backend/README.md`

## 6. Legacy Notes

- `/admin/inventory-workbench` hiện redirect về `/admin/stock-in`.
- `/admin/stock-out-bulk` hiện redirect về `/admin/stock-out`.
- `StockInPage.jsx` và `StockOutPage.jsx` là page single/legacy, không phải workflow chính.
- `warrantyBatch` backend/database còn tồn tại nhưng UI hiện tại dùng nhóm bảo hành / ghi chú từ stock transactions.
