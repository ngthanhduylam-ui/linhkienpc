# VI TÍNH PHƯỚC TÀI POS - Changelog theo milestone

Cập nhật gần nhất: **23/06/2026**

## 2026-06-23 - Search, inventory integrity, Public Lookup và handoff

- POS product search chuyển sang server-side Admin Products API, không còn giới hạn trong page product tải ban đầu.
- Search hỗ trợ multi-token AND và compact model/SKU.
- Product images hoàn thành: tối đa 3 ảnh, original, thumbnail WebP, primary image, gallery/download.
- Inventory Check quantity adjustment sửa `from_quantity/to_quantity` theo tồn group.
- Locking read được thực hiện trước khi tính group ledger để tránh stale snapshot/lost update.
- Public Lookup search/list chỉ hiện product active có tổng tồn lớn hơn 0; product thiếu balance được xem là tồn 0.
- Public detail trực tiếp theo SKU giữ hành vi tương thích hiện tại.
- Dữ liệu lệch production của product ID 1 được ghi nhận đã đưa về `total=1`, `BH 7.28=1`.
- Tài liệu dự án được đồng bộ lại và thêm `CHAT_HANDOFF.md`.

Quyết định hướng giá tiếp theo, chưa code:

- `products.sale_price` là giá tham chiếu chung.
- Warranty group chỉ quản lý tồn, không gắn bảng giá.
- POS sẽ cho nhập discount bằng số tiền VND theo từng dòng, không dùng phần trăm.
- Chưa có payment, debt, cost hoặc báo cáo tài chính.

## Product Images

- Thêm tối đa 3 ảnh cho mỗi sản phẩm; ảnh đầu tiên là ảnh chính.
- Giữ file gốc trên filesystem và tạo thumbnail WebP riêng.
- Product Admin quản lý upload, thứ tự, xóa và tải ảnh gốc.
- Product List, POS và Public Lookup hiển thị thumbnail; Public Lookup có gallery và tải ảnh của sản phẩm active.
- Chưa có CDN/object storage hoặc xử lý ảnh hàng loạt.

Tài liệu này ghi lại các mốc thay đổi lớn của hướng POS-first. Không invent ngày nếu không có trong repo/history; các mục được tổ chức theo milestone.

## 2026-06-19 - Production trial tại cửa hàng

Hệ thống đã được đưa vào chạy thử thực tế:

- Production domain: `https://vitinhphuoctai.duckdns.org`.
- Ubuntu Server tự host tại cửa hàng.
- Nginx phục vụ frontend và reverse proxy API.
- HTTPS Let's Encrypt hoạt động; renewal dry run thành công và Certbot timer active.
- Backend chạy bằng PM2 process `linhkienpc-api`, chỉ bind `127.0.0.1:3000`.
- MySQL chỉ truy cập localhost; UFW không mở public cổng 3000/3306.
- DuckDNS cron cập nhật mỗi 5 phút.
- Backup MySQL chạy 23:00 hằng ngày, giữ 14 ngày và ghi log vào `/home/vitinhphuoctai/backup.log`.
- Backup cron đã tạo file có dữ liệu; restore end-to-end chưa được xác nhận là đã diễn tập.

Bảo mật:

- Đã đổi mật khẩu MySQL và Admin sau khi secret cũ bị lộ trong image.
- Đã bỏ mật khẩu Admin hard-code.
- Seed chỉ tạo admin mới khi có `DEFAULT_ADMIN_PASSWORD` và không reset admin hiện có.
- Admin login có rate limit 10 request/15 phút/IP; request vượt giới hạn trả HTTP 429.
- Express trust proxy giới hạn `loopback` để nhận IP thật qua Nginx.

Production smoke test đã pass:

- Admin login và public lookup qua HTTPS.
- Public categories.
- Bán nhiều sản phẩm, trừ tồn và public lookup phản ánh tồn mới.
- Snapshot giá Phase 2A và Serial/Ghi chú theo dòng.
- Voucher history, detail và print A4.
- Nginx API proxy, PM2 restart, Certbot renewal dry run và backup cron.

