# Hướng dẫn màn Bán tại quầy

Cập nhật gần nhất: **26/06/2026**

Route: `/admin/stock-out`

Mục tiêu: thao tác bán nhanh, compact, ít click; không biến POS thành form kho hoặc ERP.

## Layout

- Full-screen, không dùng `AdminLayout`.
- Top bar: Home, product search, order tabs, nút tạo order.
- Main: cart bên trái.
- Right panel: customer, tổng số lượng, tổng tiền và submit.
- Hỗ trợ nhiều order tab local/in-memory.
- Unfinished order tabs hiện **không persist** qua F5/browser restart vì commit persistence đã revert.

## Product search

- Khi có keyword: debounce và gọi server-side admin product API.
- Request: `q`, `page=1`, `limit=12`, `is_active=true`.
- Request sequence guard ngăn response cũ ghi đè query mới.
- Khi search rỗng và user focus: hiển thị recent products từ localStorage.
- Không fetch toàn bộ product pages.
- Product hết hàng vẫn có thể xuất hiện trong admin/POS search và hiển thị trạng thái tồn.

Sau khi add:

1. Clear input.
2. Clear debounced keyword.
3. Close dropdown.
4. Focus lại input.
5. Không tự mở recent products.

Dropdown đóng khi click outside, Escape, clear hoặc add thành công.

## Product result

Mỗi result có:

- thumbnail nếu có;
- tên;
- SKU;
- tổng tồn;
- giá bán tham chiếu chỉ đọc;
- warranty/note groups còn tồn.

Không cho sửa giá trong dropdown.

## Cart key và warranty group

Cart key:

```text
SKU + normalized warranty group
```

- Same SKU + same group: tăng quantity và giữ nguyên `saleNote`.
- Same SKU + khác group: hai dòng độc lập.
- `saleNote` không tham gia merge key.
- Quantity không vượt tồn group.

## Cart row

Thứ tự cột:

```text
Sản phẩm -> SKU -> Nhóm bảo hành/Ghi chú -> Đơn giá -> Số lượng -> Thành tiền -> Xóa
```

Serial/Ghi chú nằm dưới tên sản phẩm:

- thuộc từng row và từng order;
- tối đa 500 ký tự;
- trim khi submit; empty/whitespace gửi `null`.

Giá:

- `sale_price = NULL`: chưa có giá tham chiếu; user có thể để trống manual price và vẫn bán được.
- manual price trống: `unit_price`, `line_total`, `total_amount` có thể là `NULL`.
- manual price `0`: là giá user nhập rõ ràng, phải được gửi là `0`.
- `sale_price = 0`: là giá tham chiếu hợp lệ.
- Giá dương format VND.
- Discount là số tiền VND giảm trên mỗi đơn vị.
- Line/cart total dùng integer an toàn; overflow hiển thị cảnh báo.

## Multi-order

Mỗi order giữ riêng:

- `cartItems`;
- `selectedCustomer`;
- `saleNote` cấp order nếu có.

Switch tab không làm mất dữ liệu. Tạo order mới không kế thừa note/cart/customer. Khi submit thành công chỉ reset order đã bán.

Current behavior: order tabs chỉ sống trong React state; refresh/browser restart sẽ mất unfinished tabs.

## Submit

Payload hiện tại có thể gồm:

```json
{
  "customer_id": 1,
  "items": [
    {
      "sku": "example.sku",
      "quantity": 1,
      "warranty_note": "BH 12 tháng",
      "sale_note": "Serial ABC",
      "discount_amount": 100000,
      "manual_unit_price": 0
    }
  ]
}
```

Quy tắc:

- `discount_amount` gửi theo từng dòng, mặc định `0`.
- `manual_unit_price` chỉ gửi khi product không có reference price và user thật sự nhập manual price.
- Empty manual input không gửi `manual_unit_price`.
- Manual price `0` phải được giữ là `0`.

Không gửi:

```text
reference_unit_price
final_unit_price
unit_price
line_total
total_amount
payment
debt
```

Backend là nguồn validate tồn, giá, discount, snapshot tiền, stock transaction và voucher.

## Customer

- Optional.
- Search/recent/quick create theo flow hiện tại.
- Field thực tế: name, phone, address.
- Inactive customer không xuất hiện.
- Chưa có debt/payment/customer group.

## POS draft persistence

Tính năng này đã rollback:

```text
3dd615e feat: persist unfinished POS order drafts
f736ca2 Revert "feat: persist unfinished POS order drafts"
```

Không treat as implemented. Nếu làm lại phải có browser tests cho:

- đóng một tab;
- bán một tab;
- preserving sibling tabs;
- F5 ngay sau thao tác;
- browser restart.

## Không thêm nếu chưa có task riêng

- Payment, khách đưa, tiền thừa.
- Debt.
- Giá nhập / giá vốn.
- Discount toàn đơn.
- Invoice.
- Báo cáo.
- Bán & In / print redesign.
