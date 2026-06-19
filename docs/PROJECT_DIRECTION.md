# VI TÍNH PHƯỚC TÀI POS - Định hướng chính thức

Cập nhật: **19/06/2026**

Tài liệu này là nguồn nhớ dài hạn về hướng sản phẩm. Khi ghi chú cũ mâu thuẫn, phải kiểm tra code và ưu tiên trạng thái đã xác nhận trong `PROJECT_STATUS.md`.

## 1. Project identity

Tên dự án: **VI TÍNH PHƯỚC TÀI POS**

- POS First
- Offline First
- Self-hosted
- Inventory supports sales
- Sapo-inspired
- Fast operation
- Minimal clicks
- Stability before advanced finance
- Not an ERP

Ứng dụng phục vụ cửa hàng linh kiện PC và sửa chữa máy tính. Tồn kho là nền tảng hỗ trợ bán hàng, không phải lý do để biến workflow thành phần mềm kho hoặc ERP nhiều bước.

## 2. Thứ tự ưu tiên

1. Bán tại quầy nhanh và chính xác.
2. Tồn kho đúng, có lịch sử và rollback an toàn.
3. Public Lookup dễ dùng, không cần đăng nhập.
4. Khách hàng, nhà cung cấp và nhóm bảo hành đủ cho vận hành thật.
5. Phiếu bán, Serial/Ghi chú và mẫu in phục vụ bảo hành.
6. Bảo mật, backup và khả năng vận hành self-hosted.
7. Chỉ sau khi ổn định mới xem xét tính năng tài chính nâng cao.

## 3. Trạng thái phase hiện tại

Hệ thống đang **Production trial / Chạy thử thực tế tại cửa hàng** từ ngày 19/06/2026.

Phase 2A đã cung cấp:

- Giá bán mặc định optional trên sản phẩm.
- Snapshot đơn giá, thành tiền và tổng tiền khi bán.
- Hiển thị tiền chỉ đọc trong POS và chi tiết phiếu.
- Serial/Ghi chú bán hàng riêng từng dòng.
- Mẫu in A4 phiếu bán.

Backend là nguồn tính và snapshot tiền. POS không tự quyết định giá và không gửi field tiền.

## 4. Phạm vi không mở rộng hiện tại

Không tự thêm:

- Giá nhập.
- Sửa giá trực tiếp tại POS.
- Chiết khấu/giảm giá.
- Thanh toán, khách đưa, tiền thừa.
- Công nợ khách hàng/nhà cung cấp.
- Hóa đơn, kế toán.
- Báo cáo doanh thu/lợi nhuận/tài chính.
- Workflow ERP phức tạp.
- E-commerce checkout.

Giá bán mặc định và snapshot phiếu bán là tính năng active; chúng không đồng nghĩa hệ thống đã có payment, invoice hoặc accounting.

## 5. Nguyên tắc UX

- Giao diện dày thông tin nhưng dễ scan.
- Search -> chọn -> thêm -> xác nhận.
- POS full-screen, compact và ít click.
- Không hiển thị field giả hoặc shortcut chưa hỗ trợ.
- Dùng từ ngữ: Bán tại quầy, Nhập hàng, Kiểm hàng, Phiếu bán, Phiếu nhập, Nhóm bảo hành/Ghi chú.
- Không dùng tên cũ như “Xuất & Giao hàng” trong UI chính.

## 6. Quy tắc tồn kho

- Không sửa trực tiếp số dư tồn từ UI thông thường.
- Tồn chỉ đổi qua stock-in, stock-out hoặc inventory-check.
- Mọi thay đổi tồn phải có lịch sử.
- Bulk stock-in/out tạo stock voucher.
- Stock operation dựa trên SKU + nhóm bảo hành/ghi chú.
- `sale_note` là dữ liệu bán hàng riêng, không tham gia chia nhóm tồn.
- Stock voucher là phiếu nghiệp vụ nội bộ, không phải hóa đơn thanh toán.

## 7. Public Lookup

- Route `/`, không yêu cầu login.
- Không show toàn bộ sản phẩm khi search rỗng.
- Tìm theo tên, SKU và ghi chú bảo hành.
- Hiển thị tồn và nhóm bảo hành.
- Không trả giá, dữ liệu tiền, sale note, đối tác hoặc lịch sử nội bộ.

Public Lookup phải được bảo vệ khi refactor POS/admin.

## 8. Self-hosted production

Production:

- `https://vitinhphuoctai.duckdns.org`
- Ubuntu Server tại cửa hàng
- Nginx + HTTPS Let's Encrypt
- PM2 process `linhkienpc-api`
- Express bind `127.0.0.1:3000`
- MySQL localhost
- DuckDNS cron mỗi 5 phút
- Backup MySQL mỗi ngày 23:00, giữ 14 ngày

Workflow chính không phụ thuộc cloud SaaS. Domain/Internet hỗ trợ truy cập từ ngoài, còn thiết kế vận hành vẫn ưu tiên self-hosted và khả năng dùng trong mạng cửa hàng.

## 9. Roadmap

### Hiện tại: production stabilization

- Chạy thử thực tế 1-2 tuần.
- Theo dõi lỗi bán hàng, tồn, public lookup, phiếu, print và backup.
- Theo dõi PM2/Nginx/MySQL/Certbot/cron sau reboot.
- Sửa bug có bước tái hiện rõ.

### Sau khi ổn định

- Cải thiện luồng Bán & In nếu thực tế cần.
- Draft persistence cho multi-order.
- Customer warranty history tốt hơn.
- Search aliases/compatibility.
- Báo cáo tồn kho cơ bản.

### Future finance phase

- Giá nhập.
- Thanh toán.
- Giảm giá.
- Công nợ.
- Báo cáo doanh thu/lợi nhuận.

Mỗi mục tài chính phải có phase và business rules riêng. Không gom chúng thành một cuộc chuyển đổi ERP.
