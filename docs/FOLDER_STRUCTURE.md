# Cấu trúc thư mục hiện tại

Cập nhật gần nhất: **26/06/2026**

```text
linhkienpc/
├─ backend/             Express API
├─ database/            migrations, schema, seeds, SQL scripts
├─ docs/                tài liệu dự án
├─ frontend/            React/Vite application
├─ backups/             backup local nếu có
├─ CHAT_HANDOFF.md      tài liệu bàn giao chat
├─ PROJECT_RULES.md
└─ README.md
```

## Frontend

```text
frontend/src/
├─ api/apiClient.js
├─ components/
├─ contexts/AuthContext.jsx
├─ layouts/AdminLayout.jsx
├─ pages/
├─ services/
├─ utils/
└─ router.jsx
```

Pages chính:

- `PublicSearchPage.jsx`
- `ProductManagementPage.jsx`
- `ProductFormPage.jsx`
- `StockInBulkPage.jsx`
- `StockOutBulkPage.jsx`
- `InventoryCheckPage.jsx`
- `CustomerListPage.jsx`
- `CustomerDetailPage.jsx`
- `SupplierListPage.jsx`
- `TransactionHistoryPage.jsx`
- `TransactionVoucherDetailPage.jsx`
- `TransactionVoucherPrintPage.jsx`

`StockInPage.jsx` và `StockOutPage.jsx` là single/legacy pages. Route chính dùng bulk pages.

## Backend

```text
backend/
├─ scripts/
│  ├─ migrate.js
│  └─ seed.js
├─ uploads/             default local upload root
└─ src/
   ├─ app.js
   ├─ server.js
   ├─ config/
   ├─ middlewares/
   ├─ modules/
   ├─ routes/
   └─ utils/
```

Modules:

```text
auth
category
customer
inventory
inventoryCheck
product
productImage
stockTransaction
stockVoucher
supplier
warrantyBatch
```

Các file `*.edit-master-data-backup` và `*.delivery-note-backup` là bản backup code cũ trong repo, không phải module runtime.

## Database

```text
database/
├─ migrations/          001..022
├─ schema/              schema từng bảng + schema.sql
├─ seeds/
└─ scripts/
```

Migration runner dùng `database/migrations`; `database/schema` là schema nguồn/tổng hợp tham chiếu.

## Documentation

```text
README.md
PROJECT_RULES.md
CHAT_HANDOFF.md
backend/README.md
docs/api.md
docs/ARCHITECTURE.md
docs/BUSINESS_RULES.md
docs/CHANGELOG_POS.md
docs/database.md
docs/DEPLOYMENT.md
docs/FOLDER_STRUCTURE.md
docs/POS_SCREEN_GUIDE.md
docs/PROJECT_DIRECTION.md
docs/PROJECT_STATUS.md
```

## Redirect/legacy routes

- `/admin/inventory-workbench` -> `/admin/stock-in`
- `/admin/stock-out-bulk` -> `/admin/stock-out`
- `/admin/stock-in-single` và `/admin/stock-out-single` vẫn tồn tại.
- `warrantyBatch` còn được mount để tương thích nhưng không phải workflow chính.
