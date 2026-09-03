# VI TÍNH PHƯỚC TÀI POS

> Cập nhật gần nhất: **03/09/2026**
> Branch phát triển: `release/chotot-vnd`
> Tài liệu tiếp quản nhanh: [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md)

Ứng dụng POS tự host cho cửa hàng linh kiện/PC **VI TÍNH PHƯỚC TÀI**. Hệ thống ưu tiên thao tác tại quầy nhanh, ít bước và dữ liệu tồn kho chính xác; đây không phải ERP tổng quát.

## Triết lý cốt lõi

```text
POS First
Self-Hosted
Search → Select → Confirm
Stability First
Not an ERP
```

Thứ tự ưu tiên nghiệp vụ:

1. Bán tại quầy.
2. Quản lý khách hàng.
3. Theo dõi bảo hành.
4. Công nợ.
5. Hỗ trợ tồn kho.
6. Báo cáo.

Các mục 4–6 vẫn phải được mở theo phase riêng; không làm nặng flow bán hàng hiện tại.

## Đọc gì trước

- [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md): “save game” ngắn khi mất toàn bộ chat context.
- [`docs/PROJECT_HANDOFF.md`](docs/PROJECT_HANDOFF.md): kiến trúc, quyết định nghiệp vụ, trạng thái feature và file quan trọng.
- [`docs/PRODUCTION_RECOVERY.md`](docs/PRODUCTION_RECOVERY.md): baseline production, kiểm tra và selective cherry-pick an toàn.
- [`docs/BUSINESS_RULES.md`](docs/BUSINESS_RULES.md), [`docs/database.md`](docs/database.md), [`docs/API.md`](docs/API.md): tài liệu nền; đối chiếu source nếu có khác biệt.

Một số tài liệu cũ còn nhắc DuckDNS, branch `codex-dev` hoặc auth bằng `localStorage`. Các chi tiết đó là lịch sử, không phải current baseline. Dùng ba tài liệu tiếp quản ở trên làm nguồn ưu tiên.

## Stack

- Frontend: React 18.3.1, React Router 7.18.2, Vite 5, Tailwind CSS.
- Backend: Node.js, Express 4, MySQL, JWT, bcrypt 6, Sharp 0.35.3.
- Ảnh sản phẩm: filesystem cho originals/thumbnails; MySQL lưu metadata.
- Production baseline: Nginx phục vụ frontend và reverse proxy `/api/v1`; backend chạy PM2 ở loopback.

## Cấu trúc repo

```text
backend/
  src/
    config/          env + MySQL pool
    middlewares/     auth, no-store, rate limits, error handling
    modules/         business modules theo domain
    routes/          /api/v1 route composition
    utils/           JWT, AppError, inventory note grouping
  scripts/           migrate/seed và maintenance scripts
database/
  migrations/        001 ... 027
  schema/            canonical table definitions
frontend/
  src/
    api/             shared API client
    auth/            in-memory access token + refresh coordination
    components/      Admin/Public/shared UI
    layouts/         AdminLayout
    pages/           route pages
    services/        API wrappers
    utils/           presentation/state helpers + focused tests
chrome-extension/    Chợ Tốt extension POC
tools/               local helper/tools; không phải backend production
docs/                architecture, recovery và handoff
```

## Feature chính

- `/admin/stock-out`: POS full-screen, multi-order tabs trong memory, product/customer search, warranty group, serial/ghi chú, giá/snapshot và in phiếu.
- `/admin/stock-in`: nhập hàng bulk, supplier optional, nhóm bảo hành/ghi chú.
- `/admin/inventory-check`: tìm kiếm multi-token/compact, chuyển nhóm note và điều chỉnh số lượng có lịch sử.
- `/admin/products`: quản lý sản phẩm/category/SKU rule/ảnh tối đa 5 ảnh.
- `/admin/customers`, `/admin/suppliers`, `/admin/transaction-history`.
- `/admin/quick-notes`: Sổ nhanh và widget nổi trong Admin/POS.
- `/admin/settings/print-template`: cấu hình/editor/draft mẫu in; xem trạng thái integration trong handoff.
- `/`: Public Lookup không cần login, phục vụ catalogue/tra cứu linh kiện và tồn kho, không phải checkout storefront.

## Chạy local

Yêu cầu: Git, Node.js `>=18` (theo `backend/package.json`) và MySQL local.

```powershell
git clone -b release/chotot-vnd https://github.com/ngthanhduylam-ui/linhkienpc.git
cd linhkienpc

cd backend
npm install
Copy-Item .env.example .env
```

Tạo database local và cấu hình `.env`. Chỉ với database local mới hoàn toàn, sau khi review:

```powershell
npm run db:setup
npm run dev
```

Terminal khác:

```powershell
cd frontend
npm install
npm run dev
```

Frontend production dùng biến `VITE_API_BASE_URL`; source production hiện đặt base tương đối `/api/v1`.

### Tên biến môi trường backend

Không ghi giá trị thật vào tài liệu hoặc Git.

```text
NODE_ENV
HOST
PORT
APP_TIMEZONE
PRODUCT_UPLOAD_ROOT
PRODUCT_IMAGE_MAX_BYTES
PRODUCT_IMAGE_MAX_COUNT
DB_HOST
DB_PORT
DB_NAME
DB_USER
DB_PASSWORD
DB_CONNECTION_LIMIT
JWT_ACCESS_SECRET
JWT_ACCESS_EXPIRES_IN
JWT_REFRESH_SECRET
JWT_REFRESH_EXPIRES_IN
AUTH_REFRESH_REUSE_GRACE_MS
AUTH_ALLOWED_ORIGINS
DEFAULT_ADMIN_USERNAME
DEFAULT_ADMIN_PASSWORD
DEFAULT_ADMIN_DISPLAY_NAME
```

## Test và build

```powershell
cd backend
node --test

cd ../frontend
node --test
npm run build

cd ..
git diff --check
git status --short
```

Migration runner là `backend/scripts/migrate.js`, ghi lịch sử vào `schema_migrations`. Không chạy migration trên production nếu chưa có task, backup và phê duyệt cụ thể.

## Route chính

```text
/                                      Public Lookup
/admin/login                           Admin login
/admin/stock-out                       Full-screen POS
/admin/stock-in                        Bulk stock-in
/admin/inventory-check                 Inventory Check
/admin/products                        Product Management
/admin/customers                       Customers
/admin/suppliers                       Suppliers
/admin/transaction-history             Voucher history
/admin/quick-notes                     Quick Notes
/admin/settings/sku-rules              SKU category rules
/admin/settings/print-template         Print-template settings
/admin/online-listing                  Chợ Tốt preparation UI
```

API được mount dưới `/api/v1`; health endpoint là `/api/v1/health`.

## Quy tắc Git và production

- Codex chỉ phân tích/sửa/test trong repo local; không SSH production.
- Chỉ stage file thuộc task. **Không bao giờ dùng `git add .` hoặc `git add ..`.**
- Không tự commit/push/deploy/migrate nếu chưa được yêu cầu rõ.
- Production deploy bằng selective cherry-pick commit đã duyệt, không `git pull` cả branch.
- Production hash có thể khác DEV hash vì cherry-pick tạo commit mới.
- Không ghi secrets, cookie/token values, password, API key hoặc nội dung `.env` vào tài liệu/log.

Xem workflow đầy đủ tại [`docs/PRODUCTION_RECOVERY.md`](docs/PRODUCTION_RECOVERY.md).
