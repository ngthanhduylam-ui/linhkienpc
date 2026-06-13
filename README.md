# VI TÍNH PHƯỚC TÀI POS

Ứng dụng POS/tồn kho tự host cho cửa hàng linh kiện PC **VI TÍNH PHƯỚC TÀI**.

Định hướng hiện tại:

- POS First
- Offline First
- Self-hosted
- Sapo Inspired
- Stability First
- Not an ERP

Ứng dụng ưu tiên bán tại quầy, tra cứu tồn kho nhanh, quản lý sản phẩm/khách hàng/nhà cung cấp và theo dõi phiếu nhập/phiếu bán nội bộ. Hệ thống **chưa** có giá, thanh toán, công nợ, hóa đơn, kế toán hoặc báo cáo tài chính.

## Current Status

- Đang chạy với dữ liệu thật trên Ubuntu Server nội bộ.
- Branch phát triển/deploy chính: `codex-dev`.
- Frontend: React + Vite + TailwindCSS.
- Backend: Node.js + Express + MySQL.
- Admin auth: JWT access token + refresh token.
- Public Lookup route `/` không cần đăng nhập.

## Main Workflows

- Public Lookup: tra cứu tồn kho không login.
- Bán tại quầy: `/admin/stock-out`.
- Nhập hàng: `/admin/stock-in`.
- Kiểm hàng/điều chỉnh tồn: `/admin/inventory-check`.
- Sản phẩm: `/admin/products`, `/admin/products/new`, `/admin/products/:id/edit`.
- Khách hàng: `/admin/customers`.
- Nhà cung cấp: `/admin/suppliers`.
- Lịch sử giao dịch: `/admin/transaction-history`, `/admin/transaction-history/:voucherId`.

## Fresh Windows Setup

Sau khi cài lại Windows 10, cài các công cụ:

- Git
- Node.js 18+ hoặc phiên bản tương thích với `backend/package.json`
- MySQL nếu cần chạy backend/database local
- VS Code/Codex nếu dùng cho phát triển

Clone repo:

```powershell
mkdir "C:\Users\Admin\Documents\Codex"
cd "C:\Users\Admin\Documents\Codex"
git clone -b codex-dev https://github.com/ngthanhduylam-ui/linhkienpc.git
cd linhkienpc
```

Cài dependencies:

```powershell
cd backend
npm install
cd ..\frontend
npm install
```

Xác nhận branch:

```powershell
git branch --show-current
git status
```

## Environment Files

Không commit `.env`.

Backend có template:

```powershell
cd backend
copy .env.example .env
```

Điền thông tin local:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=linhkienpc
DB_USER=root
DB_PASSWORD=<your-local-password>
JWT_ACCESS_SECRET=<generate-a-strong-secret>
JWT_REFRESH_SECRET=<generate-a-strong-secret>
```

Frontend có thể dùng `.env.local` nếu cần đổi API base:

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

Lưu ý: nếu `VITE_API_BASE_URL` trỏ tới `http://192.168.1.50/...`, thao tác local có thể thay đổi dữ liệu server thật. Khi phát triển nên dùng backend/database local.

## Run Locally

Tạo database local nếu cần:

```sql
CREATE DATABASE linhkienpc CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Backend:

```powershell
cd backend
npm run db:setup
npm run dev
```

Frontend:

```powershell
cd frontend
npm run dev
```

Mở:

```text
http://localhost:5173
```

Backend API mặc định:

```text
http://localhost:3000/api/v1
```

## Ubuntu Deployment Summary

Thông tin server theo project memory:

- Hostname: `linhkienpc`
- User: `vitinhphuoctai`
- IP nội bộ: `192.168.1.50`
- Repo path: `/opt/linhkienpc/linhkienpc`
- Backend: PM2
- Frontend: Nginx
- Database: MySQL

Quy trình an toàn:

1. Test trên Windows/local.
2. Commit và push branch `codex-dev`.
3. Backup database server.
4. SSH vào server.
5. Kiểm tra `git status`.
6. `git pull`.
7. Build frontend.
8. Restart Nginx.
9. Restart PM2 chỉ khi backend thay đổi.
10. Test các route quan trọng.

Chi tiết xem `docs/DEPLOYMENT.md`.

## Important Safety Rules

- Không thêm giá/payment/debt/invoice/accounting/report khi chưa có yêu cầu rõ.
- Không đổi database/backend API khi task chỉ là UI.
- SKU phải unique.
- SKU dùng chữ thường, số và dấu chấm.
- Không sửa trực tiếp tồn kho ngoài stock-in, stock-out hoặc inventory-check adjustment.
- Public Lookup không được yêu cầu login.
- Stock voucher không phải hóa đơn.

## Documentation Index

- [Project Direction](docs/PROJECT_DIRECTION.md)
- [Project Status](docs/PROJECT_STATUS.md)
- [POS Screen Guide](docs/POS_SCREEN_GUIDE.md)
- [POS Changelog](docs/CHANGELOG_POS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Business Rules](docs/BUSINESS_RULES.md)
- [API](docs/api.md)
- [Database](docs/database.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Folder Structure](docs/FOLDER_STRUCTURE.md)
- [Project Rules](PROJECT_RULES.md)
