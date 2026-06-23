# VI TÍNH PHƯỚC TÀI POS - Định hướng

Cập nhật gần nhất: **23/06/2026**

## Triết lý sản phẩm

```text
POS First
Offline First
Self-Hosted
Sapo-inspired workflow
Stability First
Not an ERP
```

“Offline First” trong giai đoạn hiện tại nghĩa là hệ thống và dữ liệu do cửa hàng tự quản, ưu tiên dùng trong hạ tầng tại cửa hàng. Frontend chưa phải PWA có offline sync.

Kho là nền tảng hỗ trợ bán hàng, không phải trung tâm để mở rộng thành workflow ERP nhiều bước.

## Thứ tự ưu tiên

1. Bán tại quầy nhanh và chính xác.
2. Khách hàng.
3. Bảo hành và Serial/Ghi chú phục vụ hậu mãi.
4. Công nợ khi có phase riêng.
5. Kho hỗ trợ bán hàng.
6. Báo cáo sau khi dữ liệu đủ ổn định.

## Trạng thái hiện tại

Production trial đã có:

- Public Lookup.
- Product Admin và product images.
- Stock-in, POS stock-out và Inventory Check.
- Customer/Supplier.
- Sale price mặc định và snapshot giá phiếu bán.
- Sale note theo dòng.
- Voucher history/detail và in A4.
- Auth, backup và hardening production cơ bản.

## Quyết định về giá

Hiện tại:

- `products.sale_price` là giá bán tham chiếu chung.
- Backend bulk stock-out snapshot `unit_price`, `line_total`, `total_amount`.
- POS chỉ hiển thị giá; chưa cho sửa.

Quyết định cho phase tiếp theo:

- Warranty group/tình trạng chỉ quản lý tồn, không gắn bảng giá.
- Người bán có thể click đơn giá tại POS.
- Popup nhỏ cho nhập `discount_amount` bằng số tiền VND.
- `discount_amount` là số tiền giảm trên mỗi đơn vị sản phẩm của dòng hàng, không phải tổng số tiền giảm của cả dòng.
- Không dùng phần trăm.
- Đơn giá cuối = giá tham chiếu - `discount_amount`.
- Thành tiền dòng = đơn giá cuối x số lượng.
- Frontend gửi `discount_amount`; backend tự đọc giá tham chiếu, validate discount và tự tính lại đơn giá cuối, thành tiền, tổng phiếu.
- Chiết khấu theo từng dòng và lưu snapshot trên phiếu.

Quyết định này mới là hướng triển khai, chưa phải tính năng đã hoàn thành.

## Những hướng không làm hiện tại

- Giá cố định theo warranty group.
- Bảng giá lái cố định.
- ERP inventory/accounting workflow.
- Discount phần trăm.
- E-commerce checkout.
- Payment, debt, cost và reporting trong cùng một task.

## Roadmap

### Hiện tại

- Theo dõi lỗi production có bước tái hiện rõ.
- Kiểm tra backup, dung lượng, PM2/Nginx/MySQL sau reboot.
- Ưu tiên integrity của tồn và phiếu.

### Task gần nhất

- Thiết kế chiết khấu VND theo dòng POS và snapshot backend.

### Backlog sau ổn định

- Bán & In.
- Draft persistence.
- Warranty history theo khách hàng.
- Compatibility search nâng cao.
- Backup ảnh tự động.
- Công nợ và báo cáo chỉ mở bằng phase riêng.
