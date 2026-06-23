# Quy tắc cố định của VI TÍNH PHƯỚC TÀI POS

Cập nhật gần nhất: **23/06/2026**

## 1. Định hướng

- POS First, Self-Hosted, Sapo-inspired, Stability First, Not an ERP.
- Kho hỗ trợ bán hàng; không biến workflow thành phần mềm kho thuần túy.
- “Offline First” là ưu tiên hạ tầng tại cửa hàng và khả năng vận hành nội bộ, không phải tuyên bố frontend đã có PWA/offline sync.

Thứ tự ưu tiên sản phẩm:

1. Bán tại quầy.
2. Khách hàng.
3. Bảo hành.
4. Công nợ khi có phase riêng.
5. Kho hỗ trợ bán hàng.
6. Báo cáo sau khi dữ liệu vận hành ổn định.

## 2. Scope không tự mở rộng

Chưa được mô tả là đã có:

- Giá nhập.
- Chiết khấu hoặc sửa giá trực tiếp tại POS.
- Thanh toán, khách đưa, tiền thừa.
- Công nợ khách hàng/nhà cung cấp.
- Hóa đơn, kế toán, lợi nhuận hoặc báo cáo tài chính.
- E-commerce checkout.
- Alias/compatibility/fuzzy search đầy đủ.
- Quản lý serial riêng từng thiết bị.

Giá bán mặc định, snapshot tiền phiếu bán, Serial/Ghi chú theo dòng và mẫu in A4 là chức năng hiện có.

## 3. POS

- Route chính: `/admin/stock-out`, tên UI: **Bán tại quầy**.
- Cart POS không phải shopping cart public.
- Same SKU + same warranty group được merge; khác group phải là dòng riêng.
- `sale_note` không tham gia merge key.
- Giá hiện chỉ đọc; frontend không gửi `unit_price`, `line_total`, `total_amount`.
- Không thêm modal bắt buộc làm chậm thao tác bán nếu không có yêu cầu rõ.

## 4. Sản phẩm và giá

- SKU unique, chỉ gồm chữ thường, số và dấu chấm.
- `sale_price` nullable: `NULL` là chưa thiết lập, `0` là giá hợp lệ.
- Nhóm bảo hành/tình trạng chỉ dùng quản lý tồn, không gắn bảng giá cố định.
- Hướng tiếp theo đã chốt nhưng chưa code: dùng giá sản phẩm làm giá tham chiếu và chiết khấu VND theo từng dòng tại POS; không dùng phần trăm.

## 5. Tồn kho

- Không sửa trực tiếp balance từ UI thông thường.
- Tồn thay đổi qua stock-in, stock-out hoặc inventory-check.
- Bulk stock-in/out phải tạo stock voucher và stock transactions.
- Quantity adjustment phải chạy trong transaction, khóa balance trước khi tính ledger nhóm, và ghi `from_quantity/to_quantity` theo tồn nhóm.
- Note move không đổi tổng tồn.
- `stock_transactions.note` chỉ lưu nhóm bảo hành/tồn, không lưu `sale_note`.

## 6. Public Lookup

- Route `/` luôn public và search rỗng không trả toàn bộ sản phẩm.
- Search/list chỉ trả product active có `COALESCE(product_inventory_balances.quantity, 0) > 0`.
- Product tồn 0 hoặc thiếu balance bị ẩn; khi tồn tăng lại sẽ tự xuất hiện.
- Public detail trực tiếp theo SKU hiện giữ hành vi riêng để tương thích.
- Không trả giá, snapshot tiền, sale note, khách hàng, nhà cung cấp hoặc lịch sử nội bộ.

## 7. Auth và vận hành

- Admin API nằm dưới `/api/v1/admin`.
- Login rate limit: 10 request/15 phút/IP, chỉ áp dụng endpoint login.
- Express chỉ trust proxy loopback.
- Production backend bind `127.0.0.1`.
- Không commit `.env`, secret, password, token hoặc backup thật.
- Không deploy khi server dirty, backup lỗi, migration chưa test hoặc chưa có commit rollback.

## 8. Cách làm việc với Codex

- Đọc code, routes, migrations và Git status trước khi sửa.
- Code đang chạy là nguồn sự thật khi tài liệu mâu thuẫn.
- Không ghi feature “đã hoàn thành” nếu chưa xác minh trong code.
- Không sửa file dirty ngoài task.
- Không commit, push, deploy nếu người dùng chưa yêu cầu rõ.
