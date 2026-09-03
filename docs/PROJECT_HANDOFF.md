# Project Handoff — VI TÍNH PHƯỚC TÀI POS

> Cập nhật: **03/09/2026**
> Branch local đã audit: `release/chotot-vnd`
> DEV HEAD đã audit: `054ac4f feat: expand recent stock updates`

Tài liệu này là nguồn tiếp quản kỹ thuật/nghiệp vụ khi không còn conversation context. Nội dung “source-confirmed” được đối chiếu trực tiếp từ repo. Các thông tin production/network không có trong repo được ghi rõ là **Operational baseline / production convention**.

## 1. Product philosophy

```text
POS First
Nhanh, ít bước, phù hợp thao tác tại quầy
Search → Select → Confirm
Inventory supports sales
Not an ERP
```

Priority nghiệp vụ: bán tại quầy → khách hàng → bảo hành → công nợ → hỗ trợ tồn kho → báo cáo. Công nợ/tài chính/reporting đang deferred; không ghép vào task POS nhỏ.

## 2. Kiến trúc hiện tại

```text
Browser
  ├─ Public Lookup (/), không login
  └─ Admin/POS, ProtectedRoute + bearer access token
       ↓
Nginx (production convention: HTTPS + frontend/dist + /api/v1 proxy)
       ↓
Express /api/v1 (source: trust proxy = loopback)
       ↓
MySQL + filesystem product images
```

- Frontend: React/Vite, route-based lazy loading, services qua `frontend/src/api/apiClient.js`.
- Backend: Express modules theo domain; `backend/src/routes/index.js` tách Public và Admin.
- Admin API dùng `requireAuth`; toàn namespace `/admin` có `Cache-Control: no-store`.
- Database changes chạy qua migration files và `backend/scripts/migrate.js`.
- Total stock authoritative: `product_inventory_balances.quantity`.
- Inventory groups được dựng từ stock transactions, note moves và quantity adjustments trong `backend/src/utils/inventoryNoteGroups.js`.

## 3. Status matrix

| Feature | Status | Notes |
|---|---|---|
| Product/category management | DONE | CRUD, active state, images, SKU/category rules. |
| Stock In | DONE | Bulk + single route, supplier optional, note/warranty group. |
| POS `/admin/stock-out` | DONE | Full-screen, multi-order in-memory tabs, cart, customer, pricing/snapshots, print handoff. |
| Inventory Check | DONE | Search, note move, quantity adjust, histories; responsive/container-driven UI. |
| Customers/Suppliers | DONE | CRUD/list/detail flows hiện có; chưa có debt ledger. |
| Voucher history/detail/print | DONE | Snapshot-based detail; print bằng dynamic voucher data + HTML/CSS + `window.print()`. |
| Public Lookup | DONE | Anonymous catalogue/search/inventory/images; no checkout. |
| Public recent stock | DONE | Table-only, limit 14, rolling 168h. |
| Quick Notes | DONE | CRUD/status/filter page + floating draggable widget. |
| Auth hardening checkpoints | CLOSED | Cookie refresh, rotation/family/reuse, auth version, no-store, validation/rate limits. |
| Print settings/editor/draft | DONE | System/custom config and experimental Builder Draft storage/editor exist. |
| Print-template runtime integration | DEFERRED | Current print page does not consume stored template settings; Builder migration explicitly says draft does not activate/render. |
| `CHOTOT-HELPER-1` | PENDING | Source flow active, but production `.com` origin matching is not complete in helper/extension config. |
| Customer debt/finance/reporting | DEFERRED | Không có payment/debt/cost/accounting architecture hoàn chỉnh. |

Không tự reopen checkpoint security đã **CLOSED** nếu không có bug/evidence mới.

## 4. Public Lookup rules

Public Lookup là catalogue/tra cứu linh kiện và tồn kho, không phải storefront checkout.

### Search and visibility

- `GET /api/v1/public/products` hỗ trợ multi-token AND, tối đa 8 token.
- Raw match trên name/SKU; compact match bỏ `.`, `-`, space. SKU chỉ được inspect nội bộ, không serialize ra Public DTO.
- Warranty-note lookup dùng ledger note để search; category browsing dùng `category_id` thật.
- Chỉ product `is_active = 1` và `total stock > 0` được public.
- Direct inventory by SKU và public image metadata/bytes cũng enforce active + positive stock.
- Admin product search vẫn thấy zero-stock theo filter hiện có.
- Public price luôn trình bày `Liên hệ`; `sale_price` bị loại tại controller DTO, không chỉ ẩn ở UI.
- Public detail có `spec_summary`, note groups, total stock và image URLs; public image response không lộ original private filename.

### Public UI

- Card/Table là global presentation preference cho search/category result sets.
- Category strip ẩn Laptop khỏi top navigation nhưng không loại Laptop khỏi search/random/detail.
- Mouse drag category: threshold `6px`, drag xong suppress click; pointer touch tiếp tục native horizontal scroll.
- Footer hiện tại:
  - Tra cứu sản phẩm — Nhanh chóng, dễ tìm.
  - Kiểm tra tồn kho — Cập nhật theo hệ thống.
  - Hình ảnh sản phẩm — Xem trực tiếp trên web.
  - Giờ hoạt động — 08:00 - 21:00 (T2 - CN).

