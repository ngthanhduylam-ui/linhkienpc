# PROJECT_STATUS.md

# VI TÍNH PHƯỚC TÀI POS - Trạng thái hiện tại

Tài liệu này mô tả trạng thái thực tế của dự án ở thời điểm hiện tại. Dùng để khôi phục context cho Codex, kiểm tra deploy và tránh nhầm giữa tính năng đã có với backlog.

## 1. Technology

Frontend:

- React 18
- Vite
- React Router
- TailwindCSS
- API client có refresh token flow
- localStorage dùng cho token và recent items

Backend:

- Node.js
- Express
- MySQL
- JWT authentication
- Refresh token
- bcrypt
- dotenv
- cors / helmet / morgan

Database:

- MySQL
- Migration scripts trong `database/migrations`
- Schema trong `database/schema/schema.sql`
- Seed admin/category qua `backend/scripts/seed.js`
- Schema Phase 2A, backend snapshot giá phiếu bán và Product Add/Edit UI cho giá bán mặc định đã được chuẩn bị. Schema cũng đã chuẩn bị `stock_voucher_items.sale_note_snapshot` cho Serial/Ghi chú bán hàng từng dòng, nhưng backend và POS chưa hỗ trợ field này.

## 2. Deployment Status

Trạng thái theo project memory:

- Hệ thống đã chạy trên Ubuntu Server với dữ liệu thật.
- Server dùng cho production/test nội bộ tại cửa hàng.
- Frontend phục vụ bằng Nginx.
- Backend chạy bằng PM2.
- Database là MySQL.
- Branch deploy/dev chính: `codex-dev`.

Thông tin server:

- Hostname: `linhkienpc`
- User: `vitinhphuoctai`
- IP nội bộ tĩnh: `192.168.1.50`
- Project path: `/opt/linhkienpc/linhkienpc`

Backup database:

- Script: `/home/vitinhphuoctai/backup_linhkienpc.sh`
- Backup tự động hằng ngày lúc 23:00
- Thư mục backup: `/home/vitinhphuoctai/backups`
- Retention hiện tại: 14 ngày

Local development:

- Windows path: `C:\Users\Admin\Documents\Codex\linhkienpc`
- Frontend dev: `http://localhost:5173`
- Local dev nên dùng local backend/database trừ khi cố ý trỏ về server thật.

## 3. Current Working Routes

Public:

- `/` - Public Lookup, không cần login

Admin:

- `/admin/login` - đăng nhập quản trị
- `/admin` - redirect về `/admin/stock-in`
- `/admin/products` - danh sách sản phẩm
- `/admin/products/new` - thêm sản phẩm
- `/admin/products/:id/edit` - sửa sản phẩm
- `/admin/stock-in` - nhập hàng bulk
- `/admin/stock-out` - Bán tại quầy / POS full-screen
- `/admin/inventory-check` - kiểm hàng / điều chỉnh tồn thực tế
- `/admin/customers` - khách hàng
- `/admin/customers/:id` - chi tiết khách hàng
- `/admin/suppliers` - nhà cung cấp
- `/admin/transaction-history` - danh sách phiếu
- `/admin/transaction-history/:voucherId` - chi tiết phiếu
- `/admin/transaction-history/:voucherId/print` - xem trước mẫu in phiếu bán

Legacy/redirect:

- `/admin/inventory-workbench` redirect về `/admin/stock-in`
- `/admin/stock-out-bulk` redirect về `/admin/stock-out`
- `/admin/stock-in-single` và `/admin/stock-out-single` vẫn còn page cũ, không phải hướng UI chính.

## 4. Completed / Working Modules

### Public Lookup - Working and polished

- Route `/`
- Không yêu cầu login
- Search theo tên sản phẩm, SKU và ghi chú bảo hành nếu backend hỗ trợ
- Empty search không show toàn bộ sản phẩm
- Có search history localStorage
- Result card hiển thị total quantity
- Nhóm bảo hành / ghi chú expandable
- Single result auto-expand
- Copy product name
- Mobile-friendly
- Không có giá/payment/debt/admin actions

### Admin Authentication - Working

- Route `/admin/login`
- Protected admin routes
- JWT access token + refresh token
- Token lưu trong localStorage
- Sai mật khẩu có thông báo rõ

### Products - Working and polished

