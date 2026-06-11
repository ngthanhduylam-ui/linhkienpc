# CHANGELOG_POS.md

# VI TÍNH PHƯỚC TÀI POS - POS Changelog

File này ghi lại các mốc thay đổi quan trọng của màn POS và định hướng POS-first. Dùng để chat Codex mới hiểu nhanh lịch sử refactor mà không cần đọc lại toàn bộ hội thoại cũ.

## 2026-06-06 - Direction Reset: POS First

Dự án đổi hướng từ inventory management sang:

VI TÍNH PHƯỚC TÀI POS

Các nguyên tắc được chốt:

- POS First
- Offline First
- Self Hosted
- Sapo Inspired
- Inventory chỉ hỗ trợ bán hàng
- Sales workflow ưu tiên cao hơn warehouse workflow
- Public Lookup vẫn giữ công khai, không login

Các thứ bị cấm trong phase hiện tại:

- pricing
- payment
- invoices
- discounts
- ERP workflows
- keyboard shortcut UI kiểu F1/F3/F6/F8/F10

## Phase A - POS Refactor

Mục tiêu Phase A: biến `/admin/stock-out` thành màn bán tại quầy thật sự.

### A.1 - Rename Stock Out UX to POS

- `Xuất & Giao hàng` đổi hướng thành `Bán tại quầy`.
- Sidebar label đổi sang `Bán tại quầy`.
- Vẫn giữ backend/API stock-out cũ.
- Không đổi business logic.

### A.2 - Full-screen POS Screen

`/admin/stock-out` được tách khỏi AdminLayout.

Kết quả:

- Ẩn AdminSidebar.
- Ẩn AdminHeader.
- Thêm top POS bar.
- Thêm product search trên top bar.
- Thêm visual order tab `Đơn 1`.
- Thêm visual `+` button cho multi-order tương lai.
- Thêm Home button về `/admin`.
- Bỏ thông tin chi nhánh khỏi header.

Màn POS hiện có layout:

- Left/main: search sản phẩm + cart table/list.
- Right panel: customer + giao nhận placeholder + total quantity + note + confirm button.

### A.3 - Product Dropdown Behavior

Đã chốt workflow bắt buộc:

Focus search
→ recent products
→ search products
→ select warranty group
→ add product
→ clear search
→ close dropdown
→ focus search again

Sau khi add product:

- search input phải clear
- debounced search phải clear
- dropdown phải đóng
- visible suggestions reset
- focus quay lại search input
- dropdown không được tự mở lại recent products

Dropdown chỉ mở lại khi:

- user click/focus search input
- hoặc user bắt đầu gõ

### A.4 - Click Outside Dropdown Fix

Vấn đề cũ:

- Search input nằm trong header.
- Dropdown render trong main.
- Hai ref riêng khiến click-outside không ổn định.

Cách sửa đúng:

- Dùng một `dropdownContainerRef` duy nhất.
- Bọc cả search input và dropdown trong cùng container.
- Document mousedown chỉ cần kiểm tra `dropdownContainerRef.current.contains(event.target)`.

Kết quả cần giữ:

- Click search input: dropdown mở.
- Click trong dropdown: dropdown giữ mở.
- Click +/- trong dropdown: dropdown giữ mở.
- Click Add: add product, dropdown đóng.
- Click vùng trắng/right panel/textarea: dropdown đóng.
- Escape: dropdown đóng.

### A.5 - Compact Sapo-style Density

Đã polish UI để bớt admin-form:

- Dropdown product width gọn hơn.
- Product row thấp hơn.
- SKU/category nhỏ và muted.
- Tồn kho nằm bên phải.
- Warranty group row nhỏ hơn.
- Stepper nhỏ hơn.
- Cart row gọn hơn.
- Right panel ít whitespace hơn.
- Button chính đổi thành `Xác nhận bán`.

Vẫn chưa thêm:

- giá
- thanh toán
- hóa đơn
- chiết khấu
- công nợ

## Current POS State

Route chính:

`/admin/stock-out`

Ý nghĩa:

`Bán tại quầy`

Đang hoạt động:

- Full-screen POS.
- Home button về `/admin`.
- Product search.
- Recent products.
- Product dropdown.
- Warranty group selection.
- Add to cart.
- Cart table/list.
- Customer selector.
- Note.
- Total quantity.
- Confirm sale.
- Backend stock-out voucher creation giữ nguyên.

## Known Remaining POS Work

Các việc nên làm tiếp, theo thứ tự:

1. Tiếp tục làm dropdown giống Sapo hơn nữa.
2. Giảm nested layout trong warranty group.
3. Chuẩn bị flow tương lai: add product trước, chọn warranty trong cart.
4. Thêm multi-order thật sự cho `Đơn 1` và nút `+`.
5. Thêm confirm đóng đơn nếu cart có sản phẩm.
6. Làm CustomerSelector gọn hơn theo POS style.
7. Sau khi POS ổn mới tính pricing/payment/debt.

## Regression Checklist

Sau mỗi lần sửa POS, phải test:

1. Mở `/admin/stock-out`.
2. Admin sidebar/header bị ẩn.
3. Home button về `/admin`.
4. Focus search hiển thị recent products.
5. Typing filter products.
6. Click outside đóng dropdown.
7. Escape đóng dropdown.
8. Click +/- trong dropdown không đóng dropdown.
9. Click `Thêm` add product.
10. Sau add, search input clear.
11. Sau add, dropdown đóng.
12. Sau add, focus quay lại search input.
13. Dropdown không tự mở lại.
14. Typing tiếp mở dropdown lại.
15. Cart row hiển thị product name, SKU, warranty, quantity.
16. Remove product hoạt động.
17. Clear all hỏi confirmation.
18. Customer selection hoạt động.
19. Note nhập được.
20. `Xác nhận bán` vẫn tạo stock-out voucher.
21. Inventory validation vẫn hoạt động.
22. Public Lookup không bị ảnh hưởng.
