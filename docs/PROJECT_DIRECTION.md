# VI TÍNH PHƯỚC TÀI POS - Định hướng

Cập nhật gần nhất: **26/06/2026**

## Triết lý sản phẩm

```text
POS First
Self-Hosted
Sapo-inspired workflow
Stability First
Not an ERP
```

“Offline First” trong các ghi chú cũ chỉ có nghĩa là cửa hàng tự quản hệ thống và dữ liệu trên hạ tầng riêng. Frontend hiện **không** phải PWA offline-sync.

Kho là nền tảng hỗ trợ bán hàng, không phải trung tâm để mở rộng thành ERP nhiều bước.

## Thứ tự ưu tiên

1. Bán tại quầy nhanh và chính xác.
2. Tồn kho đúng.
3. Tra cứu công khai cho khách.
4. Bảo hành và Serial/Ghi chú phục vụ hậu mãi.
5. Phiếu giao dịch rõ ràng.
6. Công nợ/báo cáo chỉ mở bằng phase riêng khi dữ liệu nền đã ổn định.

## Trạng thái hiện tại

Production trial đã có:

- Public Lookup ẩn sản phẩm hết hàng.
- Product Admin, product images tối đa 3 ảnh.
- Category rename và xóa an toàn category chưa dùng.
- Stock-in, POS stock-out và Inventory Check.
- Customer/Supplier.
- Sale price tham chiếu, optional pricing và snapshot giá phiếu bán.
- Per-line fixed VND discount snapshots.
- Sale note theo dòng.
- Voucher history/detail responsive và print page hiện hữu.
- Auth, backup SSD và hardening production cơ bản.

## Quyết định về giá tại POS

Hiện tại:

- `products.sale_price` là giá bán tham chiếu chung.
- `sale_price = NULL`: chưa thiết lập giá; POS vẫn cho bán, manual price là tùy chọn.
- `sale_price = 0`: giá tham chiếu hợp lệ.
- `discount_amount` là số tiền VND giảm trên mỗi đơn vị sản phẩm.
- Backend bulk stock-out là nguồn sự thật: đọc giá tham chiếu, validate request money, tính final unit price, line total và voucher total.
- Frontend không gửi final price hoặc totals.
- Voucher lưu snapshot:
  - `reference_unit_price`;
  - `discount_amount`;
  - `unit_price`;
  - `line_total`;
  - `stock_vouchers.total_amount`.

Không làm hiện tại:

- discount phần trăm;
- bảng giá theo warranty group;
- order-wide discount;
- payment/debt/cost/reporting trong cùng task.

## POS draft persistence rollback

Không coi draft persistence là đã implement.

```text
3dd615e feat: persist unfinished POS order drafts
f736ca2 Revert "feat: persist unfinished POS order drafts"
```

Lý do revert: production verification cho thấy đóng/bán một tab có thể làm mất hoặc sai sibling draft sau refresh.

Nếu làm lại, yêu cầu bắt buộc:

- thiết kế đơn giản hơn;
- test browser thật;
- kiểm tra đóng một tab;
- kiểm tra bán một tab;
- kiểm tra preserve sibling tabs;
- kiểm tra refresh ngay sau thao tác.

## Print direction

Print work đang paused. Hướng hiện tại chỉ là định hướng, chưa phải task implement:

- title tương lai: `Phiếu bán & giao hàng`;
- A4 và A5;
- product rows động;
- long text tự wrap;
- không có cột SKU/code riêng;
- chữ ký: `Người bán` và `Khách hàng`;
- phải review lại trước khi Codex sửa code print.

## Roadmap gần hạn

- Theo dõi lỗi production có bước tái hiện rõ.
- Ưu tiên integrity tồn và phiếu.
- Chỉ chọn task nhỏ, reviewable, POS-first.

## Deferred

- Customer payment/debt.
- Supplier debt.
- Cost price / giá vốn.
- Financial/accounting reports.
- Order-wide discount.
- Advanced invoice/accounting.
- ERP workflow.
