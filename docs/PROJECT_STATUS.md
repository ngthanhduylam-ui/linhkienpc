# VI TÍNH PHƯỚC TÀI POS - Trạng thái dự án

Cập nhật gần nhất: **26/06/2026**

## Current production baseline

```text
Stable commit: f736ca2 Revert "feat: persist unfinished POS order drafts"
Branch:        codex-dev
Status:        Production currently tested stable after reverting POS draft persistence.
```

Commit `3dd615e feat: persist unfinished POS order drafts` was attempted, then reverted by `f736ca2` after production verification failed. Unfinished POS order tabs are **not persisted** across F5/browser restart in the current stable baseline.

## Trạng thái chung

Hệ thống đang ở giai đoạn **Production trial / chạy thử thực tế tại cửa hàng** trên Ubuntu self-hosted. Ưu tiên hiện tại là ổn định bán hàng tại quầy, tồn kho, tra cứu công khai, phiếu giao dịch, ảnh sản phẩm, backup và bảo mật trước khi mở module tài chính.

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

Backup production hiện đã có hệ thống riêng trên Samsung SSD:

- database backup hằng ngày;
- uploads backup;
- backend configuration backup;
- manifest;
- SHA256 checksums;
- restore guide;
- giữ 30 ngày;
- cron lúc 23:00.

Không ghi secret, password, token hoặc nội dung `.env` vào tài liệu.

## Đã hoàn thành trong code

### Product Admin

- List/search/filter/pagination; add/edit; activate/deactivate.
- Validation `Loại sản phẩm` và map lỗi `category_id`.
- Gợi ý category từ token SKU, không ghi đè lựa chọn thủ công.
- Inline category management trong form sản phẩm:
  - đổi tên category tại chỗ, giữ nguyên `category_id` nên sản phẩm vẫn liên kết đúng;
  - xóa an toàn category chưa có sản phẩm sử dụng;
  - category đang được product dùng trả lỗi rõ ràng, không cascade-delete.
- `sale_price` nullable và hiển thị ở form/list.
- Tối đa 5 ảnh/product: upload, replace, reorder, delete, thumbnail và download file tối ưu.

### Product Search

- Multi-token AND, tối đa 8 token; không cần liền nhau hoặc đúng thứ tự.
- Compact normalization hỗ trợ model/SKU có dấu chấm hoặc gạch ngang.
- POS dùng server-side admin product search với debounce và request sequence guard.

### Public Lookup

- Route `/`, không cần đăng nhập.
- Search theo tên, SKU và ghi chú bảo hành.
- Chỉ trả product active có tổng tồn lớn hơn 0.
- Product tồn 0 hoặc chưa có balance bị ẩn; tăng tồn lại sẽ tự xuất hiện.
- Có thumbnail, gallery và download ảnh gốc.
- Không trả giá, snapshot tiền hoặc sale note.

### POS / Bán tại quầy

- Full-screen `/admin/stock-out`, không dùng `AdminLayout`.
- Product/customer search, recent products, thumbnail và chọn warranty/note group.
- Multi-order tabs local/in-memory.
- Order tabs **không persist** qua F5/browser restart ở baseline hiện tại.
- Merge cart row theo SKU + warranty group.
- Serial/Ghi chú riêng từng cart row, tối đa 500 ký tự.
- Optional pricing:
  - `products.sale_price = NULL`: vẫn bán được; manual price là tùy chọn;
  - nếu không nhập manual price, voucher line money và total có thể là `NULL`;
  - `products.sale_price = 0`: là giá tham chiếu hợp lệ.
- Per-line fixed VND discount snapshots:
  - `discount_amount` là số tiền giảm trên mỗi đơn vị;
  - backend đọc giá tham chiếu, validate và tính final unit price/line total/voucher total;
  - frontend không gửi `reference_unit_price`, `final_unit_price`, `unit_price`, `line_total`, `total_amount`.

### Inventory Check

- Tìm sản phẩm, xem tổng tồn và tồn theo nhóm.
- Note move trong một thao tác, tổng tồn không đổi.
- Quantity increase/decrease theo nhóm và lưu lịch sử.
- Đã sửa discrepancy note-group trước đây; không còn nằm trong active backlog.
- Đã khóa balance trước khi tính group ledger để tránh stale snapshot/lost update.

### Voucher

- List/detail phiếu IN/OUT.
- Phiếu OUT dùng snapshot SKU, tên, warranty note, sale note, reference price, discount, unit price, line total và total amount.
- Voucher detail đã responsive, gộp thông tin giá/thành tiền để tránh bảng bị tràn ngang.
- Phiếu legacy thiếu snapshot vẫn mở được.
- Voucher detail/print dùng transaction snapshots, không dùng giá sản phẩm hiện tại.

### Auth và vận hành

- JWT access/refresh, refresh token hash và rotate.
- Login rate limit riêng: 10 request/15 phút/IP.
- Không còn password admin hard-code.
- Backend hỗ trợ `HOST`, production bind loopback.
- Frontend API client hỗ trợ `/api/v1` tương đối và URL tuyệt đối.

## Print status

Print work đang **paused**. Không triển khai thêm print trước khi review lại yêu cầu.

Hướng đã thống nhất cho lần làm sau:

- tiêu đề tương lai: `Phiếu bán & giao hàng`;
- hỗ trợ A4 và A5;
- số dòng sản phẩm động;
- text dài tự wrap;
- không có cột SKU/code riêng;
- chữ ký: `Người bán` và `Khách hàng`;
- cần review yêu cầu lại trước khi Codex implement.

## Active backlog gần hạn

Chỉ giữ các mục nhỏ, an toàn, phù hợp POS-first:

- Concrete POS/voucher polish based on reproducible shop feedback.
- Compatibility search only when real SKU/product examples are supplied.
- Production monitoring and bug fixes with clear reproduction.

## Paused backlog

POS draft persistence is paused after the failed production attempt and revert.

Do not reimplement unless the user explicitly requests it and a simpler design plus complete browser acceptance tests are agreed first.

Required future test cases if reopened:

- close one tab;
- sell one tab;
- preserve sibling tabs;
- refresh immediately;
- browser restart.

## Deferred

Các mục sau vẫn deferred, không làm lẫn vào task POS nhỏ:

- customer payment/debt;
- supplier debt;
- cost price / giá vốn;
- financial/accounting reports;
- order-wide discount;
- advanced invoice/accounting work;
- print implementation mới;
- ERP inventory/accounting workflow.
