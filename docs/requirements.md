# Yêu cầu hệ thống - LINHKIENPC

## 1) Mục tiêu nghiệp vụ
LINHKIENPC là hệ thống tra cứu tồn kho linh kiện PC và quản trị tồn kho nội bộ.

## 2) Vai trò người dùng
- Public user (không đăng nhập): chỉ tra cứu tồn kho.
- Admin user (đăng nhập): quản lý dữ liệu và giao dịch kho.

## 3) Yêu cầu chức năng
### 3.1 Public
- Truy cập route `/`.
- Tìm kiếm theo SKU, tên sản phẩm, danh mục, batch code.
- Hỗ trợ tìm kiếm partial text (fuzzy/contains) trên các trường tra cứu.
- Ví dụ từ khóa phải trả về sản phẩm phù hợp: `12400`, `12400f`, `07.26`, `4060`, `b760`.
- Xem tồn kho theo từng lô bảo hành cho một SKU.

### 3.2 Admin
- Đăng nhập tại nhóm route `/admin/*`.
- Quản lý sản phẩm (SKU, tên, danh mục, trạng thái).
- Quản lý lô bảo hành theo SKU (ví dụ BH 07.26, BH 11.27).
- Nhập kho theo SKU + batch cụ thể (SKU-centric, không bắt buộc admin biết product_id nội bộ).
- Xuất kho theo SKU + batch cụ thể (SKU-centric, không bắt buộc admin biết product_id nội bộ).
- Xem lịch sử nhập/xuất (ai thao tác, khi nào, SKU nào, batch nào, số lượng bao nhiêu).

## 4) Ràng buộc nghiệp vụ bắt buộc
- Không có e-commerce flow: cart/checkout/order/customer account.
- Không lưu hình ảnh sản phẩm.
- Không lưu giá nhập, giá bán, doanh thu.
- Không cảnh báo tồn thấp.
- Không gộp lô bảo hành khác nhau.

## 5) Yêu cầu phi chức năng
- Timestamp phải do server sinh.
- Cấu hình qua `.env` để dễ chuyển máy.
- Một frontend React, một backend Express, một MySQL.
- Có logging cơ bản và xử lý lỗi API nhất quán.

## 6) Điều hướng frontend
- Public route: `/`
- Admin routes: `/admin`, `/admin/login`, `/admin/products`, `/admin/batches`, `/admin/stock-in`, `/admin/stock-out`, `/admin/history`

## 7) Ngoài phạm vi (out of scope)
- Báo cáo doanh thu/lãi lỗ.
- Tính năng bán hàng online.
- Tài khoản khách hàng.