- Danh sách sản phẩm
- Search/filter/pagination
- Product list hiển thị giá bán mặc định nếu đã thiết lập
- Add product page
- Edit product page
- Product Add/Edit UI hỗ trợ nhập `sale_price` optional/nullable cho giá bán mặc định
- Activate/deactivate/restore
- SKU validation
- Duplicate SKU error handling
- Backend admin product API đã hỗ trợ `sale_price` nullable cho giá bán mặc định
- UI Sapo-inspired full page
- Wording visible: `Thêm sản phẩm`, `Sửa sản phẩm`, `Loại sản phẩm`
- API/database nội bộ vẫn dùng `category` / `category_id`
- SKU helper ngắn, auto lowercase khi nhập

### Stock In / Nhập hàng - Working and polished

- Route `/admin/stock-in`
- Bulk stock-in
- Chọn nhà cung cấp
- Search/add nhiều sản phẩm
- Mỗi dòng có số lượng và nhóm bảo hành / ghi chú
- Product dropdown có `+ Thêm mới sản phẩm`
- Submit gọi backend bulk stock-in hiện có
- Tạo stock voucher theo logic backend
- Không có giá nhập, thanh toán, công nợ, tổng tiền

### Stock Out / POS / Bán tại quầy - Working and under real-world testing

- Route `/admin/stock-out`
- Full-screen POS, không dùng AdminLayout
- Home button về `/admin`
- Product search trên top bar
- Recent products
- Product dropdown compact
- Chọn nhóm bảo hành / ghi chú trước khi thêm
- Add vào cart với quantity mặc định 1
- Same SKU + same note group merge/increase quantity
- Cart table compact
- Chỉnh quantity trực tiếp trong cart
- Customer selector bên phải
- Multi-order local state
- Close order có confirm nếu đơn chưa lưu
- Submit gọi bulk stock-out hiện có
- Backend tạo voucher
- Backend snapshot `products.sale_price` vào `stock_voucher_items` và `stock_vouchers.total_amount`
- Schema đã có `stock_voucher_items.sale_note_snapshot` cho Serial/Ghi chú bán hàng từng dòng, nhưng POS/backend chưa nhận hoặc lưu dữ liệu này.
- POS hiển thị giá bán mặc định trong dropdown, đơn giá trong cart, thành tiền từng dòng và tổng tiền đơn hiện tại
- Giá trong POS vẫn chỉ đọc; backend vẫn tự snapshot và tính lại tiền khi submit
- Chi tiết phiếu bán hiển thị đơn giá, thành tiền và tổng tiền từ snapshot backend
- Có double-submit guard
- Nếu sale thành công nhưng reload tồn kho lỗi, UI không báo “bán thất bại” sai
- Phiếu nhập chưa có giá nhập; POS chưa có sửa giá trực tiếp, giảm giá, thanh toán, công nợ hoặc hóa đơn

### Inventory Check / Kiểm hàng - Working

- Route `/admin/inventory-check`
- Search/select product
- Xem total stock
- Xem nhóm bảo hành / ghi chú
- Tăng/giảm số lượng theo nhóm
- Lý do điều chỉnh
- Quantity adjustment history
- Missing product action: `+ Thêm sản phẩm mới`
- Đây là direct inventory adjustment hiện tại, chưa phải hệ thống phiếu kiểm kê/draft/cân bằng đầy đủ.

### Customers / Khách hàng - Working and simplified

- Customer list
- Search
- Add/edit
- Activate/deactivate/restore
- Fields đang dùng/lưu: name, phone, address
- POS customer selector
- Recent customers
- Inactive customers không nên xuất hiện trong selector/recent
- Không document fake fields như nhóm khách hàng, tags, công nợ, province/ward, tax nếu chưa implement.

### Suppliers / Nhà cung cấp - Working and simplified

- Supplier list
- Search
- Add/edit
- Activate/deactivate/restore
- Fields đang dùng/lưu: name, phone, address
- Stock In supplier selector
- Recent suppliers
- Inactive suppliers không nên xuất hiện trong selector/recent
- Không document fake fields.

### Transaction History / Stock Vouchers - Working and polished

- Route `/admin/transaction-history`
- Voucher-first list
- Search theo mã phiếu, sản phẩm, khách hàng, nhà cung cấp
- Filter theo loại phiếu: tất cả / nhập hàng / bán hàng
- Detail route riêng: `/admin/transaction-history/:voucherId`
- Detail page không còn modal
- Back link: `← Quay lại danh sách phiếu`
- Print route riêng: `/admin/transaction-history/:voucherId/print`
- Hiển thị voucher code, loại phiếu, ngày tạo, người tạo, đối tác, tổng số lượng, số dòng, ghi chú và dòng sản phẩm
- Chi tiết phiếu bán và mẫu in A4 dùng snapshot giá từ backend nếu có
- Mẫu in A4 hiện chỉ hỗ trợ phiếu OUT/Bán hàng; nút `In phiếu` gọi hộp thoại in trình duyệt nhưng không lưu PDF/file
- Chưa có nút Bán & In trong POS và chưa có cấu hình logo/mẫu in
- Không có payment/debt fields
- Stock voucher không phải invoice

