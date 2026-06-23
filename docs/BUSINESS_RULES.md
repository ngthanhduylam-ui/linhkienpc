# VI TÍNH PHƯỚC TÀI POS - Quy tắc nghiệp vụ

Cập nhật gần nhất: **23/06/2026**

## 1. Phạm vi

Hệ thống phục vụ:

- Tra cứu tồn công khai.
- Product Admin.
- Nhập hàng, bán tại quầy và kiểm hàng.
- Khách hàng, nhà cung cấp.
- Phiếu nhập, phiếu bán và mẫu in bảo hành.

Không hiện có: giá nhập, discount, payment, debt, invoice, accounting hoặc financial reporting.

## 2. Product và SKU

- SKU unique, chỉ dùng chữ thường, số và dấu chấm.
- Product thuộc một `category_id`; UI gọi là **Loại sản phẩm**.
- Category bắt buộc khi create/update.
- Form có thể gợi ý category từ token thứ hai của SKU. Đây chỉ là gợi ý; lựa chọn thủ công luôn được ưu tiên.
- `sale_price DECIMAL(15,0) NULL`: `NULL` là chưa thiết lập, `0` là giá hợp lệ.
- Tối đa 3 ảnh/product; ảnh `sort_order=1` là ảnh chính.

## 3. Search

- Search product hỗ trợ tối đa 8 token theo logic AND.
- Token không cần liền nhau hoặc đúng thứ tự; mỗi token có thể match field khác nhau.
- Compact search bỏ dấu chấm/gạch ngang cơ bản để hỗ trợ model như `b360m-d` và `b360md`.
- Chưa có alias/compatibility/fuzzy engine đầy đủ.
- POS search gọi server, không fetch toàn bộ pages.

## 4. Public Lookup

- Route UI `/`, API `GET /api/v1/public/products`.
- Search rỗng không trả toàn bộ product.
- Search/list chỉ trả product thỏa:

```sql
p.is_active = 1
AND COALESCE(pib.quantity, 0) > 0
```

- Product active tồn 0 hoặc chưa có balance không xuất hiện.
- Khi stock-in/adjustment làm tồn lớn hơn 0, product tự xuất hiện lại.
- Public detail trực tiếp `GET /public/products/:sku/inventory` hiện vẫn trả product active tồn 0 để giữ tương thích.
- Public không trả `sale_price`, `unit_price`, `line_total`, `total_amount` hoặc `sale_note`.

## 5. Tồn kho và nhóm bảo hành

- `product_inventory_balances` là tổng tồn hiện tại.
- Tồn chỉ đổi qua stock-in, stock-out hoặc inventory-check.
- Nhóm bảo hành/tình trạng được tính từ:
  - `stock_transactions.note`;
  - `inventory_note_adjustments`;
  - `inventory_quantity_adjustments`.
- Nhóm rỗng là **Không ghi chú**.
- Warranty group chỉ quản lý tồn, không quyết định giá.
- `sale_note` tách biệt hoàn toàn khỏi warranty group.

## 6. Stock-in

- UI `/admin/stock-in`.
- API chính `POST /api/v1/admin/stock-in/bulk`.
- Supplier optional.
- Mỗi item có SKU, quantity dương và warranty note optional.
- Tạo stock transactions, voucher IN và tăng balance.
- Không có giá nhập, payment hoặc debt.

## 7. POS / Stock-out

- UI `/admin/stock-out`.
- API chính `POST /api/v1/admin/stock-out/bulk`.
- Customer optional.
- Same SKU + same normalized warranty group merge thành một dòng.
- Same SKU + khác group là hai dòng.
- `sale_note` thuộc cart row nhưng không tham gia merge key.
- Quantity không vượt tổng tồn hoặc tồn của group.
- Backend lấy `products.sale_price`; frontend không được quyết định snapshot tiền hiện tại.
- Nếu một item thiếu giá: `unit_price=NULL`, `line_total=NULL`; voucher có item thiếu giá thì `total_amount=NULL`.
- `sale_price=0` vẫn snapshot và hiển thị là `0 ₫`.
- `sale_note` được trim, chuỗi rỗng lưu `NULL`, tối đa 500 ký tự.

## 8. Inventory Check

- UI `/admin/inventory-check`.
- Note move chuyển quantity giữa hai group trong một transaction và không đổi tổng tồn.
- Quantity adjustment tăng/giảm cả total và group tương ứng.
- Balance phải được khóa bằng locking read trước khi tính group ledger.
- `from_quantity/to_quantity` là tồn group trước/sau thao tác, không phải tổng tồn.
- Decrease phải kiểm tra cả tổng tồn lẫn tồn group.
- Lỗi giữa chừng rollback toàn bộ; concurrent requests không được lost update.

## 9. Voucher, snapshot và print

- Bulk stock-in/out tạo `stock_vouchers`.
- Phiếu OUT mới dùng `stock_voucher_items` để snapshot SKU, tên, warranty note, sale note, quantity và tiền.
- Voucher detail ưu tiên snapshot; legacy fallback không crash.
- Phiếu IN không hiển thị giá nhập giả.
- Mẫu in A4 chỉ hỗ trợ OUT, gọi `window.print()`, không lưu PDF.
- Voucher là phiếu nghiệp vụ/bảo hành, không phải invoice thanh toán.

## 10. Khách hàng và nhà cung cấp

- Field thực tế: `name`, `phone`, `address`, `is_active`.
- Inactive record không xuất hiện trong selector mặc định.
- Không có debt, tax, tags hoặc địa chỉ hành chính tách riêng.

## 11. Giá và phase tiếp theo

Quyết định chưa code:

- `products.sale_price` là giá tham chiếu.
- Click đơn giá tại POS mở popup nhỏ.
- Nhập `discount_amount` bằng số tiền VND, không dùng phần trăm.
- `discount_amount` là số tiền giảm trên mỗi đơn vị sản phẩm của dòng hàng, không phải tổng số tiền giảm của cả dòng.
- Đơn giá cuối = giá tham chiếu - `discount_amount`.
- Thành tiền dòng = đơn giá cuối x số lượng.
- Frontend gửi `discount_amount`; backend không tin `final_unit_price`, `line_total` hoặc `total_amount`.
- Backend tự đọc giá tham chiếu hợp lệ, validate discount, tính lại tiền và lưu snapshot.
- Không gắn giá với warranty group.

## 12. Auth

- Login admin bằng username/password, password hash bằng bcrypt.
- JWT access/refresh; refresh token được hash và rotate.
- Login rate limit 10 request/15 phút/IP.
- Limiter không áp dụng cho refresh, logout, public hoặc API admin khác.