Trạng thái tiếp theo: giữ ổn định 1-2 tuần, không mở tính năng tài chính lớn.

## 1. Direction Reset: Inventory First -> POS First

Dự án đổi hướng từ quản lý kho là trung tâm sang **POS First / Offline First / Self-hosted / Sapo Inspired**.

Quyết định chính:

- Inventory hỗ trợ bán hàng, không dẫn dắt workflow.
- `/admin/stock-out` trở thành **Bán tại quầy**.
- Public Lookup vẫn là tính năng cốt lõi, không login.
- Không mở rộng payment/debt/invoice trong giai đoạn ổn định POS.
- Không biến dự án thành ERP.

## 2. Admin Authentication and Public Lookup

Đã có:

- `/admin/login` với JWT + refresh token.
- Protected admin routes.
- Public route `/` không cần login.
- Public Lookup search theo tên sản phẩm, SKU và ghi chú bảo hành.
- Empty search không show all products.
- Result card hiển thị tổng tồn và nhóm bảo hành / ghi chú.
- Copy product name.
- Link `Đăng nhập quản trị` từ public page.

Quyết định UX:

- Public Lookup chỉ để tra cứu tồn, không có admin action.
- Không hiển thị giá, khách hàng, nhà cung cấp, transaction history.

## 3. POS Full-screen Refactor

`/admin/stock-out` được tách khỏi AdminLayout.

Thay đổi chính:

- Ẩn AdminSidebar/AdminHeader.
- Thêm top POS bar.
- Thêm Home button về `/admin`.
- Product search đưa lên top bar.
- Layout chia main cart + right panel.
- Wording chuyển sang `Bán tại quầy`.

Business decision:

- Backend/API vẫn dùng stock-out/bulk để trừ tồn.
- Không đổi inventory validation chỉ vì đổi wording UI.

## 4. Product Search Dropdown Improvements

Các đợt polish đã làm dropdown giống POS autocomplete hơn:

- Recent products khi focus search rỗng.
- Typing hiển thị results.
- Dropdown floating, không đẩy layout.
- Product row compact.
- SKU muted.
- Tổng tồn rõ.
- Hết hàng muted hơn.
- Dropdown width/responsive tốt hơn cho 1920×1080 và 2560×1440.
- Sau add: clear search, clear debounced search, close dropdown, focus search.
- Dropdown không tự reopen ngay sau add.

Quyết định quan trọng:

- Không thêm keyboard shortcut UI kiểu Sapo nếu chưa support thật.
- Dropdown chỉ hiển thị giá bán mặc định dạng chỉ đọc; không có payment/debt.

## 5. Warranty / Note Group Workflow

Workflow hiện tại:

Product -> nhóm bảo hành / ghi chú -> Thêm 1 item -> chỉnh quantity trong cart.

## Phase 2A - Serial / Ghi Chú Bán Hàng Theo Dòng

Đã có:

- POS `/admin/stock-out` có ô `Serial / Ghi chú` trong từng dòng cart.
- Nội dung ghi chú thuộc từng order/tab và từng cart row.
- Cùng SKU + cùng nhóm bảo hành vẫn merge thành một dòng, tăng quantity và giữ nguyên ghi chú đã nhập.
- Submit stock-out gửi `sale_note` đã trim, ô trống gửi `null`.
- Backend lưu dữ liệu vào `stock_voucher_items.sale_note_snapshot`.
- Chi tiết phiếu bán hiển thị `Serial / Ghi chú` dưới tên sản phẩm khi dòng phiếu có dữ liệu.
- Mẫu in phiếu bán hiển thị `Serial / Ghi chú` dưới tên sản phẩm khi dòng phiếu có dữ liệu.

Chưa có:

- Chưa có quản lý serial riêng hoặc tách mỗi serial thành một dòng riêng.

Thay đổi chính:

- Bỏ quantity stepper khỏi dropdown warranty row.
- Dropdown warranty row chỉ còn label, quantity còn lại và button thêm.
- Nếu SKU + note group đã có trong cart, dropdown hiện `+1` hoặc trạng thái đã chọn.
- Nếu đã chọn đủ tồn, button disabled và text rõ.
- Warranty label/quantity contrast được fix để đọc được trên active row.

