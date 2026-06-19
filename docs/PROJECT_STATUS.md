# VI TÍNH PHƯỚC TÀI POS - Trạng thái hiện tại

Cập nhật: **19/06/2026**

## 1. Trạng thái sản phẩm

Hệ thống đang ở giai đoạn **Production trial / Chạy thử thực tế tại cửa hàng** trên Ubuntu Server tự host.

Trong 1-2 tuần tiếp theo:

- Không mở thêm tính năng lớn.
- Theo dõi lỗi phát sinh trong thao tác thật.
- Ưu tiên bán hàng, tồn kho, public lookup, khách hàng, Serial/Ghi chú, phiếu, lịch sử, backup, đăng nhập và bảo mật.
- Chỉ sửa bug thật hoặc điểm UX gây nhầm.

Định hướng vẫn là **POS First, Offline First, Self-hosted, Inventory supports sales, Sapo-inspired, Not an ERP**.

## 2. Production đã xác nhận

- Domain: `https://vitinhphuoctai.duckdns.org`
- Server: Ubuntu Server tại cửa hàng
- Repo: `/opt/linhkienpc/linhkienpc`
- Branch deploy: `codex-dev`
- Frontend: Nginx
- Backend: PM2 process `linhkienpc-api`
- Backend bind: `127.0.0.1:3000`
- Database: MySQL localhost
- HTTPS: Let's Encrypt/Certbot
- `certbot renew --dry-run`: đã thành công
- Certbot timer: đang hoạt động
- DuckDNS: cron cập nhật mỗi 5 phút

Firewall:

- SSH chỉ cho phép từ LAN.
- Cổng 80/443 mở public.
- Cổng 3000/3306 không mở public.

## 3. Backup

- Script: `/home/vitinhphuoctai/backup_linhkienpc.sh`
- Thư mục: `/home/vitinhphuoctai/backups`
- Log cron: `/home/vitinhphuoctai/backup.log`
- Lịch: 23:00 hằng ngày
- Retention: 14 ngày
- Cron đã tạo được backup có dữ liệu.

Việc tạo backup đã được xác nhận. Quy trình restore hoàn chỉnh chưa được ghi nhận là đã diễn tập thành công, vì vậy không được xem restore là đã kiểm chứng.

## 4. Bảo mật đã hoàn thành

- Đã đổi mật khẩu MySQL sau khi secret cũ từng xuất hiện trong image.
- Đã đổi mật khẩu Admin.
- Đã loại bỏ mật khẩu Admin hard-code khỏi source.
- `DEFAULT_ADMIN_PASSWORD` chỉ lấy từ environment.
- Seed không reset mật khẩu khi admin đã tồn tại.
- Nếu chưa có admin và thiếu `DEFAULT_ADMIN_PASSWORD`, seed báo lỗi rõ ràng.
- Backend hỗ trợ `HOST`; production dùng `HOST=127.0.0.1`.
- `app.set("trust proxy", "loopback")` để lấy IP qua Nginx loopback.
- `POST /api/v1/admin/auth/login` giới hạn 10 request/15 phút/IP.
- Request vượt giới hạn trả HTTP 429 với code `AUTH_LOGIN_RATE_LIMITED`.
- Limiter không áp dụng cho public lookup, refresh, logout, POS, products hoặc API admin khác.

Rate limiter hiện dùng memory store, phù hợp với một PM2 instance. Nếu chuyển sang cluster/nhiều instance cần shared store như Redis.

## 5. Modules đang hoạt động

### Public Lookup

- Route `/`, không cần login.
- Tìm theo tên, SKU và ghi chú bảo hành.
- Hiển thị tổng tồn và nhóm bảo hành.
- Không trả `sale_price`, dữ liệu tiền, `sale_note` hoặc admin actions.

### Product Admin

- List, search, filter, pagination.
- Add/edit, activate/deactivate.
- SKU validation và duplicate handling.
- Giá bán mặc định `sale_price` optional/nullable.
- Product list và form hiển thị/quản lý giá bán.

