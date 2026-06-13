# POS_SCREEN_GUIDE.md

# Hướng dẫn màn Bán tại quầy / POS

Tài liệu này là guide chính thức cho `/admin/stock-out`. Mục tiêu là giữ POS nhanh, ổn định, ít click và không trượt về hướng form kho/ERP.

## 1. Purpose of `/admin/stock-out`

Route: `/admin/stock-out`

Tên nghiệp vụ: **Bán tại quầy**

Ý nghĩa:

- Màn POS chính của hệ thống.
- Dùng để tìm sản phẩm, chọn nhóm bảo hành / ghi chú, thêm vào đơn và hoàn tất bán hàng.
- Backend/API vẫn dùng stock-out/bulk và stock voucher để trừ tồn, nhưng UI phải nói ngôn ngữ POS.

Không gọi màn này là “Xuất & Giao hàng” trong UI chính.

## 2. Full-screen Layout

`/admin/stock-out` dùng layout riêng:

- Không dùng AdminSidebar.
- Không dùng AdminHeader.
- Không dùng AdminLayout padding/max-width.
- Full-screen, ưu tiên thao tác tại quầy.

Bố cục chính:

- Top POS bar.
- Khu vực cart/order bên trái.
- Right panel cho khách hàng và summary.

## 3. Top Bar

Top bar gồm:

1. Home button
   - Icon-only.
   - Link về `/admin`.
   - Luôn hiển thị.

2. Product search
   - Placeholder hiện tại: `Tìm sản phẩm theo tên hoặc SKU`.
   - Là điểm focus chính của POS.
   - Không hiển thị shortcut giả như F1/F3/F10.

3. Order tabs
   - `Đơn 1`, `Đơn 2`, ...
   - Active tab rõ ràng.
   - Inactive tab nhẹ hơn.
   - Tabs có thể scroll ngang khi nhiều đơn.

4. New order button `+`
   - Nằm ngay sau tab cuối.
   - Không pin ở mép phải màn hình.
   - Tạo đơn local mới và switch sang đơn đó.

## 4. Home Button

Home button đưa về `/admin`.

Yêu cầu:

- Dễ thấy nhưng không chiếm quá nhiều diện tích.
- Không làm mất state nếu user đang thao tác mà chưa chủ động rời trang; hiện tại đây là link điều hướng bình thường nên cần cẩn trọng khi dùng.

## 5. Product Search Behavior

Luồng chính:

1. User focus/click vào search.
2. Nếu input rỗng, hiển thị recent products.
3. Nếu user gõ, hiển thị matching products.
4. User chọn nhóm bảo hành / ghi chú.
5. User click `Thêm`.
6. Product được thêm vào cart.
7. Search reset và sẵn sàng cho sản phẩm kế tiếp.

Search cần ưu tiên:

- Tên sản phẩm.
- SKU.
- Không phụ thuộc tags/aliases/compatibility vì chưa implement.

## 6. Recent Products Behavior

Recent products:

- Dùng để tăng tốc thao tác.
- Lưu localStorage.
- Chỉ hiện khi search rỗng và user chủ động focus/click.
- Không hiện inactive products.
- Không tự động reopen ngay sau khi add.

## 7. Product Dropdown Behavior

Dropdown là POS autocomplete, không phải admin form.

Yêu cầu:

- Floating dưới search.
- Không đẩy layout.
- Compact, nhiều sản phẩm visible trước khi scroll.
- Width phù hợp desktop 1920×1080 và 2560×1440.
- Product row hiển thị: tên sản phẩm, SKU, tổng tồn.
- Hết hàng phải muted/khó nhầm.
- Không hiển thị category nếu làm row rối.
- Không hiển thị giá/payment/debt.

Dropdown đóng khi:

- Click outside.
- Escape.
- Add product thành công.
- User clear search.

Dropdown không đóng khi:

- Click trong dropdown để chọn warranty group/add.
- Tương tác với nội dung dropdown.