## 5. Current UI Status

Đã polish theo hướng Sapo-inspired:

- Product list/add/edit
- Stock In
- POS / Stock Out
- Inventory Check
- Customer/Supplier list/forms
- Transaction History list/detail
- Public Lookup

Mục tiêu UI hiện tại là gọn, nhanh, ít trường giả, không ERP-style.

## 6. Current Business Rules

- SKU phải unique.
- SKU nên dùng chữ thường, số và dấu chấm.
- Không cho duplicate SKU.
- Product inactive không xuất hiện trong selector mặc định.
- Customer/Supplier inactive không xuất hiện trong selector/recent.
- Không sửa tồn kho trực tiếp ngoài flow stock-in, stock-out hoặc inventory-check adjustment.
- Stock operation dựa trên SKU + nhóm bảo hành / ghi chú.
- Public Lookup không login.
- Public Lookup không show all products khi input rỗng.
- POS là `Bán tại quầy`, không gọi là `Xuất & Giao hàng`.
- Không thêm price/payment/debt/invoice khi chưa được duyệt.

## 7. Current Limitations

- Product Add/Edit UI đã cho quản lý giá bán mặc định; frontend POS chưa hiển thị hoặc cho sửa giá khi bán.
- Chưa có giá nhập.
- Chưa có thanh toán.
- Chưa có công nợ khách hàng/nhà cung cấp.
- Chưa có invoice/hóa đơn.
- Chưa có báo cáo tài chính.
- Chưa có tags/aliases/compatibility search.
- Inventory Check chưa phải hệ thống phiếu kiểm kê đầy đủ.
- Mẫu in A4 phiếu bán đã có route riêng và nút `In phiếu`; chưa có nút Bán & In tại POS, chưa có cấu hình logo/mẫu và chưa hỗ trợ mẫu in phiếu nhập.
- Serial/Ghi chú bán hàng từng dòng mới có schema snapshot, chưa có backend/API/POS UI sử dụng.
- POS warranty group vẫn chọn trước khi thêm vào cart; chuyển warranty selection vào cart là future work.
- Không có draft persistence/localStorage cho multi-order.

## 8. Known Backlog

Backlog sau khi chạy ổn định:

- Dùng giá bán mặc định `sale_price` trong POS.
- Hoàn thiện luồng in phiếu bán từ voucher nếu thực tế cần, bao gồm nút điều hướng/in sau khi bán.
- Nghiên cứu địa chỉ khách hàng kiểu Province/District/Ward/Detailed address.
- Customer warranty tracking/history view tốt hơn.
- Search tags / aliases / compatibility.
- Draft persistence cho multi-order nếu thực tế cần.
- Báo cáo tồn kho cơ bản.

Backlog tài chính chỉ làm sau:

- Giá nhập
- Sửa giá trực tiếp trong POS
- Thanh toán
- Công nợ
- Sổ quỹ/kế toán
- Báo cáo doanh thu/lợi nhuận

## 9. Production/Test Workflow

Quy trình deploy an toàn:

1. Develop và test trên Windows.
2. Commit và push branch `codex-dev`.
3. Backup database server.
4. SSH vào Ubuntu server.
5. Kiểm tra `git status`.
6. `git pull`.
7. Build frontend.
8. Restart Nginx.
9. Restart PM2 chỉ khi backend thay đổi.
10. Test các route quan trọng: `/`, `/admin/login`, `/admin/stock-in`, `/admin/stock-out`, `/admin/products`, `/admin/inventory-check`, `/admin/transaction-history`.

## 10. Next Practical Priorities

Ưu tiên gần nhất:

1. Deploy frontend polish lên Ubuntu sau khi backup.
2. Test POS với dữ liệu thật tại cửa hàng.
3. Theo dõi lỗi thao tác nhanh: search, add, quantity, customer, submit.
4. Xác nhận Stock In và Public Lookup không bị ảnh hưởng.
5. Nghiên cứu in phiếu dựa trên stock voucher hiện có.
6. Chỉ sửa UI/UX hoặc bug thật trước khi mở thêm feature lớn.