### Stock In

- Bulk nhập hàng.
- Nhà cung cấp optional.
- Số lượng và nhóm bảo hành/ghi chú.
- Tồn tăng và tạo phiếu nhập.
- Chưa có giá nhập, thanh toán hoặc công nợ.

### POS / Stock Out

- Full-screen `/admin/stock-out`.
- Search, recent products, customer selector và multi-order.
- Merge theo SKU + nhóm bảo hành.
- Giá bán, đơn giá, thành tiền và tổng tiền chỉ đọc.
- Serial/Ghi chú riêng theo từng dòng.
- Backend tự lấy `products.sale_price`, snapshot tiền và sale note.
- Submit không gửi `unit_price`, `line_total` hoặc `total_amount`.
- Trừ tồn và rollback vẫn theo logic inventory hiện có.

### Inventory Check

- Tìm sản phẩm, xem tồn theo nhóm.
- Chuyển nhóm ghi chú và điều chỉnh số lượng có lý do.
- Chưa phải workflow phiếu kiểm kê ERP đầy đủ.

### Customers / Suppliers

- List, search, add/edit, activate/deactivate.
- Các field thực tế: tên, số điện thoại, địa chỉ.
- Không có công nợ.

### Voucher History / Detail / Print

- Danh sách phiếu nhập và phiếu bán.
- Detail phiếu bán dùng snapshot tên, SKU, nhóm bảo hành, sale note và tiền.
- Phiếu cũ thiếu snapshot vẫn mở được.
- Mẫu in A4 chỉ hỗ trợ phiếu OUT/Bán hàng.
- Nút `In phiếu` dùng `window.print()`, không tạo hoặc lưu PDF.
- Chưa có nút Bán & In tại POS và chưa có cấu hình logo/mẫu.

## 6. Kiểm thử production đã xác nhận

- Admin login.
- Public Lookup qua HTTPS.
- Public categories trả HTTP 200.
- Bán nhiều sản phẩm và tồn giảm đúng.
- Public Lookup phản ánh tồn mới.
- History, detail và print voucher.
- Serial/Ghi chú bán hàng.
- Phase 2A sale price snapshot.
- Nginx reverse proxy API.
- PM2 restart.
- Backend vẫn chỉ nghe localhost sau restart.
- Certbot renewal dry run.
- Backup cron tạo file backup có dữ liệu lúc 23:00.

## 7. Routes chính

```text
/
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

## 8. Chưa có / đang hoãn

- Giá nhập.
- Sửa giá trực tiếp tại POS.
- Giảm giá.
- Luồng thanh toán đầy đủ.
- Khách đưa/tiền thừa.
- Công nợ khách hàng/nhà cung cấp.
- Hóa đơn/invoice.
- Báo cáo doanh thu, lợi nhuận và báo cáo tài chính.
- Quản lý serial riêng từng thiết bị.
- Draft persistence cho multi-order.
- Mẫu in phiếu nhập.
- Cấu hình logo và mẫu in.

## 9. Rủi ro cần theo dõi

- Rate limiter memory store chỉ phù hợp một backend instance.
- Server tự host phụ thuộc điện và Internet tại cửa hàng.
- Cần theo dõi `backup.log`, dung lượng backup và log ứng dụng.
- Restore database chưa được xác nhận bằng một buổi diễn tập hoàn chỉnh.
- Cần kiểm tra dung lượng đĩa định kỳ.
- Cần tiếp tục xác nhận PM2, Nginx, MySQL, Certbot timer và cron tự lên sau reboot.

## 10. Ưu tiên thực tế tiếp theo

1. Chạy thử ổn định 1-2 tuần.
2. Ghi lại lỗi theo bước tái hiện và voucher/SKU liên quan.
3. Kiểm tra backup hằng ngày và dung lượng đĩa.
4. Theo dõi PM2/Nginx/MySQL sau reboot hoặc mất điện.
5. Chỉ mở phase mới sau khi các flow bán, tồn và khôi phục vận hành đủ tin cậy.