## 8. Warranty / Note Selection

Current version:

- Nhóm bảo hành / ghi chú được chọn **trước khi thêm vào cart**.
- Mỗi warranty row hiển thị label, quantity còn lại và button `Thêm`/`+1`/`✓ Đã chọn đủ`.
- Nếu SKU + note group đã có trong cart, dropdown phải cho user hiểu đã chọn bao nhiêu.
- Nếu đã chọn đủ tồn, button disabled và text rõ ràng.

Nguồn nhóm:

- Transaction note / warranty note.
- Inventory note/quantity adjustments.
- Nhóm `Không ghi chú` nếu có tồn không note.

Future only:

- Chuyển warranty selection vào cart.
- Không làm trong phase hiện tại nếu chưa có yêu cầu riêng.

## 9. Add-to-cart Behavior

Khi click `Thêm`:

- Thêm quantity = 1.
- Nếu same SKU + same nhóm bảo hành / ghi chú đã có trong cart, tăng quantity thêm 1.
- Không vượt quá tồn của nhóm đó.
- Không thay đổi backend payload ngoài logic hiện có.

## 10. Required Reset Sequence After Add

Sau khi add thành công, bắt buộc:

1. Clear search input.
2. Clear debounced search.
3. Close dropdown.
4. Reset suggestions/active item nếu cần.
5. Focus search input.
6. Không reopen recent products tự động.

User phải có thể gõ tiếp ngay để thêm sản phẩm khác.

## 11. Cart Table Behavior

Cart hiện là table/list compact.

Cột chính:

- Sản phẩm
- SKU
- Nhóm bảo hành / ghi chú
- Số lượng
- Xóa

Yêu cầu:

- Product name là primary.
- SKU compact, có thể wrap/break khi dài.
- Nhóm bảo hành / ghi chú dễ thấy.
- Quantity controls đủ lớn để click.
- Không horizontal scroll trên desktop bình thường.
- Delete action nhanh và rõ.

Không dùng card lớn kiểu admin cho từng dòng.

## 12. Quantity Rules

Quantity trong cart:

- Tối thiểu 1.
- Tối đa `item.maxQuantity` theo nhóm tồn.
- Minus disabled khi quantity <= 1.
- Plus disabled khi quantity >= maxQuantity.
- Manual typing được phép.
- Giá trị invalid phải clamp an toàn.
- Submit dùng quantity mới nhất trong cart.

## 13. Duplicate SKU + Note-group Merge Behavior

Cart key dựa trên:

- SKU
- normalized warranty/note group

Nếu add cùng SKU + cùng nhóm:

- Merge vào dòng hiện có.
- Tăng quantity thêm 1.
- Không vượt tồn.

Nếu cùng SKU nhưng khác nhóm:

- Tạo dòng riêng.
- Quantity riêng.
- Validation riêng theo nhóm.

## 14. Customer Selector

Customer selector nằm ở right panel.

Hiện tại:

- Customer optional nếu backend cho phép `customer_id` không có.
- Recent customers.
- Search khách hàng.
- Quick create khách hàng nếu current flow hỗ trợ.
- Selected customer card hiển thị tên, phone và nút đổi.
- Inactive customers không được hiển thị trong selector/recent.

Không thêm debt/payment/address refactor trong POS ở phase hiện tại.

## 15. Multiple Order Tabs

Hiện tại POS hỗ trợ nhiều order local state:

- `Đơn 1`, `Đơn 2`, ...
- Button `+` tạo đơn mới.
- Mỗi order giữ riêng cartItems, selectedCustomer và note state nếu có.
- Search input có thể shared/reset khi switch.
- Switching tab không submit hoặc clear đơn khác.

Chưa có draft persistence localStorage/session.

## 16. Closing Draft Orders

Close tab:

