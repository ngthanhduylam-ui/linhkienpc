# VI TÍNH PHƯỚC TÀI POS - Trạng thái dự án

Cập nhật gần nhất: **23/06/2026**

## Trạng thái chung

Hệ thống đang ở giai đoạn **Production trial / chạy thử thực tế tại cửa hàng** trên Ubuntu self-hosted. Ưu tiên hiện tại là ổn định bán hàng, tồn kho, tra cứu công khai, phiếu, ảnh, backup và bảo mật trước khi mở module tài chính.

## Production đã xác nhận

```text
Domain:           https://vitinhphuoctai.duckdns.org
Repo:             /opt/linhkienpc/linhkienpc
Branch:           codex-dev
Frontend:         Nginx
Backend:          PM2 linhkienpc-api
Backend bind:     127.0.0.1:3000
Database:         MySQL localhost
Product uploads:  /opt/linhkienpc/uploads/products
```

- HTTPS/Certbot, UFW và DuckDNS cron đã cấu hình.
- Backup MySQL chạy lúc 23:00, giữ 14 ngày.
- Backup ảnh tự động sang HDD riêng chưa có.
- Restore database end-to-end chưa được ghi nhận là đã diễn tập hoàn chỉnh.

## Đã hoàn thành trong code

### Product Admin

- List/search/filter/pagination; add/edit; activate/deactivate.
- Validation Loại sản phẩm và map lỗi `category_id`.
- Gợi ý category từ token thứ hai của SKU; alias hiện có `main -> mainboard`; không ghi đè lựa chọn thủ công.
- `sale_price` nullable và hiển thị ở form/list.
- Tối đa 3 ảnh/product: upload, replace, reorder, delete, thumbnail và download file gốc.

### Product Search

- Multi-token AND, tối đa 8 token; không cần liền nhau hoặc đúng thứ tự.
- Compact normalization hỗ trợ model/SKU có dấu chấm hoặc gạch ngang.
- POS dùng server-side admin product search với debounce và request sequence guard; không còn giới hạn trong page tải đầu.

### Public Lookup

- Route `/`, không cần đăng nhập.
- Search theo tên, SKU và ghi chú bảo hành.
- Chỉ trả product active có tổng tồn lớn hơn 0.
- Product tồn 0 hoặc chưa có balance bị ẩn; tăng tồn lại sẽ tự xuất hiện.
- Có thumbnail, gallery và download ảnh gốc.
- Không trả giá, snapshot tiền hoặc sale note.

### POS / Bán tại quầy

- Full-screen `/admin/stock-out`, hỗ trợ nhiều order tab local; code hiện chưa đặt giới hạn số tab rõ ràng.
- Recent products, server-side search, thumbnail và chọn warranty group.
- Merge theo SKU + warranty group.
- Giá, đơn giá, thành tiền và tổng tiền chỉ đọc.
- Serial/Ghi chú riêng từng cart row, tối đa 500 ký tự.
- Backend tự snapshot giá và sale note; payload POS không gửi field tiền.

### Inventory Check

- Tìm sản phẩm, xem tổng tồn và tồn theo nhóm.
- Note move trong một thao tác, tổng tồn không đổi.
- Quantity increase/decrease theo nhóm và lưu lịch sử.
- Đã sửa lỗi `from_quantity/to_quantity` dùng nhầm tồn tổng.
- Đã khóa balance trước khi tính group ledger để tránh stale snapshot/lost update.
- Concurrent increase đã được test.
- Dữ liệu lệch của product ID 1 đã được xử lý production về `total=1`, `BH 7.28=1` theo thông tin vận hành được cung cấp.

### Voucher và in

- List/detail phiếu IN/OUT.
- Phiếu OUT dùng snapshot SKU, tên, warranty note, sale note, unit price, line total và total amount.
- Phiếu legacy thiếu snapshot vẫn mở được.
- Mẫu in A4 cho phiếu OUT, dùng `window.print()`, không tạo/lưu PDF.

### Auth và vận hành

- JWT access/refresh, refresh token hash và rotate.
- Login rate limit riêng: 10 request/15 phút/IP.
- Không còn password admin hard-code.
- Backend hỗ trợ `HOST`, production bind loopback.
- Frontend API client hỗ trợ `/api/v1` tương đối và URL tuyệt đối.

## Đã deploy/test production

Theo nhật ký vận hành hiện có:

- Admin login và Public Lookup qua HTTPS.
- Bán nhiều sản phẩm, trừ tồn và cập nhật Public Lookup.
- Snapshot giá, sale note, history/detail/print.
- Product images.
- Inventory quantity adjustment fix và sửa dữ liệu lệch product ID 1.
- Public Lookup ẩn sản phẩm hết hàng.
- PM2/Nginx reverse proxy, Certbot renewal dry-run và backup cron.

## Chưa làm / backlog

- Chiết khấu VND theo từng dòng tại POS.
- Click đơn giá để mở popup chỉnh chiết khấu.
- Chiết khấu phần trăm: không dùng theo quyết định hiện tại.
- Bảng giá theo warranty group: không làm.
- Bảng giá lái cố định: không theo hướng hiện tại.
- Chiết khấu toàn đơn, thanh toán, khách đưa/tiền thừa.
- Giá nhập, công nợ, lợi nhuận và báo cáo tài chính.
- Bán & In trực tiếp tại POS.
- Draft persistence cho multi-order.
- Mẫu in phiếu nhập và cấu hình logo/mẫu in.
- Compatibility search nâng cao cho máy bộ.
- Backup ảnh tự động ra HDD.

## Next task đã chốt

Khảo sát và thiết kế **chiết khấu bằng số tiền VND theo từng dòng POS**:

- Giá sản phẩm là giá tham chiếu.
- Warranty group chỉ quản lý tồn.
- Người bán click đơn giá, nhập số tiền chiết khấu.
- Giá thực bán = giá tham chiếu - chiết khấu.
- Backend phải lưu snapshot giá thực bán.
- Chưa mở payment, debt, cost hoặc bảng giá theo nhóm.
