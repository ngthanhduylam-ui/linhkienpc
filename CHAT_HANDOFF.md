# VI TÍNH PHƯỚC TÀI POS - CHAT HANDOFF

Cập nhật gần nhất: **23/06/2026**

Tài liệu này dùng để mở chat Codex mới và tiếp tục dự án mà không cần đọc lịch sử chat cũ. Khi nội dung mâu thuẫn, ưu tiên code, migrations, routes và `git status` hiện tại.

## 1. Project Summary

Tên dự án: **VI TÍNH PHƯỚC TÀI POS**

Triết lý:

```text
POS First
Offline First
Self-Hosted
Sapo-inspired workflow
Stability First
Not an ERP
```

Kho hỗ trợ bán hàng. Hệ thống không phát triển theo hướng ERP hoặc phần mềm kho thuần túy.

Thứ tự ưu tiên:

1. Bán tại quầy.
2. Khách hàng.
3. Bảo hành.
4. Công nợ khi có phase riêng.
5. Kho hỗ trợ bán hàng.
6. Báo cáo sau khi ổn định.

## 2. Core Business Rules

- SKU unique, chỉ gồm chữ thường, số và dấu chấm.
- Tồn chỉ đổi qua stock-in, stock-out hoặc inventory-check.
- `product_inventory_balances` là tổng tồn hiện tại.
- Warranty group/tình trạng chỉ quản lý tồn, không phải bảng giá.
- Same SKU + same warranty group merge trong POS; khác group là dòng riêng.
- `sale_note` riêng theo dòng và không tham gia merge key/tính tồn.
- Backend là nguồn validate tồn và snapshot tiền.
- Public không trả giá, snapshot tiền hoặc sale note.
- Stock voucher là phiếu nghiệp vụ/bảo hành, không phải invoice thanh toán.

## 3. Current Production Environment

```text
Domain:           https://vitinhphuoctai.duckdns.org
OS:               Ubuntu self-hosted
Repo:             /opt/linhkienpc/linhkienpc
Branch:           codex-dev
Frontend:         Nginx
Backend:          PM2 process linhkienpc-api
Backend bind:     127.0.0.1:3000
Database:         MySQL localhost
Product uploads:  /opt/linhkienpc/uploads/products
```

Đã có:

- HTTPS/Certbot.
- UFW.
- DuckDNS cron.
- MySQL backup 23:00 hằng ngày, giữ 14 ngày.

Chưa có:

- Backup ảnh tự động sang HDD riêng.
- Xác nhận restore end-to-end hoàn chỉnh.

Không ghi hoặc in secret/.env.

## 4. Current Architecture

```text
Browser
  -> Nginx (HTTPS, frontend/dist)
  -> /api/v1 reverse proxy
  -> Express under PM2 at 127.0.0.1:3000
  -> MySQL localhost
```

Frontend:

- React 18, Vite, React Router, TailwindCSS.
- API client hỗ trợ `VITE_API_BASE_URL=/api/v1` và URL tuyệt đối.
- Access/refresh token hiện lưu localStorage.

Backend:

- Node.js 18+, Express, MySQL.
- JWT access/refresh, bcrypt.
- `trust proxy = loopback`.
- Login limiter memory store, phù hợp một PM2 instance.

## 5. Database and Migrations

Migration hiện có: `001` đến `020`.

Quan trọng:

- `018_add_phase_2a_sale_price_snapshot_schema.sql`
  - `products.sale_price`
  - `stock_vouchers.total_amount`
  - tạo `stock_voucher_items`
- `019_add_sale_note_snapshot_to_stock_voucher_items.sql`
  - `sale_note_snapshot`
- `020_create_product_images.sql`
  - `product_images`

Nguồn tồn:

```text
product_inventory_balances
```

Ledger group:

```text
stock_transactions
inventory_note_adjustments
inventory_quantity_adjustments
```

Snapshot phiếu:

```text
stock_vouchers
stock_voucher_items
```

Legacy, không phải workflow chính:

```text
warranty_batches
inventory_balances
```

## 6. Important Routes and APIs

Frontend:

```text
/                                      Public Lookup
/admin/login
/admin/products
/admin/products/new
/admin/products/:id/edit
/admin/stock-in
/admin/stock-out
/admin/inventory-check
/admin/customers
/admin/customers/:id
/admin/suppliers
/admin/transaction-history
/admin/transaction-history/:voucherId
/admin/transaction-history/:voucherId/print
```

Public API:

```text
GET /api/v1/health
GET /api/v1/public/products
GET /api/v1/public/products/:sku/inventory
GET /api/v1/public/products/:sku/images
GET /api/v1/public/categories
```

Admin API quan trọng:

```text
POST /api/v1/admin/auth/login
GET  /api/v1/admin/products
POST /api/v1/admin/stock-in/bulk
POST /api/v1/admin/stock-out/bulk
GET  /api/v1/admin/inventory-check/products/:sku
POST /api/v1/admin/inventory-check/note-move
POST /api/v1/admin/inventory-check/quantity-adjust
GET  /api/v1/admin/stock-vouchers
GET  /api/v1/admin/stock-vouchers/:id
```

## 7. Completed Features

- Admin authentication, refresh flow và login rate limit.
- Product/category CRUD, validation và category suggestion từ SKU.
- Multi-token product search.
- Product images: upload/replace/reorder/delete/download/gallery.
- Customers và suppliers.
- Bulk stock-in.
- Full-screen POS bulk stock-out.
- Inventory Check note move và quantity adjustment.
- Voucher history/detail.
- Sale price snapshot và sale note snapshot.
- A4 sale voucher print.
- Public Lookup.

## 8. POS Current Behavior

- Route `/admin/stock-out`, không dùng AdminLayout.
- Hỗ trợ nhiều order tab local; hiện chưa có giới hạn số tab rõ ràng trong code.
- Server-side product search, debounce và request sequence guard.
- Recent products khi input rỗng.
- Thumbnail, tồn, warranty groups và giá tham chiếu.
- Cart merge theo SKU + warranty group.
- Serial/Ghi chú tối đa 500 ký tự theo row.
- Đơn giá, thành tiền, tổng tiền hiện chỉ đọc.
- Submit payload chỉ có customer optional và item SKU/quantity/warranty note/sale note.
- Backend lấy `products.sale_price` và snapshot.
- Chưa có Bán & In.

## 9. Public Lookup Current Behavior

- UI `/`.
- Gọi `GET /api/v1/public/products?q=...`.
- Empty search không trả toàn bộ.
- Multi-token AND trên tên, SKU và warranty note.
- Chỉ hiện product active có total quantity > 0.
- Product tồn 0 hoặc thiếu balance bị ẩn.
- Khi tồn tăng lại > 0 sẽ tự xuất hiện.
- Public detail SKU active tồn 0 hiện vẫn hoạt động để tương thích.
- Không trả giá hoặc sale note.

## 10. Inventory Check Current Behavior

- Xem total và group quantities.
- Note move chuyển group trong một transaction, total không đổi.
- Quantity adjustment tăng/giảm total và selected group.
- Balance được lock trước khi tính group ledger.
- `from_quantity/to_quantity` là group quantity.
- Concurrent increase đã test không lost update.
- Incident production product ID 1 đã được ghi nhận sửa về:

```text
total = 1
BH 7.28 = 1
```

## 11. Product Images

- Tối đa 3 ảnh/product.
- File gốc giữ nguyên.
- Thumbnail WebP 720px.
- `sort_order=1` là ảnh chính.
- Product list/POS/Public Lookup dùng thumbnail.
- Public gallery cho download file gốc.
- Upload root production nằm ngoài Git repo.

## 12. Known Constraints

- Không có giá nhập.
- Không có discount/payment/debt/invoice/reporting.
- POS price chưa editable.
- Multi-order chưa persist sau reload.
- Print chỉ hỗ trợ voucher OUT.
- Rate limiter dùng memory store.
- Database backup không bao gồm ảnh.
- Compatibility search nâng cao chưa có.

## 13. Dirty Files / Git Notes

Trước mỗi task phải chạy:

```text
git branch --show-current
git status --short
git log -1 --oneline
```

Tại thời điểm viết tài liệu, branch là `codex-dev`. Task tài liệu đang sửa Markdown và tạo file handoff; không được tự revert thay đổi người dùng.

Các commit gần nhất cần biết:

```text
060d401 fix(public): hide out-of-stock products from lookup
917210f fix(inventory): keep quantity adjustments consistent
e5540f8 fix(pos): search products across all inventory
6294e46 feat(products): add product image gallery
4061eed fix(search): support multi-token product queries
```

## 14. Deployment Commands

Không tự chạy deploy.

```bash
cd /opt/linhkienpc/linhkienpc
git status --short
git rev-parse HEAD
/home/vitinhphuoctai/backup_linhkienpc.sh
git pull --ff-only origin codex-dev

cd backend
npm install
npm run migrate
pm2 restart linhkienpc-api

cd ../frontend
npm install
VITE_API_BASE_URL=/api/v1 npm run build
sudo nginx -t
sudo systemctl reload nginx
```

Chỉ chạy migration/restart phần thực sự thay đổi.

## 15. Testing Checklist

- Branch/status sạch hoặc hiểu rõ dirty files.
- Migration runner skip file đã chạy.
- Backend syntax checks.
- Frontend build.
- Admin login/refresh.
- Product CRUD/search/images.
- Public search: active in-stock only; không lộ giá.
- POS search ngoài page đầu, recent products, sale và rollback.
- Inventory Check note move, quantity adjustment và concurrency.
- Voucher list/detail/print.
- `git diff --check`.

## 16. Known Backlog

- Discount VND theo dòng.
- Discount toàn đơn.
- Giá nhập.
- Payment, khách đưa, tiền thừa.
- Công nợ.
- Lợi nhuận và báo cáo tài chính.
- Draft persistence.
- Bán & In.
- Mẫu in IN và cấu hình logo.
- Compatibility search nâng cao.
- Backup ảnh tự động.

Không làm:

- Giá cố định theo warranty group.
- Bảng giá lái cố định theo hướng hiện tại.
- Discount phần trăm theo quyết định hiện tại.

## 17. NEXT TASK: Manual VND Discount Per POS Line

Đây là task tiếp theo cần khảo sát và thiết kế trước khi code:

- Kiểm tra schema `sale_price` và snapshot hiện tại.
- Dùng giá product làm giá tham chiếu.
- Warranty group chỉ quản lý tồn.
- Click đơn giá tại POS mở popup/dropdown nhỏ kiểu Sapo.
- Người bán nhập `discount_amount` bằng số tiền VND.
- `discount_amount` là số tiền giảm trên mỗi đơn vị sản phẩm của dòng hàng, không phải tổng số tiền giảm của cả dòng.
- Không dùng phần trăm.
- Đơn giá cuối = giá tham chiếu - `discount_amount`.
- Thành tiền dòng = đơn giá cuối x số lượng.
- Tính lại line total và cart total an toàn bằng integer.
- Frontend gửi `discount_amount`; backend không tin `final_unit_price`, `line_total` hoặc `total_amount`.
- Backend tự đọc giá tham chiếu hợp lệ, validate `discount_amount`, rồi tự tính lại đơn giá cuối, thành tiền và tổng phiếu trước khi lưu snapshot.
- Cập nhật voucher detail và print.
- Giữ tương thích voucher cũ.
- Không làm payment, debt, cost hoặc bảng giá theo group trong task này.

Trước khi triển khai cần quyết định schema tối thiểu:

- Snapshot giá tham chiếu có cần field riêng hay `unit_price` sẽ là giá cuối.
- Field `discount_amount` theo dòng, mang nghĩa giảm giá trên mỗi đơn vị sản phẩm.
- Quy tắc giá null, discount vượt giá và giá cuối bằng 0.
- Contract request để backend là nguồn tính cuối cùng.

## 18. Rules for Future Codex Work

1. Đọc `PROJECT_RULES.md` và file task trước khi sửa.
2. Xác nhận branch/status.
3. Không dùng tài liệu cũ thay cho code.
4. Không sửa backend/database ngoài scope.
5. Không sửa dirty file ngoài task.
6. Test bằng dữ liệu disposable và cleanup.
7. Không in secret.
8. Không commit/push/deploy khi chưa được yêu cầu.
9. Nếu gặp bug thật ngoài scope, báo nguyên nhân trước khi mở rộng.
10. Không tuyên bố discount đã hoàn thành cho đến khi code, migration/API/UI và regression được duyệt.
