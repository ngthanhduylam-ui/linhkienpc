# BUSINESS_RULES.md

Tài liệu này là nguồn tham chiếu nghiệp vụ hiện tại cho **VI TÍNH PHƯỚC TÀI POS**.

## 1. Phạm vi hệ thống

Hệ thống phục vụ cửa hàng linh kiện PC:

- Tra cứu tồn kho công khai.
- Quản lý sản phẩm và loại sản phẩm.
- Nhập hàng.
- Bán tại quầy / xuất kho.
- Kiểm hàng và điều chỉnh tồn.
- Quản lý khách hàng, nhà cung cấp.
- Xem lịch sử phiếu nhập / phiếu bán.

Hiện tại admin product API và Product Admin UI đã có `sale_price` optional/nullable để lưu giá bán mặc định của sản phẩm. Backend bulk stock-out snapshot giá này vào phiếu bán, nhưng frontend POS chưa hiển thị/tính tiền và hệ thống chưa có thanh toán, công nợ hoặc báo cáo tài chính.

Hiện tại **không** có:

- Giá nhập, chiết khấu.
- Thanh toán, công nợ.
- Hóa đơn, kế toán, báo cáo tài chính.
- E-commerce checkout.
- Tài khoản khách công khai.
- Tags/aliases/compatibility search.

## 2. Sản phẩm và SKU

- SKU đại diện cho một model sản phẩm và phải unique.
- SKU chỉ dùng chữ thường, số và dấu chấm.
- Không dùng dấu cách, dấu gạch ngang hoặc ký tự đặc biệt trong SKU.
- UI tự chuyển SKU nhập hoa thành chữ thường.
- Product inactive không xuất hiện trong public search và list mặc định.
- Khi tạo product, hệ thống tạo dòng tồn ban đầu trong `product_inventory_balances` với số lượng 0.
- Product thuộc một loại sản phẩm (`category_id` trong API/database, UI gọi là “Loại sản phẩm”).
- `sale_price` là giá bán mặc định optional/nullable trong admin product API và có thể quản lý trong Product Admin UI. `NULL` nghĩa là chưa thiết lập giá bán, `0` là giá bán thực sự bằng 0.
- Phase 2A snapshot `sale_price` khi bán qua backend bulk stock-out. Sản phẩm chưa có giá vẫn bán được; dòng thiếu giá có `unit_price = NULL`, `line_total = NULL`, và nếu đơn có bất kỳ dòng thiếu giá thì `total_amount = NULL`.
- `sale_price = 0` là giá bán thực sự bằng 0, không phải trạng thái thiếu giá.

Ví dụ SKU hợp lệ:

```text
2nd.maybo.lenovo.v50t13imb
2nd.cpu.intel.12400f
new.ram.ddr4.8gb
```

## 3. Loại sản phẩm

- Loại sản phẩm lưu trong bảng `categories`.
- Backend vẫn dùng tên kỹ thuật `category`.
- UI hiển thị là “Loại sản phẩm” để gần cách dùng thực tế/Sapo hơn.
- Deactivate loại sản phẩm không tự động deactivate sản phẩm đang active.

## 4. Tồn kho

- Nguồn tồn hiện tại là `product_inventory_balances`.
- Không chỉnh trực tiếp bảng tồn từ UI.
- Tồn chỉ thay đổi qua:
  - nhập hàng,
  - bán/xuất hàng,
  - kiểm hàng/điều chỉnh tồn.
- Mỗi thay đổi tồn cần có lịch sử trong `stock_transactions` hoặc bảng điều chỉnh tương ứng.
- Stock-out không được vượt tổng tồn hoặc vượt tồn theo nhóm bảo hành/ghi chú đã chọn.

## 5. Nhóm bảo hành / ghi chú

- Workflow hiện tại không dùng `warranty_batches` làm đơn vị nhập/xuất chính.
- Nhóm bảo hành/ghi chú được lấy từ note của giao dịch nhập/xuất và điều chỉnh tồn.
- Nhóm trống được hiểu là không ghi chú.
- POS/stock-out phải chọn đúng nhóm còn tồn trước khi xuất.
- Public lookup hiển thị nhóm bảo hành/ghi chú còn tồn để người dùng tra cứu.

