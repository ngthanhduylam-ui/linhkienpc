# PROJECT_RULES.md

# Quy tắc cố định của dự án

File này chứa các nguyên tắc an toàn lâu dài cho **VI TÍNH PHƯỚC TÀI POS**. Nếu task cụ thể mâu thuẫn với file này, cần hỏi lại hoặc kiểm tra với `docs/PROJECT_DIRECTION.md`.

## 1. Định hướng bắt buộc

- POS First.
- Offline First.
- Self-hosted.
- Sapo Inspired.
- Stability First.
- Not an ERP.
- Inventory hỗ trợ bán hàng, không dẫn dắt workflow.

## 2. Phạm vi đang bị cấm nếu chưa được yêu cầu rõ

Không thêm hoặc mô tả là đã có:

- Giá nhập.
- Giá bán.
- Chiết khấu.
- Thanh toán.
- Công nợ khách hàng.
- Công nợ nhà cung cấp.
- Hóa đơn/invoice.
- Kế toán.
- Báo cáo tài chính.
- E-commerce checkout.
- Tài khoản khách public.
- Tags/aliases/compatibility search.

Các mục trên là future backlog, không phải feature hiện tại.

## 3. POS và cart

- `/admin/stock-out` là **Bán tại quầy**.
- POS có cart/order list nội bộ để bán tại quầy.
- Cart POS **không phải** e-commerce checkout/cart public.
- Không dùng từ “Xuất & Giao hàng” làm tên UI chính cho POS.
- Không thêm payment/debt/invoice vào POS khi chưa mở phase tài chính.

## 4. Public Lookup

- Route `/` luôn phải public, không login.
- Empty search không được show toàn bộ sản phẩm.
- Không hiển thị admin action, giá, khách hàng, nhà cung cấp hoặc lịch sử giao dịch.
- Public Lookup phải tiếp tục hoạt động sau mọi refactor admin/POS.

## 5. SKU và sản phẩm

- SKU phải unique.
- SKU chỉ dùng chữ thường, số và dấu chấm.
- Không dùng dấu cách, dấu gạch ngang hoặc ký tự đặc biệt trong SKU.
- Model thật có dấu gạch ngang có thể normalize bằng cách bỏ dấu gạch ngang.
- Product inactive không xuất hiện trong selector/search mặc định.
- UI dùng wording `Loại sản phẩm`; backend/database vẫn có thể dùng `category`.

## 6. Tồn kho

- Không sửa trực tiếp bảng tồn kho từ UI thông thường.
- Tồn kho thay đổi qua:
  - Nhập hàng.
  - Bán tại quầy / stock-out.
  - Kiểm hàng / adjustment.
- Mọi thay đổi tồn kho phải tạo stock transaction.
- Bulk stock-in/out tạo stock voucher.
- Stock voucher là phiếu nhập/phiếu bán nội bộ, không phải hóa đơn.

## 7. Nhóm bảo hành / ghi chú

- Tồn theo nhóm hiện dựa trên transaction note/warranty note.
- Workflow chính hiện tại không dùng warranty batch làm đơn vị tồn kho UI.
- Không gộp nhầm các nhóm bảo hành / ghi chú khác nhau khi bán.
- Same SKU + same nhóm có thể merge trong cart POS; same SKU + khác nhóm phải là dòng riêng.

## 8. Khách hàng và nhà cung cấp

- Field đang lưu hiện tại: `name`, `phone`, `address`.
- Không show field giả như tags, tax, customer group, province/ward, debt nếu backend chưa lưu.
- Inactive customer/supplier không xuất hiện trong selector/recent.

## 9. Kỹ thuật

- Một frontend React.
- Một backend Express.
- Một MySQL database.
- Admin route nằm dưới `/admin`.
- Public route chính là `/`.
- Không commit `.env` hoặc secret.
- Tất cả timestamp nghiệp vụ do backend/database sinh.
- Dùng branch `codex-dev` cho phát triển/deploy hiện tại.