Quyết định:

- Nhóm bảo hành / ghi chú vẫn chọn trước khi add trong version hiện tại.
- Chuyển warranty selection vào cart là backlog, chưa implement.

## 6. Cart and Quantity Improvements

Cart được refactor từ cảm giác admin table sang POS order list.

Thay đổi chính:

- Bỏ STT/image dư thừa ở các lần polish trước.
- Bố cục product-centric.
- SKU có cột riêng/compact.
- Nhóm bảo hành / ghi chú hiển thị rõ.
- Quantity editable trực tiếp: `[-] [input] [+]`.
- Clamp quantity min/max theo tồn nhóm.
- Add same SKU + same note group merge/increase quantity.
- Delete row luôn dễ thấy.
- Cart table compact, không overflow ngang trên desktop bình thường.

Quyết định:

- Quantity chỉnh trong cart, không chỉnh trong dropdown.
- Serial/Ghi chú theo dòng hiện đã được khôi phục và persist bằng `sale_note_snapshot`.

## 7. Customer Selector

Customer selector trong POS được polish:

- Recent customers.
- Search khách hàng.
- Customer row compact: name + phone.
- Selected customer card gọn: name, phone, nút đổi.
- Inactive customers không hiển thị.
- Quick create giữ theo flow hiện có.

Không thêm:

- Công nợ
- Thanh toán
- Địa chỉ nâng cao
- Customer group/tags giả

## 8. Multiple Order Tabs

Đã thêm foundation cho multi-order frontend state:

- Tạo nhiều order tabs: `Đơn 1`, `Đơn 2`, ...
- `+` tạo đơn mới và nằm ngay sau tab cuối.
- Mỗi order giữ riêng cart, customer và note state nếu có.
- Switch order không clear order khác.
- Close order có confirm nếu đơn chưa lưu.
- Nếu chỉ còn một order, close sẽ clear order đó.
- Khi submitting, khóa create/switch/close để tránh state leakage.

Chưa có:

- Draft persistence localStorage/session.

## 9. Submit Safety Fixes

Đã harden submit POS:

- Guard double submit ở đầu `handleSubmit`.
- Disable các action nguy hiểm khi `isSubmitting`.
- Sale success được tách khỏi reload inventory.
- Nếu bulk stock-out thành công nhưng reloadProducts fail, UI báo warning chứ không báo sale failed.
- Active order được clear sau success.
- Other order tabs giữ nguyên.

Quyết định:

- Backend vẫn là nguồn validate tồn cuối cùng.
- Không auto xóa/submit các order khác nếu chứa SKU vừa bán.

## 10. Product UI Refactor

Product Management được polish theo Sapo-like layout:

- Product list giữ table/list hiện tại.
- Button chính: `+ Thêm sản phẩm`.
- Add/edit product dùng route riêng:
  - `/admin/products/new`
  - `/admin/products/:id/edit`
- Layout hai cột: thông tin chung + preview/quy tắc SKU.
- Wording `Loại sản phẩm` thay cho `Danh mục` ở UI.
- Vẫn giữ `category` / `category_id` nội bộ.
- SKU helper ngắn.
- Uppercase SKU auto lowercase.
- Invalid SKU và duplicate SKU báo rõ.
- Inline create product type: `+ Tạo loại sản phẩm mới`.

Không thêm:

- Barcode
- Tax
- Brand
- Tags
- Warranty config

## 10.1. Phase 2A Task 4 - Product Default Sale Price UI

Product Add/Edit đã thêm field `Giá bán` để admin nhập giá bán mặc định của sản phẩm:

- Giá bán optional, để trống nghĩa là chưa thiết lập.
- Giá `0` là giá hợp lệ, không bị đổi thành trống.
- Frontend gửi `sale_price` dạng number hoặc `null` cho admin product API.
- Tại thời điểm Task 4, POS vẫn chưa hiển thị giá, chưa cho sửa giá khi bán và chưa có thanh toán/công nợ/hóa đơn.

