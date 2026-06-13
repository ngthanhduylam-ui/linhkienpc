# PROJECT_DIRECTION.md

# VI TÍNH PHƯỚC TÀI POS - Định hướng chính thức

Tài liệu này là nguồn nhớ dài hạn cho các phiên Codex mới. Nếu có mâu thuẫn với ghi chú cũ, ưu tiên tài liệu này và kiểm tra lại code hiện tại trước khi sửa.

## 1. Project Identity

Tên dự án: **VI TÍNH PHƯỚC TÀI POS**

Định hướng chính thức:

- POS First
- Offline First
- Self-hosted
- Sapo Inspired
- Fast operation
- Minimal clicks
- Not an ERP
- Stability before advanced finance features

Dự án phục vụ cửa hàng linh kiện PC và sửa chữa máy tính VI TÍNH PHƯỚC TÀI. Ứng dụng chạy nội bộ, tự host, ưu tiên thao tác bán tại quầy và tra cứu tồn kho nhanh.

## 2. Business Context

Bối cảnh kinh doanh hiện tại:

- Cửa hàng máy tính, linh kiện PC và dịch vụ sửa chữa.
- Bán linh kiện và số lượng theo lô cho khách reseller/cửa hàng khác là luồng quan trọng.
- Khách lẻ tại quầy vẫn có, nhưng không phải lý do để biến hệ thống thành ERP/phần mềm bán lẻ phức tạp.
- Tra cứu tồn kho nhanh, chọn đúng nhóm bảo hành / ghi chú và bán tại quầy ổn định quan trọng hơn quản trị kho nhiều bước.

## 3. POS-first Philosophy

Inventory tồn tại để hỗ trợ bán hàng.

Mỗi thay đổi UI/UX cần tự hỏi:

> Nếu đây là Sapo POS, thao tác này sẽ được làm thế nào để người bán xử lý nhanh hơn, ít click hơn, ít nhầm hơn?

Ưu tiên:

1. Tốc độ bán tại quầy.
2. Màn hình rõ, gọn, dễ scan.
3. Ít thao tác phụ.
4. Dữ liệu tồn kho đúng và có lịch sử giao dịch.
5. Không đưa tính năng tài chính nâng cao vào khi workflow POS chưa đủ ổn định.

## 4. Official Priorities

Thứ tự ưu tiên sản phẩm:

1. **Bán tại quầy / POS**
2. **Quản lý khách hàng**
3. **Theo dõi bảo hành / nhóm ghi chú**
4. **Theo dõi công nợ** trong phase tương lai, chưa phải hiện tại
5. **Inventory support for sales**
6. **Reports** trong phase tương lai

## 5. Non-goals / Current Forbidden Scope

Không thiết kế dự án thành:

- ERP
- Warehouse-first software
- Enterprise inventory system
- Hệ thống kế toán
- Website thương mại điện tử
- Phần mềm tài chính nhiều quy trình

Không mô tả các mục sau là tính năng active nếu code chưa triển khai:

- Giá bán
- Giá nhập
- Thanh toán
- Chiết khấu
- Công nợ khách hàng
- Công nợ nhà cung cấp
- Kế toán
- Hóa đơn
- Báo cáo tài chính
- Workflow ERP phức tạp

Các tính năng trên chỉ là **future phase**, sau khi hệ thống chạy ổn định đủ lâu với dữ liệu thật.

## 6. UX Principles

Phong cách UI:

- Sapo-inspired, không copy branding.
- Dày thông tin nhưng không rối.
- Bố cục rõ thứ bậc: search -> chọn -> thêm -> xác nhận.
- Form admin phải gọn, tránh cảm giác form hành chính dài.
- Màn POS phải full-screen, nhanh, ưu tiên bàn phím/focus và thao tác lặp lại.
- Không hiển thị keyboard shortcut kiểu F1/F3/F10 nếu chưa thực sự hỗ trợ.
- Không hiển thị field giả hoặc disabled placeholder như “chưa cấu hình” nếu backend chưa lưu.

Từ ngữ UI chính thức:

- Bán tại quầy
- Nhập hàng
- Kiểm hàng
- Sản phẩm
- Loại sản phẩm
- Khách hàng
- Nhà cung cấp
- Lịch sử giao dịch
- Phiếu nhập
- Phiếu bán
- Nhóm bảo hành / ghi chú

Tên cũ như “Xuất & Giao hàng”, “Inventory Workbench”, “Inventory First” chỉ được nhắc trong phần lịch sử migration, không dùng làm ngôn ngữ chính.

## 7. Core Inventory Rules

Quy tắc tồn kho:

- Không sửa trực tiếp số dư tồn kho từ UI thông thường.
- Mọi thay đổi tồn kho phải đi qua Nhập hàng, Bán tại quầy/stock-out hoặc Kiểm hàng/điều chỉnh được duyệt.
- Mọi thay đổi tồn kho phải có stock transaction.
- Bulk stock-in và bulk stock-out tạo stock voucher.
- Stock voucher là phiếu kho/phiếu bán nội bộ, **không phải hóa đơn**.
- Stock operation dựa trên SKU + nhóm bảo hành / ghi chú.
- Product inactive không nên xuất hiện trong selector/search mặc định.