### Vừa cập nhật kho

Endpoint: `GET /api/v1/public/recent-stock-updates`.

```text
UI:              table-only
limit:           14
rolling window:  168 giờ
sort:            newest → oldest
dedupe:          product, lấy eligible event mới nhất
```

Eligible: product creation, stock IN, Inventory Check có `from_quantity <> to_quantity`.

Không eligible: stock OUT, metadata edit, Inventory Check không đổi quantity.

Public filter vẫn là active + positive stock. DTO không expose `sale_price`, cost, supplier, admin/user, transaction ID, delta hoặc event type. Table chỉ có `Sản phẩm | Tình trạng | Tồn kho | Cập nhật`.

`Có thể bạn đang cần` là flow riêng: 5 sản phẩm random dạng card; không gộp với recent-stock.

## 5. POS, stock và inventory

### POS

- `/admin/stock-out` nằm ngoài `AdminLayout`, nhưng vẫn dưới `ProtectedRoute`.
- Không thêm confirm-sale modal; flow ưu tiên nhanh tại quầy.
- Không yêu cầu phím tắt kiểu F3/F10.
- Multi-order tabs là state local/in-memory; không coi draft persistence qua reload là feature hiện tại.
- Cart row giữ product, warranty group, serial/sale note, quantity, price editor và line totals.
- Backend là nguồn sự thật cho reference price, discount, unit price, line total và voucher total.
- Voucher lưu snapshot để lịch sử/print không phụ thuộc product hiện tại.

### Inventory mutation

- Stock chỉ thay đổi qua stock-in, stock-out hoặc inventory-check quantity adjustment.
- Các mutation quan trọng dùng transaction/locking trong service.
- Inventory Check note move không đổi total; quantity adjustment cập nhật balance và history.
- Search Inventory Check dùng token AND và compact normalization giống product search.

### Warranty/note casing

Rule dữ liệu mới:

```text
Người dùng nhập → trim đầu/cuối → lưu/hiển thị nguyên case
```

`normalizeNoteKey()` vẫn uppercase/remove internal spaces để grouping, lookup, case-insensitive matching và allocation; normalized key không được dùng làm display/storage note. Stock-out lấy canonical `cleanNote(selectedGroup.note)` cho transaction và voucher snapshot. No-note tiếp tục lưu `NULL`.

Dữ liệu lịch sử từng bị uppercase/normalize không được backfill tự động vì không thể suy ra casing/khoảng trắng gốc.

## 6. Quick Notes — Sổ nhanh

- Backend table `quick_notes`, migration `026_create_quick_notes.sql`.
- Admin-only CRUD tại `/api/v1/admin/quick-notes`.
- Content trim đầu/cuối, tối đa 500 ký tự; status pending/processed và `processed_at`.
- `/admin/quick-notes` có filter, timeline theo ngày, cảnh báo note cũ chưa xử lý.
- `QuickNoteWidget` xuất hiện trong Admin và POS (trừ trang Quick Notes), góc dưới phải mặc định.
- Widget/panel kéo bằng pointer/header; vị trí chỉ giữ trong React state của session trang. Source không ghi tọa độ vào localStorage/DB; reload về vị trí mặc định.

## 7. Print and templates

- Route print: `/admin/transaction-history/:voucherId/print`.
- Renderer hiện tại là React/HTML/CSS với voucher data động và `window.print()`, không tạo PDF cố định.
- Hướng nghiệp vụ: `Phiếu bán & giao hàng`, A4/A5; source renderer hiện tại và template schema đang A4 portrait.
- `saleDeliveryNoteTemplate.js` cung cấp immutable system config và strict validation cho custom config.
- `print_template_settings` lưu active selection/custom config; Builder Draft có revision/conflict validation.
- Migration `025` ghi rõ Builder Draft **không tự activate hoặc render**.
- `TransactionVoucherPrintPage.jsx` hiện không import print-template settings service; runtime integration/fallback của custom template chưa được coi là complete.
- Khi tiếp tục: system template phải immutable; custom/draft invalid phải có error/fallback rõ; không thay bằng PDF cố định nếu chưa có quyết định mới.

## 8. Auth/security baseline

### Source-confirmed

- Access JWT chỉ giữ trong memory (`authTokenStore.js`); legacy `localStorage` access/refresh keys được dọn.
- Refresh JWT ở host-only HttpOnly cookie `pt_admin_refresh`, path `/api/v1/admin/auth`, SameSite Lax; Secure khi `NODE_ENV=production`.
- Refresh token lưu hash, rotate theo family/JTI, có race grace và reuse-family revocation.
- `auth_version` invalidates access/refresh state khi thay đổi.
- JWT verify khóa issuer, HS256 algorithm và `token_use`.
- Password dùng bcrypt 6.
- Admin routes có auth; Admin namespace `no-store`.
- CORS/auth-origin lấy từ `AUTH_ALLOWED_ORIGINS`; source default production là đúng một origin `https://vitinhphuoctai.com` nếu env không override.
- `helmet()` global; unexpected errors được sanitize thành generic 500.
- Public data limiter: 600 request/5 phút/IP cho product search, direct inventory và recent-stock; suggestions 120 request/5 phút/IP. Categories/images/health không bị limiter này.
- Image upload: tối đa 5 file, 15 MB/file mặc định, JPEG/PNG/WebP, cap 20 MP, thumbnail WebP trong 720×720; Sharp decode có `limitInputPixels` defense-in-depth.
- Public image list/thumbnail/download enforce active + positive stock; public filename được tạo generic.
- Public API không serialize selling price.