## 10.2. Phase 2A Task 5 - Product List Sale Price

Product list đã thêm cột `Giá bán` để xem nhanh giá bán mặc định:

- Chưa có giá hiển thị `Chưa thiết lập`.
- Giá `0` hiển thị `0 ₫`.
- Giá dương hiển thị theo định dạng VND.
- Public lookup vẫn không hiển thị giá.

## 10.3. Phase 2A POS Read-only Sale Price Display

POS `/admin/stock-out` đã hiển thị giá bán mặc định ở các điểm đọc:

- Product dropdown hiển thị giá để admin tham khảo khi chọn sản phẩm.
- Cart hiển thị `Đơn giá` và `Thành tiền` từng dòng.
- Sidebar hiển thị `Tổng tiền` của đơn hiện tại.
- Giá trong POS vẫn chỉ đọc, chưa cho sửa trực tiếp khi bán.
- Submit payload không gửi `unit_price`, `line_total` hoặc `total_amount`; backend vẫn tự snapshot và tính lại khi submit.
- Chưa có thanh toán, giảm giá, công nợ hoặc hóa đơn.

## 10.4. Phase 2A Voucher Detail Sale Price Display

Chi tiết phiếu `/admin/transaction-history/:voucherId` đã hiển thị tiền cho phiếu bán:

- Phiếu bán hiển thị `Đơn giá`, `Thành tiền` từng dòng và `Tổng tiền`.
- Dữ liệu lấy từ snapshot backend: `items[].unit_price`, `items[].line_total`, `total_amount`.
- Phiếu bán cũ chưa có snapshot hiển thị `Chưa xác định` thay vì crash.
- Phiếu nhập chưa có giá nhập và không hiển thị giá nhập giả.
- Chưa có thanh toán, giảm giá hoặc công nợ.

## 10.5. Phase 2A Voucher Print Preview and A4 Print

Đã thêm route xem trước và in mẫu A4 cho phiếu bán:

- Route: `/admin/transaction-history/:voucherId/print`.
- Trang xem trước không dùng AdminLayout, không có sidebar/header quản trị.
- Mẫu hiện chỉ hỗ trợ phiếu OUT/Bán hàng.
- Dữ liệu lấy từ voucher detail API và snapshot backend: SKU, tên sản phẩm, ghi chú bảo hành, đơn giá, thành tiền và tổng tiền.
- Mẫu A4 có phần lưu ý bảo hành mặc định và khu vực ký tên khách hàng/người bán.
- Nút `In phiếu` gọi hộp thoại in trình duyệt bằng `window.print()`.
- Không tạo PDF, không lưu file và không gọi API mới.
- Phiếu bán cũ thiếu snapshot giá vẫn mở được và hiển thị `Chưa xác định`.
- Phiếu nhập hiển thị thông báo mẫu in phiếu nhập chưa được hỗ trợ, không dựng giá nhập giả.
- Chưa có nút Bán & In trong POS và chưa có cấu hình logo/mẫu in.
- Chưa có thanh toán, giảm giá, công nợ hoặc invoice/accounting.

## 11. Inventory Check UI Refactor

Kiểm hàng được polish cho workflow kiểm tồn thực tế:

- Search/select product.
- Detail product rõ hơn: name, SKU, total quantity.
- Nhóm bảo hành / ghi chú compact.
- Adjustment form rõ: loại điều chỉnh, số lượng, nhóm, lý do.
- Missing product action: `+ Thêm sản phẩm mới`.
- Điều chỉnh vẫn dùng API hiện có.

Giới hạn hiện tại:

- Đây là direct quantity adjustment.
- Chưa phải hệ thống phiếu kiểm kê/draft/cân bằng hoàn chỉnh.

## 12. Stock In UI Refactor

Nhập hàng chuyển sang layout Sapo-inspired, inventory-only:

- Page title/action: `Nhập hàng`.
- Supplier section ở trên.
- Product section full width, dễ nhập nhanh.
- Product dropdown có `+ Thêm mới sản phẩm`, product name, SKU, tồn hiện tại.
- Table gồm sản phẩm, SKU, nhóm bảo hành / ghi chú, số lượng, xóa.
- Summary chỉ có tổng số dòng và tổng số lượng.
- Submit dùng bulk stock-in hiện có.