- Nếu đơn có sản phẩm/khách hàng/note, hỏi confirm:
  `Đơn này chưa được lưu. Bạn có chắc muốn đóng đơn?`
- Nếu còn một đơn cuối, close sẽ clear đơn đó thay vì remove toàn bộ tab.
- Khi đang submitting, không cho switch/create/close order.

## 17. Submit Behavior

Submit button hiện dùng wording: `Hoàn tất bán hàng`.

Submit:

- Gửi only active order.
- Gọi `bulkStockOutRequest`.
- Payload giữ logic backend hiện có.
- Backend validate tồn kho.
- Backend tạo stock voucher.
- Sau success, clear active order.
- Other order tabs không bị clear.

## 18. Double-submit Prevention

Trong lúc `isSubmitting`:

- Không cho submit lần 2.
- Disable create/switch/close order.
- Disable clear cart.
- Disable remove product.
- Disable quantity changes.
- Disable customer change.
- Confirm button hiển thị trạng thái xử lý.

`handleSubmit` phải guard ngay từ đầu nếu đang submitting.

## 19. Success versus Refresh Failure Handling

Quy tắc quan trọng:

- Nếu `bulkStockOutRequest` thành công, sale được xem là thành công.
- Clear active order.
- Show success, kèm voucher code nếu response có.
- Sau đó reload products/tồn kho riêng.
- Nếu reloadProducts fail, báo warning: bán thành công nhưng chưa làm mới tồn kho.
- Không được báo “bán thất bại” sau khi backend đã tạo sale/voucher thành công.

## 20. Empty Cart State

Empty cart state nên:

- Cân giữa khu vực chính.
- Icon muted.
- Text gợi ý: `Tìm và chọn sản phẩm để bắt đầu bán hàng.`
- Có action `Thêm sản phẩm ngay` để focus search.
- Không dùng admin card nặng.

## 21. Responsive Desktop Behavior

Màn hình mục tiêu:

- 1920×1080
- 2560×1440

Yêu cầu:

- Top bar không bị vỡ.
- `+` nằm ngay sau order tab cuối.
- Cart table không overflow ngang trên desktop bình thường.
- Dropdown đủ rộng để đọc nhưng không che toàn màn.
- Right panel đủ compact, không dư whitespace lớn.

Mobile không phải ưu tiên cho POS admin, nhưng không nên crash layout nghiêm trọng.

## 22. Explicitly Forbidden POS Scope

Không thêm vào POS hiện tại:

- Giá bán
- Giá nhập
- Chiết khấu
- Thanh toán
- Công nợ
- Hóa đơn
- VAT/tax
- Báo cáo tài chính
- Marketplace/e-commerce workflow
- Keyboard shortcut UI giả
- ERP workflow

Stock voucher hiện là phiếu giao dịch kho/bán nội bộ, không phải invoice.

## 23. Manual Regression Checklist

Sau mỗi lần sửa POS, test tối thiểu:

1. Mở `/admin/stock-out`.
2. Admin sidebar/header bị ẩn.
3. Home button về `/admin`.
4. Focus search rỗng hiển thị recent products.
5. Typing filter products.
6. Click outside đóng dropdown.
7. Escape đóng dropdown.
8. Click `Thêm` add product.
9. Sau add, search input clear.
10. Sau add, debounced search clear.
11. Sau add, dropdown đóng.
12. Sau add, focus quay lại search input.
13. Dropdown không tự mở lại.
14. Add same SKU + same note group tăng quantity.
15. Add same SKU + khác note group tạo dòng riêng.
16. Quantity +/- hoạt động.
17. Quantity không vượt tồn.
18. Remove product hoạt động.
19. Clear all hỏi confirmation.
20. Customer selector hoạt động.
21. Multiple order switch không leak state.
22. Close draft order có confirm.
23. Submit sale tạo voucher.
24. Nếu refresh tồn lỗi sau success, UI không báo sale failed.
25. Public Lookup không bị ảnh hưởng.