## 6. Nhập hàng

- Route UI chính: `/admin/stock-in`.
- API chính: `POST /api/v1/admin/stock-in/bulk`.
- Nhà cung cấp là optional.
- Mỗi dòng nhập có:
  - SKU/product,
  - số lượng dương,
  - nhóm bảo hành/ghi chú optional.
- Nhập hàng cộng tồn và tạo phiếu nhập.
- Không có giá nhập, thanh toán hoặc công nợ trong workflow hiện tại.

## 7. Bán tại quầy / xuất kho

- Route UI chính: `/admin/stock-out`.
- API chính: `POST /api/v1/admin/stock-out/bulk`.
- Khách hàng là optional.
- Cart/đơn local chỉ là trạng thái frontend để thao tác nhanh tại quầy.
- Cùng SKU + cùng nhóm bảo hành/ghi chú được merge trong cart.
- Số lượng bán tối thiểu là 1 và tối đa là tồn còn lại của nhóm đã chọn.
- Bán thành công tạo phiếu bán/stock voucher.
- Backend snapshot giá bán mặc định vào `stock_voucher_items` cho phiếu bán. Việc snapshot này không thay đổi quy tắc trừ tồn.
- Serial/Ghi chú bán hàng theo từng dòng là dữ liệu riêng của dòng phiếu, tách khỏi nhóm bảo hành/tồn kho. Từ Task 7B, backend bulk stock-out đã nhận optional `sale_note`, trim và lưu vào `stock_voucher_items.sale_note_snapshot`; POS UI chưa có ô nhập hoặc hiển thị field này.
- `sale_note` không ảnh hưởng tồn kho, không thay thế `warranty_note_snapshot` và không được ghi vào `stock_transactions.note`.
- Chưa có thanh toán, giảm giá, công nợ, hóa đơn hoặc báo cáo tài chính.
- Phiếu bán không phải hóa đơn thanh toán.

## 8. Kiểm hàng

- Route UI: `/admin/inventory-check`.
- Dùng để tìm sản phẩm, xem tồn, tăng/giảm tồn theo nhóm ghi chú và ghi lý do.
- Nếu tìm không thấy sản phẩm, UI có hành động “+ Thêm sản phẩm mới”.
- Đây chưa phải hệ thống phiếu kiểm hàng đầy đủ theo kiểu ERP.

## 9. Khách hàng

- Customer dùng cho POS/stock-out.
- Các trường đang dùng thực tế:
  - tên,
  - số điện thoại,
  - địa chỉ.
- Customer inactive không xuất hiện trong selector/list mặc định.
- Không có công nợ, nhóm khách hàng, tags, tax, email hoặc địa chỉ tỉnh/huyện/xã tách riêng trong API hiện tại.

## 10. Nhà cung cấp

- Supplier dùng cho stock-in.
- Các trường đang dùng thực tế:
  - tên,
  - số điện thoại,
  - địa chỉ.
- Supplier inactive không xuất hiện trong selector/list mặc định.
- Không có công nợ, tags, tax, email hoặc địa chỉ tỉnh/huyện/xã tách riêng trong API hiện tại.

## 11. Public lookup

- Public route `/` không yêu cầu login.
- UI không hiển thị tất cả sản phẩm khi ô tìm kiếm trống.
- Public search dùng để tra theo tên sản phẩm, SKU hoặc ghi chú bảo hành.
- Không hiển thị:
  - giá,
  - admin actions,
  - khách hàng/nhà cung cấp,
  - lịch sử giao dịch nội bộ.

## 12. Auth admin

- Admin login bằng username/password.
- Password lưu bằng bcrypt hash.
- Access token dùng JWT.
- Refresh token được hash trong database và rotate khi refresh.
- Admin inactive không được login.
- Protected API dùng `requireAuth`.

## 13. Không tự ý mở rộng scope

Không thêm các mảng sau nếu chưa có yêu cầu phase riêng:

- price/pricing,
- payment,
- debt/công nợ,
- invoice,
- accounting,
- reporting,
- search tags/aliases/compatibility,
- barcode/serial/IMEI/lô-HSD management.
