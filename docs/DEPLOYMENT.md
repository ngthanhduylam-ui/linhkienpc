# VI TÍNH PHƯỚC TÀI POS - Deployment

Cập nhật gần nhất: **23/06/2026**

Không ghi secret thật vào tài liệu hoặc command history chia sẻ.

## Production topology

```text
Domain:           https://vitinhphuoctai.duckdns.org
Repo:             /opt/linhkienpc/linhkienpc
Branch:           codex-dev
Frontend build:   /opt/linhkienpc/linhkienpc/frontend/dist
Backend:          /opt/linhkienpc/linhkienpc/backend
PM2 process:      linhkienpc-api
Backend bind:     127.0.0.1:3000
Database:         MySQL localhost
Product uploads:  /opt/linhkienpc/uploads/products
```

Nginx phục vụ frontend và reverse proxy `/api/v1`. UFW không mở public port 3000/3306.

## Backup

```text
Script:     /home/vitinhphuoctai/backup_linhkienpc.sh
Directory:  /home/vitinhphuoctai/backups
Log:        /home/vitinhphuoctai/backup.log
Schedule:   23:00 daily
Retention:  14 days
```

Database backup không chứa ảnh. Backup ảnh từ `/opt/linhkienpc/uploads/products` ra HDD riêng là backlog và chưa tự động hóa.

## Pre-deploy

Local:

```powershell
git branch --show-current
git status --short
git log -1 --oneline
cd frontend
npm run build
```

Server:

```bash
cd /opt/linhkienpc/linhkienpc
git branch --show-current
git status --short
git log -1 --oneline
git remote -v
pm2 status
sudo nginx -t
sudo systemctl status nginx --no-pager
sudo systemctl status mysql --no-pager
df -h
ls -lh /home/vitinhphuoctai/backups | tail
```

Dừng nếu sai branch, working tree dirty, backup lỗi/rỗng, ổ đĩa thiếu hoặc không xác định commit rollback.

## Deploy theo thứ tự

Ghi commit hiện tại:

```bash
cd /opt/linhkienpc/linhkienpc
git rev-parse HEAD
```

Backup và pull:

```bash
/home/vitinhphuoctai/backup_linhkienpc.sh
git pull --ff-only origin codex-dev
```

Backend/migration nếu thay đổi:

```bash
cd /opt/linhkienpc/linhkienpc/backend
npm install
npm run migrate
pm2 restart linhkienpc-api
pm2 status
pm2 logs linhkienpc-api --lines 100 --nostream
```

Frontend:

```bash
cd /opt/linhkienpc/linhkienpc/frontend
npm install
VITE_API_BASE_URL=/api/v1 npm run build
sudo nginx -t
sudo systemctl reload nginx
```

Không dùng `npm run db:setup` như lệnh deploy thường lệ. Seed chỉ chạy có chủ đích.

## Post-deploy

```bash
curl -I https://vitinhphuoctai.duckdns.org
curl -sS https://vitinhphuoctai.duckdns.org/api/v1/health
sudo ss -lntp
sudo ufw status
pm2 status
sudo nginx -t
```

Smoke checklist:

- Admin login.
- Public search/list chỉ hiện product active còn tồn.
- Product list và product images.
- POS server-side search, sale và inventory decrement.
- Inventory Check note move/quantity adjustment.
- Voucher list/detail/print.
- Backend chỉ nghe `127.0.0.1:3000`.

## Rollback code

Ưu tiên checkout commit tốt đã ghi nhận, không dùng `git reset --hard` khi chưa kiểm tra:

```bash
cd /opt/linhkienpc/linhkienpc
git checkout <previous-known-good-commit>

cd frontend
VITE_API_BASE_URL=/api/v1 npm run build
sudo nginx -t
sudo systemctl reload nginx

cd ../backend
pm2 restart linhkienpc-api
```

Sau sự cố, đưa server trở lại branch `codex-dev` bằng quy trình Git có kiểm soát.

## Rollback database

Chỉ restore khi đã dừng thao tác bán và hiểu phạm vi mất dữ liệu:

```bash
mysql -u <db-user> -p <database-name> < /home/vitinhphuoctai/backups/<backup-file>.sql
```

Restore end-to-end chưa được ghi nhận là đã diễn tập hoàn chỉnh. Đây là điểm phải dừng và đánh giá, không thao tác vội.

## Secret và environment

- Không in nội dung `.env`.
- Chỉ kiểm tra file tồn tại, quyền file và tên biến.
- Production cần `HOST=127.0.0.1`.
- `DEFAULT_ADMIN_PASSWORD` không có fallback trong source.
- `PRODUCT_UPLOAD_ROOT=/opt/linhkienpc/uploads/products`.
