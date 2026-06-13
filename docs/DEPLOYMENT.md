# DEPLOYMENT.md

Tài liệu này dùng để cài lại máy Windows/local dev và cập nhật Ubuntu Server cho **VI TÍNH PHƯỚC TÀI POS**.

## 1. Nguyên tắc an toàn

- Luôn kiểm tra branch trước khi deploy.
- Luôn backup database server thật trước khi cập nhật.
- Không commit `.env`, file backup SQL hoặc secret.
- Không chạy migration mới trên dữ liệu thật nếu chưa đọc migration.
- Không thêm price/payment/debt/invoice/accounting/report trong các đợt deploy POS hiện tại.

## 2. Cài lại local trên Windows

Thư mục repo mong muốn:

```text
C:\Users\Admin\Documents\Codex\linhkienpc
```

Clone lại:

```powershell
mkdir "C:\Users\Admin\Documents\Codex"
cd "C:\Users\Admin\Documents\Codex"
git clone -b codex-dev https://github.com/ngthanhduylam-ui/linhkienpc.git
cd linhkienpc
```

Cài backend:

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Cập nhật `backend/.env` theo MySQL local. Sau đó tạo database MySQL:

```sql
CREATE DATABASE linhkienpc CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Chạy setup database:

```powershell
npm run db:setup
npm run dev
```

Cài frontend:

```powershell
cd ..\frontend
npm install
npm run dev
```

Ghi chú:

- Nếu frontend local trỏ API về server thật `192.168.1.50`, thao tác nhập/xuất sẽ sửa dữ liệu thật.
- Khi test UI an toàn, ưu tiên dùng database local.

## 3. Build frontend local

```powershell
cd frontend
npm run build
```

Build output nằm trong:

```text
frontend/dist
```

## 4. Server Ubuntu hiện tại

Thông tin đang dùng theo project memory:

```text
Server IP: 192.168.1.50
Project path: /opt/linhkienpc/linhkienpc
Branch deploy: codex-dev
Database: MySQL
Frontend: Nginx serve build
Backend: Node/PM2
```

Một backup thật đã từng được tạo trước đợt Codex work:

```text
~/backups/linhkienpc_before_codex_20260611_1546.sql
```

Tên process PM2/Nginx config cụ thể cần kiểm tra trực tiếp trên server bằng `pm2 list` và config đang chạy; không giả định cứng trong tài liệu.

## 5. Quy trình cập nhật server an toàn

SSH vào server:

```bash
ssh vitinhphuoctai@192.168.1.50
cd /opt/linhkienpc/linhkienpc
```

Kiểm tra trạng thái:

```bash
git branch --show-current
git status --short
```

Backup database trước:

```bash
/home/vitinhphuoctai/backup_linhkienpc.sh
```

Nếu script backup không tồn tại hoặc lỗi, dừng deploy và backup thủ công trước.

Cập nhật code:

```bash
git pull
```

Frontend:

```bash
cd frontend
npm install
npm run build
sudo systemctl reload nginx
```

Backend, chỉ khi backend/package hoặc backend code thay đổi:

```bash
cd ../backend
npm install
pm2 list
pm2 restart <process-name>
```

Nếu có migration mới:

```bash
cd backend
npm run migrate
```

Chỉ chạy migration sau khi đã backup và đã đọc nội dung migration.

## 6. Kiểm tra sau deploy

Public:

- Mở `/`.
- Tìm sản phẩm theo tên/SKU.
- Đảm bảo không cần login.
- Đảm bảo không hiển thị toàn bộ sản phẩm khi search trống.

Admin:

- `/admin/login`: login được.
- `/admin/products`: list, thêm, sửa sản phẩm.
- `/admin/stock-in`: nhập hàng test nhỏ nếu đang cho phép test dữ liệu thật.
- `/admin/stock-out`: bán tại quầy test nhỏ.
- `/admin/inventory-check`: tìm sản phẩm và xem tồn.
- `/admin/customers`: list/thêm/sửa.
- `/admin/suppliers`: list/thêm/sửa.
- `/admin/transaction-history`: list và detail phiếu.

## 7. Restore database

Restore chỉ làm khi thật sự cần và hiểu rõ sẽ ghi đè dữ liệu.

Ví dụ mẫu:

```bash
mysql -u <user> -p <database_name> < /path/to/backup.sql
```

Sau restore:

- restart backend nếu cần,
- kiểm tra public lookup,
- kiểm tra admin login,
- kiểm tra tồn một vài SKU thật.

## 8. Troubleshooting nhanh

Frontend không gọi được API:

- Kiểm tra `VITE_API_BASE_URL`.
- Kiểm tra Nginx proxy/static config.
- Kiểm tra backend PM2 còn chạy.

Admin bị logout:

- Kiểm tra JWT env.
- Kiểm tra refresh token table.
- Thử login lại.

Tồn kho không đúng:

- Không sửa database trực tiếp.
- Kiểm tra `stock_transactions`, `stock_vouchers`, `product_inventory_balances`.
- Nếu là lỗi thật, backup trước khi điều chỉnh.

Public lookup lộ dữ liệu không mong muốn:

- Kiểm tra response `/public/products`.
- Không thêm customer/supplier/price/internal transaction vào public response.
