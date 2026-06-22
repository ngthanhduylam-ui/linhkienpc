# VI TÍNH PHƯỚC TÀI POS

Ứng dụng POS và quản lý tồn kho tự host cho cửa hàng linh kiện PC **VI TÍNH PHƯỚC TÀI**.

Định hướng sản phẩm:

- POS First
- Offline First
- Self-hosted
- Inventory supports sales
- Sapo-inspired
- Stability First
- Not an ERP

Hệ thống ưu tiên bán tại quầy, tra cứu tồn kho nhanh, quản lý sản phẩm/khách hàng/nhà cung cấp và lưu lịch sử phiếu nhập, phiếu bán. Giá bán mặc định, snapshot giá khi bán, Serial/Ghi chú theo dòng và mẫu in A4 phiếu bán đã hoạt động. Giá nhập, giảm giá, thanh toán, công nợ, hóa đơn và báo cáo tài chính chưa có.

## Trạng thái hiện tại

Từ ngày **19/06/2026**, hệ thống ở trạng thái **Production trial / Chạy thử thực tế tại cửa hàng**:

- Production: `https://vitinhphuoctai.duckdns.org`
- Ubuntu Server tự host tại cửa hàng
- Nginx phục vụ frontend và reverse proxy `/api/v1`
- Backend chạy bằng PM2 với process `linhkienpc-api`
- Backend chỉ nghe tại `127.0.0.1:3000`
- MySQL chỉ truy cập nội bộ trên localhost
- HTTPS dùng Let's Encrypt/Certbot
- Branch phát triển và deploy chính: `codex-dev`

Trong 1-2 tuần chạy thử đầu tiên, ưu tiên theo dõi lỗi thực tế và độ ổn định của bán hàng, tồn kho, public lookup, khách hàng, Serial/Ghi chú, phiếu, lịch sử, backup, đăng nhập và bảo mật. Chưa mở thêm module tài chính lớn.

## Tính năng chính

- Public Lookup tại `/`: tra cứu tồn theo tên, SKU và nhóm bảo hành, không cần đăng nhập và không lộ giá.
- Sản phẩm: quản lý SKU, loại sản phẩm, trạng thái và giá bán mặc định.
- Bán tại quầy tại `/admin/stock-out`: nhiều đơn local, khách hàng, nhóm bảo hành, Serial/Ghi chú theo dòng, giá/ thành tiền/tổng tiền chỉ đọc.
- Nhập hàng tại `/admin/stock-in`: nhà cung cấp, số lượng và nhóm bảo hành; chưa có giá nhập.
- Kiểm hàng tại `/admin/inventory-check`: điều chỉnh tồn có lịch sử.
- Lịch sử phiếu tại `/admin/transaction-history`: xem phiếu nhập/phiếu bán, snapshot sản phẩm và tiền.
- Mẫu in A4 phiếu bán tại `/admin/transaction-history/:voucherId/print`.
- Admin authentication dùng JWT access/refresh token và rate limit riêng cho login.

## Kiến trúc

```text
Browser
  -> Nginx (HTTPS, static frontend, reverse proxy /api/v1)
  -> Express backend (PM2, 127.0.0.1:3000)
  -> MySQL (localhost)
```

Stack:

- Frontend: React 18, Vite, React Router, TailwindCSS
- Backend: Node.js 18+, Express, MySQL, JWT, bcrypt
- Database: MySQL, migration runner riêng
- Production: Ubuntu Server, Nginx, PM2, Let's Encrypt

## Routes đã xác nhận

Public:

- `/`

Admin:

- `/admin/login`
- `/admin/products`
- `/admin/products/new`
- `/admin/products/:id/edit`
- `/admin/stock-in`
- `/admin/stock-out`
- `/admin/inventory-check`
- `/admin/customers`
- `/admin/customers/:id`
- `/admin/suppliers`
- `/admin/transaction-history`
- `/admin/transaction-history/:voucherId`
- `/admin/transaction-history/:voucherId/print`

## Chạy local

Yêu cầu: Git, Node.js 18+ và MySQL.

```powershell
git clone -b codex-dev https://github.com/ngthanhduylam-ui/linhkienpc.git
cd linhkienpc

cd backend
npm install
Copy-Item .env.example .env
npm run db:setup
npm run dev
```

Mở terminal khác:

```powershell
cd frontend
npm install
npm run dev
```

Các script hiện có:

```text
backend:  npm start | npm run dev | npm run migrate | npm run seed | npm run db:setup
frontend: npm run dev | npm run build | npm run preview
```

## Biến môi trường

Không commit `.env` hoặc secret thật.

Backend dùng các tên biến:

```text
NODE_ENV
HOST
PORT
APP_TIMEZONE
DB_HOST
DB_PORT
DB_NAME
DB_USER
DB_PASSWORD
DB_CONNECTION_LIMIT
JWT_ACCESS_SECRET
JWT_ACCESS_EXPIRES_IN
JWT_REFRESH_SECRET
JWT_REFRESH_EXPIRES_IN
DEFAULT_ADMIN_USERNAME
DEFAULT_ADMIN_PASSWORD
DEFAULT_ADMIN_DISPLAY_NAME
```

`DEFAULT_ADMIN_PASSWORD` không có giá trị mặc định trong source. Seed chỉ tạo admin mới khi biến này được cung cấp; admin đã tồn tại không bị reset mật khẩu khi restart hoặc chạy seed.

Frontend production dùng:

```env
VITE_API_BASE_URL=/api/v1
```

API client hỗ trợ cả base URL tương đối và tuyệt đối cho môi trường local.

## Production

Production được truy cập qua:

```text
https://vitinhphuoctai.duckdns.org
```

Repo trên server:

```text
/opt/linhkienpc/linhkienpc
```

Backup MySQL chạy hằng ngày lúc 23:00, giữ 14 ngày:

```text
/home/vitinhphuoctai/backup_linhkienpc.sh
/home/vitinhphuoctai/backups
/home/vitinhphuoctai/backup.log
```

DuckDNS được cập nhật bằng cron mỗi 5 phút. Chi tiết deploy, kiểm tra và rollback xem [Deployment Guide](docs/DEPLOYMENT.md).

## Nguyên tắc nghiệp vụ

- SKU unique, dùng chữ thường, số và dấu chấm.
- Không sửa trực tiếp tồn ngoài stock-in, stock-out hoặc inventory-check.
- Backend là nguồn tính và snapshot giá khi bán; POS không gửi field tiền.
- Public Lookup không trả giá, dữ liệu tiền hoặc Serial/Ghi chú bán hàng.
- Stock voucher là phiếu nghiệp vụ nội bộ, không phải hóa đơn thanh toán.
- Không thay backend/API tùy tiện khi task chỉ polish POS.
- Không thêm modal bắt buộc làm chậm luồng xác nhận bán.
- Mỗi thay đổi phải được test trước khi deploy.
- Không tự mở rộng sang giá nhập, giảm giá, thanh toán, công nợ, kế toán hoặc báo cáo tài chính.

## Tài liệu

Ảnh sản phẩm hỗ trợ tối đa 3 ảnh cho mỗi sản phẩm, tối đa 15 MB/ảnh. Backend giữ file gốc trên filesystem, tạo thumbnail WebP riêng và chỉ lưu metadata trong MySQL. Public Lookup được xem gallery và tải ảnh gốc của sản phẩm đang active.

Database backup không chứa file ảnh. `PRODUCT_UPLOAD_ROOT` phải được backup riêng; backup ảnh sang HDD chưa được triển khai trong phase này.

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