### Operational baseline / production convention

CSP/HSTS/security headers và exact production CORS were previously closed and production health was verified. Repo chỉ chứng minh `helmet()` và source defaults; Nginx config/runtime env không nằm trong repo này. Khi có evidence mới, kiểm runtime header/config thay vì suy đoán.

## 9. Chợ Tốt helper

Source hiện có hai đường:

1. `OnlineListingPage` gọi local helper `http://127.0.0.1:17321`: `/health`, `/v1/progress`, `/v1/prepare-listing`.
2. Nếu helper offline/fetch fail, page dùng `window.postMessage` để fallback sang Chrome extension.

Helper Playwright bind loopback, dùng Chrome profile riêng, chuẩn bị form và dừng trước final submit. Extension cũng không auto-submit.

`CHOTOT-HELPER-1` vẫn **PENDING** vì:

- helper `allowedCorsOrigins`/`allowedPosOrigins` còn domain DuckDNS cũ + localhost;
- extension manifest chỉ match localhost/127.0.0.1 cho POS, chưa match `https://vitinhphuoctai.com`;
- UI copy còn mô tả một số POC behavior cũ.

Không claim production helper integration complete. Task tiếp theo phải verify/update exact production origin và helper/extension matching, có test browser cụ thể; không sửa helper trong task không liên quan.

## 10. Important modules/files

| Area | Files |
|---|---|
| App/routes/env | `backend/src/app.js`, `backend/src/routes/index.js`, `backend/src/config/env.js` |
| Auth | `backend/src/modules/auth/*`, `backend/src/utils/jwt.js`, `frontend/src/auth/*`, `frontend/src/api/apiClient.js` |
| Products/Public | `backend/src/modules/product/*`, `frontend/src/pages/PublicSearchPage.jsx`, `frontend/src/services/publicSearch.service.js` |
| Images | `backend/src/modules/productImage/*` |
| Stock/POS | `backend/src/modules/stockTransaction/*`, `frontend/src/pages/StockInBulkPage.jsx`, `frontend/src/pages/StockOutBulkPage.jsx` |
| Inventory Check | `backend/src/modules/inventoryCheck/*`, `frontend/src/pages/InventoryCheckPage.jsx` |
| Inventory groups | `backend/src/utils/inventoryNoteGroups.js`, `frontend/src/utils/warrantyNote.js` |
| Quick Notes | `backend/src/modules/quickNote/*`, `frontend/src/components/quickNotes/*`, `frontend/src/pages/QuickNotesPage.jsx` |
| Print | `backend/src/modules/printTemplateSetting/*`, `frontend/src/pages/PrintTemplate*`, `frontend/src/pages/TransactionVoucherPrintPage.jsx` |
| Online listing | `frontend/src/pages/OnlineListingPage.jsx`, `tools/chotot-posting-helper/`, `chrome-extension/chotot-listing-helper/` |
| DB | `database/migrations/`, `database/schema/`, `backend/scripts/migrate.js` |

## 11. Deferred/backlog

- Customer debt, supplier debt, payments, cost price, margin/profit and accounting reports: **DEFERRED**.
- SKU compatibility improvements: **BACKLOG**, chỉ làm khi có sample thật/reproduction rõ.
- Future print refinements/A5/runtime custom renderer: **BACKLOG/DEFERRED**.
- POS draft persistence across reload: không active; chỉ reopen bằng task riêng với browser acceptance tests.
- Không invent deadline.

## 12. Working conventions

- Audit source trước; không suy luận chỉ từ commit message.
- Preserve unrelated working-tree changes/untracked files.
- Không dùng `git add .` hoặc `git add ..`; stage explicit task files.
- Không SSH/deploy/migrate/commit/push nếu user chưa yêu cầu riêng.
- Tất cả migration cần backup + exact approved migration list.
- Test theo scope, sau đó full backend/frontend và production build khi task yêu cầu.
- Production dùng selective cherry-pick; xem [`PRODUCTION_RECOVERY.md`](PRODUCTION_RECOVERY.md).

## 13. Known documentation conflicts

Các file cũ `docs/PROJECT_STATUS.md`, `docs/DEPLOYMENT.md` và một phần `docs/ARCHITECTURE.md` có thông tin lịch sử như DuckDNS, `codex-dev`, migration chỉ tới 022 và token trong localStorage. Source hiện tại và bộ tài liệu handoff này supersede các chi tiết đó. Không tự đoán giá trị production khác ngoài operational baseline.
