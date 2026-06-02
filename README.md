# LINHKIENPC

LINHKIENPC là hệ thống tra cứu tồn kho và quản trị tồn kho nhẹ cho linh kiện PC.

Ứng dụng không phải website thương mại điện tử. Không có giỏ hàng, checkout, đơn hàng, tài khoản khách công khai, hình ảnh sản phẩm, giá nhập, giá bán, doanh thu, công nợ hoặc thanh toán.

## Tính năng hiện có

- Trang công khai `/` để tra cứu sản phẩm theo SKU, tên sản phẩm hoặc ghi chú bảo hành.
- Hiển thị tổng tồn sản phẩm và nhóm ghi chú bảo hành còn lại.
- Đăng nhập admin bằng JWT access token và refresh token.
- Quản lý sản phẩm.
- Quản lý danh mục.
- Nhập hàng theo SKU.
- Xuất hàng theo SKU.
- Chọn nhà cung cấp khi nhập hàng.
- Chọn khách hàng khi xuất hàng.
- Quản lý khách hàng.
- Quản lý nhà cung cấp.
- Xem lịch sử giao dịch tồn kho.
- Tồn kho tính theo sản phẩm, không theo lô bảo hành thật.
- Ghi chú bảo hành được lưu trong `stock_transactions.note`.

## Công nghệ

Backend:

- Node.js
- Express
- MySQL
- JWT
- bcrypt
- dotenv
- cors
- helmet
- morgan

Frontend:

- React
- Vite
- React Router
- TailwindCSS

## Cấu trúc thư mục

```text
backend/     API Express, service, controller, route, middleware
database/    schema, migrations, seed data
docs/        tài liệu dự án
frontend/    React app
backups/     thư mục backup thủ công nếu cần
```

## Cài đặt backend

```bash
cd backend
npm install
copy .env.example .env
```

Cập nhật `.env` theo MySQL local:

```env
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=linhkienpc
DB_USER=root
DB_PASSWORD=your_password
JWT_ACCESS_SECRET=change_this_access_secret
JWT_REFRESH_SECRET=change_this_refresh_secret
```

Tạo database MySQL trước khi chạy migration:

```sql
CREATE DATABASE linhkienpc CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Chạy migration và seed:

```bash
npm run db:setup
```

Chạy backend:

```bash
npm run dev
```

Backend mặc định chạy tại:

```text
http://localhost:3000/api/v1
```

## Cài đặt frontend

```bash
cd frontend
npm install
```

Nếu backend không chạy ở `http://localhost:3000/api/v1`, cấu hình biến môi trường Vite:

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

Chạy frontend:

```bash
npm run dev
```

Frontend mặc định chạy tại:

```text
http://localhost:5173
```

## Tài khoản admin mặc định

Tài khoản được tạo từ biến môi trường seed:

```env
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=Admin@123456
DEFAULT_ADMIN_DISPLAY_NAME=System Admin
```

Sau khi triển khai thật, cần đổi mật khẩu mặc định và JWT secret.

## Route chính

Public:

- `/` tra cứu tồn kho công khai.

Admin:

- `/admin/login` đăng nhập.
- `/admin/stock-in` nhập hàng.
- `/admin/stock-out` xuất hàng.
- `/admin/products` quản lý sản phẩm.
- `/admin/suppliers` quản lý nhà cung cấp.
- `/admin/customers` quản lý khách hàng.
- `/admin/customers/:id` chi tiết khách hàng.
- `/admin/transaction-history` lịch sử giao dịch.
- `/admin/inventory-workbench` route cũ, redirect về `/admin/stock-in`.

## Tài liệu chi tiết

- [Kiến trúc](docs/ARCHITECTURE.md)
- [Database](docs/DATABASE.md)
- [API](docs/API.md)
- [Business Rules](docs/BUSINESS_RULES.md)
## Trạng thái dự án

Version: Internal Beta

Mục tiêu hiện tại:
- Quản lý tồn kho nội bộ
- Thay thế dần việc tra cứu trên Sapo
- Kiểm thử thực tế trong môi trường cửa hàng

Chưa phải ERP hoặc hệ thống bán hàng hoàn chỉnh.