## 8. SKU Strategy

SKU phải duy nhất.

Quy tắc SKU hiện tại:

- Chỉ dùng chữ thường, số và dấu chấm.
- Không dùng dấu cách, dấu gạch ngang hoặc ký tự đặc biệt.
- Ví dụ: `2nd.maybo.lenovo.v50t13imb`
- Model thật có dấu gạch ngang thì bỏ dấu gạch ngang khi tạo SKU.
- Ví dụ: `V50t-13IMB` -> `v50t13imb`

Chiến lược tương lai:

- SKU vẫn unique và đơn giản.
- Search nâng cao sẽ nghiên cứu riêng bằng tags/aliases/compatibility.
- Ví dụ backlog: tìm `gen13th` trả về máy bộ hỗ trợ Intel Gen 13.
- Compatibility rule backlog: model hỗ trợ Gen13 có thể hỗ trợ Gen12; model chỉ hỗ trợ Gen12 không tự động hỗ trợ Gen13.
- Không implement `search_tags`, aliases hoặc compatibility database trong phase hiện tại.

## 9. Warranty / Note Group Strategy

Nhóm tồn kho hiện dựa trên transaction note/warranty note.

Ví dụ nhóm:

- `BH 8.27`
- `BH 12.28`
- `hbh`
- `Không ghi chú`

Quy tắc:

- Bán/nhập/kiểm hàng phải tôn trọng SKU + nhóm bảo hành / ghi chú.
- UI hiện tại không phụ thuộc warranty-batch-first workflow.
- Bảng warranty batch cũ có thể còn tồn tại trong code/database, nhưng không phải hướng UI chính.

## 10. Public Lookup Role

Public Lookup là phần quan trọng của dự án.

Route: `/`

Quy tắc:

- Không yêu cầu login.
- Không hiển thị toàn bộ sản phẩm khi ô tìm kiếm rỗng.
- Hỗ trợ tìm theo tên sản phẩm, SKU và ghi chú bảo hành nếu backend hỗ trợ.
- Hiển thị tổng tồn và nhóm bảo hành / ghi chú.
- Mobile-friendly.
- Không hiển thị giá, khách hàng, nhà cung cấp, lịch sử giao dịch hoặc action admin.
- Có link đăng nhập quản trị.

Public Lookup phải luôn được bảo vệ khi refactor POS/admin.

## 11. Deployment Philosophy

Hướng triển khai:

- Tự host tại cửa hàng.
- Ưu tiên offline/local-first trong mạng nội bộ.
- Không phụ thuộc dịch vụ cloud bên ngoài cho workflow chính.
- Luôn backup database trước deploy server.
- Frontend-only change không restart backend nếu không cần.
- Backend/database change cần cẩn trọng hơn vì đã có dữ liệu thật.

Thông tin server hiện tại theo project memory:

- Ubuntu Server
- Hostname: `linhkienpc`
- User: `vitinhphuoctai`
- IP nội bộ tĩnh: `192.168.1.50`
- Project path: `/opt/linhkienpc/linhkienpc`
- Backend: PM2
- Frontend: Nginx
- Database: MySQL
- Branch deploy/dev: `codex-dev`

## 12. Phased Roadmap

### Phase A - POS core and real-world workflow stabilization

Trọng tâm:

- Bán tại quầy full-screen.
- Product search/dropdown nhanh.
- Nhóm bảo hành / ghi chú rõ ràng.
- Cart gọn, chỉnh số lượng trực tiếp.
- Customer selector gọn.
- Multi-order local state.
- Submit an toàn, chống double submit.
- Public Lookup không bị ảnh hưởng.

### Phase B - Customer/Supplier/Product UX stabilization and voucher history

Trọng tâm:

- Product add/edit Sapo-like.
- Customer/Supplier form tối giản theo field backend đang lưu.
- Nhập hàng gọn theo workflow thực tế.
- Lịch sử giao dịch voucher-first.
- Chuẩn bị nghiên cứu in phiếu, nhưng chưa thêm invoice.

### Phase C - Long-term real-world stability testing on Ubuntu Server

Trọng tâm:

- Chạy với dữ liệu thật đủ lâu.
- Theo dõi lỗi thao tác thực tế.
- Backup/restore ổn định.
- Giảm rủi ro deploy.
- Chỉ sửa lỗi workflow hoặc UX gây nhầm.

### Future phase only

Chỉ mở khi hệ thống POS/inventory đã ổn định:

- Giá nhập / giá bán
- Thanh toán
- Công nợ khách hàng / nhà cung cấp
- Kế toán
- Báo cáo tài chính
- In phiếu nâng cao
- Search tags / aliases / compatibility

Không biến dự án thành ERP-style software.