Không thêm:

- Giá nhập
- Chiết khấu
- Thuế
- Thanh toán
- Công nợ nhà cung cấp
- Tổng tiền

## 13. Customer/Supplier UI Refactor

Customer/Supplier module được polish và sau đó đơn giản hóa:

- List pages gọn hơn.
- Add/edit modal/form chỉ giữ field backend đang lưu:
  - name
  - phone
  - address
- Hide status card trong create form.
- Edit vẫn giữ behavior activate/deactivate/restore theo list actions.
- Loại bỏ field giả/unsupported:
  - tags
  - customer group
  - email/tax/website nếu backend không lưu
  - province/ward separation
  - debt
  - responsible staff placeholder

Quyết định:

- Không show disabled fake fields như “Chưa cấu hình”.
- Địa chỉ nâng cao là future research.

## 14. Transaction History Detail-page Refactor

Transaction History chuyển từ modal detail sang full detail page.

Thay đổi chính:

- List route: `/admin/transaction-history`.
- Detail route: `/admin/transaction-history/:voucherId`.
- Voucher code và `Chi tiết` navigate sang detail page.
- Back link: `← Quay lại danh sách phiếu`.
- Detail page gồm:
  - Thông tin đối tác
  - Thông tin sản phẩm
  - Thông tin phiếu
- Product detail table bỏ cột `Loại giao dịch` để tránh overflow.

Quyết định:

- Stock voucher không phải hóa đơn.
- Phiếu OUT hiện hiển thị snapshot giá và sale note; vẫn không có payment/debt.

## 15. Public Lookup Polish

Public Lookup được polish cho người xem ngoài admin:

- Header brand `VI TÍNH PHƯỚC TÀI`.
- Subtitle `Tra cứu tồn kho linh kiện PC`.
- Button `Đăng nhập quản trị`.
- Search hero lớn, mobile-friendly.
- Helper text không nhắc tags/compatibility chưa implement.
- Empty search không show all products.
- Result card rõ: name, SKU, total quantity, stock status, nhóm bảo hành / ghi chú.
- Copy product name giữ lại.

Không hiển thị:

- Admin actions
- Giá/cost
- Customer/supplier info
- Internal transaction history

## 16. Ubuntu Server Deployment

Dự án đã được đưa lên Ubuntu Server để chạy thử production với dữ liệu thật.

Thông tin theo project memory:

- Hostname: `linhkienpc`
- User: `vitinhphuoctai`
- Domain: `https://vitinhphuoctai.duckdns.org`
- Project path: `/opt/linhkienpc/linhkienpc`
- Backend: PM2 process `linhkienpc-api`, bind `127.0.0.1:3000`
- Frontend: Nginx
- Database: MySQL
- Branch: `codex-dev`

Deploy cần cẩn trọng vì database đã có dữ liệu thật.

## 17. Automatic Database Backup

Đã có backup database tự động:

- Script: `/home/vitinhphuoctai/backup_linhkienpc.sh`
- Lịch: mỗi ngày 23:00
- Thư mục: `/home/vitinhphuoctai/backups`
- Retention: 14 ngày
- Log: `/home/vitinhphuoctai/backup.log`

Trước khi deploy thay đổi lớn, vẫn nên backup thủ công.

## 18. Current Deferred Items

Deferred/backlog, không xem là completed:

- Giá nhập
- Sửa giá trực tiếp tại POS
- Thanh toán
- Công nợ khách hàng / nhà cung cấp
- Hóa đơn / invoice
- Kế toán
- Báo cáo tài chính
- Search tags / aliases / compatibility
- Draft persistence cho multi-order
- Warranty selection/editing trực tiếp trong cart
- Inventory check voucher/draft workflow đầy đủ
- In phiếu nâng cao

Nguyên tắc hiện tại: ổn định POS và dữ liệu thật trước, tính năng tài chính sau.
