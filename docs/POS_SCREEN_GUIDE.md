# Hướng dẫn màn Bán tại quầy

Cập nhật gần nhất: **23/06/2026**

Route: `/admin/stock-out`

Mục tiêu: thao tác bán nhanh, compact, ít click; không biến POS thành form kho hoặc ERP.

## Layout

- Full-screen, không dùng `AdminLayout`.
- Top bar: Home, product search, order tabs, nút tạo order.
- Main: cart bên trái.
- Right panel: customer, tổng số lượng, tổng tiền và submit.
- Hỗ trợ nhiều order tab local; code hiện chưa đặt giới hạn số tab rõ ràng và chưa persist draft sau reload.

## Product search

- Khi có keyword: debounce khoảng 300ms và gọi server-side admin product API.
- Request: `q`, `page=1`, `limit=12`, `is_active=true`.
- Request sequence guard ngăn response cũ ghi đè query mới.
- Khi search rỗng và user focus: hiển thị recent products từ localStorage.
- Không fetch toàn bộ product pages.
- Product hết hàng vẫn có thể xuất hiện và được hiển thị trạng thái tồn theo behavior admin/POS.

Sau khi add:

1. Clear input.
2. Clear debounced keyword.
3. Close dropdown.
4. Focus lại input.
5. Không tự mở recent products.

Dropdown đóng khi click outside, Escape, clear hoặc add thành công. API error phải khác trạng thái “không tìm thấy”.

## Product result

Mỗi result có:

- Thumbnail nếu có.
- Tên.
- SKU.
- Tổng tồn.
- Giá bán mặc định chỉ đọc.
- Warranty/note groups còn tồn.

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

- Thuộc từng row và từng order.
- Tối đa 500 ký tự.
- Trim khi submit; empty/whitespace gửi `null`.
- Textarea compact, rộng khoảng 3cm khi rỗng, tăng đến khoảng 38ch rồi wrap.

Giá:

- `null/undefined`: Chưa thiết lập/Chưa xác định.
- `0`: `0 ₫`.
- Số dương: format VND.
- Line/cart total dùng integer an toàn; overflow hiển thị cảnh báo.
- Chỉ đọc, không parse ngược chuỗi đã format.

## Multi-order

Mỗi order giữ riêng:

- `cartItems`
- `selectedCustomer`
- `saleNote` cấp order nếu có

Switch tab không làm mất dữ liệu. Tạo order mới không kế thừa note/cart/customer. Khi submit thành công chỉ reset order đã bán.

## Submit

Payload:

```json
{
  "customer_id": 1,
  "items": [
    {
      "sku": "example.sku",
      "quantity": 1,
      "warranty_note": "BH 12 tháng",
      "sale_note": "Serial ABC"
    }
  ]
}
```

Không gửi:

```text
unit_price
line_total
total_amount
discount
payment
debt
```

Backend là nguồn validate tồn, lấy giá, snapshot tiền, tạo stock transaction và voucher.

Nếu sale thành công nhưng reload product thất bại, UI phải báo bán đã thành công nhưng chưa refresh dữ liệu; không được báo sale thất bại.

## Customer

- Optional.
- Search/recent/quick create theo flow hiện tại.
- Field thực tế: name, phone, address.
- Inactive customer không xuất hiện.
- Chưa có debt/payment/customer group.

## Giá và next task

Hiện POS chỉ đọc `products.sale_price`.

Task tiếp theo đã chốt về mặt định hướng:

- Click đơn giá mở popup nhỏ.
- Nhập `discount_amount` bằng số tiền VND.
- `discount_amount` là số tiền giảm trên mỗi đơn vị sản phẩm của dòng hàng, không phải tổng số tiền giảm của cả dòng.
- Không dùng phần trăm.
- Đơn giá cuối = giá tham chiếu - `discount_amount`.
- Thành tiền dòng = đơn giá cuối x số lượng.
- Frontend gửi `discount_amount`; không gửi giá cuối hoặc các tổng tiền như nguồn sự thật.
- Backend tự đọc giá tham chiếu hợp lệ, validate discount, tính lại đơn giá cuối, thành tiền, tổng phiếu và lưu snapshot.
- Warranty group chỉ quản lý tồn, không gắn bảng giá.

Chức năng này chưa được code.

## Responsive

- Mục tiêu desktop FullHD và 2K.
- Không body overflow ngang.
- Product/SKU/note phải wrap/truncate an toàn.
- Cart controls không đổi kích thước khi nội dung thay đổi.

## Không thêm nếu chưa có task riêng

- Payment, khách đưa, tiền thừa.
- Debt.
- Giá nhập.
- Discount toàn đơn.
- Invoice.
- Báo cáo.
- Bán & In.
