# PROJECT_RULES - LINHKIENPC

## Mục tiêu
Xây dựng hệ thống tra cứu tồn kho và quản trị kho linh kiện PC, gọn nhẹ, tách quyền public/admin rõ ràng.

## Quy tắc cốt lõi (bắt buộc)
1. Không phải website thương mại điện tử.
2. Không có giỏ hàng.
3. Không có thanh toán.
4. Không có đơn hàng.
5. Không có tài khoản khách hàng.
6. Không có hình ảnh sản phẩm.
7. Không lưu giá nhập.
8. Không lưu giá bán.
9. Không có doanh thu.
10. Không có cảnh báo tồn kho thấp.
11. Người dùng public được tìm kiếm tồn kho không cần đăng nhập.
12. Chỉ admin đăng nhập mới được quản lý sản phẩm, lô bảo hành, nhập kho, xuất kho, lịch sử.
13. SKU đại diện model sản phẩm. Ví dụ: `cpu.intel.12400f`.
14. Một SKU có nhiều lô bảo hành. Ví dụ: `BH 07.26`, `BH 11.27`, `BH 02.28`.
15. Tuyệt đối không gộp các lô bảo hành khác nhau.
16. Nhập/xuất kho phải chỉ định đúng SKU và đúng lô bảo hành.
17. Toàn bộ timestamp do backend/server sinh ra.
18. Ứng dụng phải có khả năng chuyển máy khác qua cấu hình `.env`.
19. Chỉ 1 ứng dụng React.
20. Chỉ 1 backend Node.js Express.
21. Chỉ 1 cơ sở dữ liệu MySQL.
22. Dùng React Router cho phân trang.
23. Route public: `/`.
24. Tất cả route admin nằm dưới `/admin`.

## Phạm vi chức năng
- Public: tra cứu tồn kho theo SKU/tên/nhóm linh kiện và xem số lượng theo từng lô bảo hành.
- Admin: đăng nhập, CRUD sản phẩm, quản lý lô bảo hành theo SKU, nhập kho, xuất kho, xem lịch sử giao dịch kho.

## Nguyên tắc dữ liệu
- Không cho phép cập nhật số lượng tồn trực tiếp bằng tay.
- Tồn kho được tính từ bảng tồn theo SKU + batch hoặc từ ledger giao dịch.
- Mọi giao dịch nhập/xuất phải có người thực hiện (admin) và thời điểm server tạo.
- Dùng soft delete cho các thực thể quản trị nếu cần truy vết.
