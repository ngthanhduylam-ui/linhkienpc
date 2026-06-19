# VI TÍNH PHƯỚC TÀI POS - Deployment và vận hành

Cập nhật: **19/06/2026**

Đây là runbook an toàn cho production tự host tại cửa hàng. Không ghi secret thật vào tài liệu hoặc command history chia sẻ.

## 1. Production topology

```text
Internet
  -> https://vitinhphuoctai.duckdns.org
  -> UFW ports 80/443
  -> Nginx
     -> frontend static build
     -> /api/v1 -> 127.0.0.1:3000
  -> PM2: linhkienpc-api
  -> MySQL localhost
```

Thông tin:

```text
Repo:             /opt/linhkienpc/linhkienpc
Backend:          /opt/linhkienpc/linhkienpc/backend
Frontend build:   /opt/linhkienpc/linhkienpc/frontend/dist
Branch:           codex-dev
PM2 process:      linhkienpc-api
Domain:           https://vitinhphuoctai.duckdns.org
Backend bind:     127.0.0.1:3000
```

Nginx reverse proxy frontend/backend. MySQL và backend không được expose trực tiếp ra Internet.

## 2. Hạ tầng đã xác nhận

- HTTPS dùng Let's Encrypt/Certbot.
- `certbot renew --dry-run` đã thành công.
- Certbot timer đang active.
- UFW chỉ mở 80/443 public; SSH giới hạn LAN; 3000/3306 không public.
- DuckDNS cron cập nhật IP mỗi 5 phút.
- PM2 chạy một backend instance.
- Production frontend dùng `VITE_API_BASE_URL=/api/v1`.

## 3. Backup

```text
Script:    /home/vitinhphuoctai/backup_linhkienpc.sh
Directory: /home/vitinhphuoctai/backups
Log:       /home/vitinhphuoctai/backup.log
Schedule:  23:00 daily
Retention: 14 days
```

Cron đã tạo được backup có dữ liệu. Việc restore hoàn chỉnh chưa được xác nhận bằng diễn tập end-to-end.

Kiểm tra:

```bash
tail -n 100 /home/vitinhphuoctai/backup.log
ls -lh /home/vitinhphuoctai/backups
df -h
```

Backup thủ công trước deploy:

```bash
/home/vitinhphuoctai/backup_linhkienpc.sh
```

Nếu backup lỗi, file rỗng hoặc ổ đĩa gần đầy: dừng deploy.

## 4. Pre-deploy checks

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
ssh vitinhphuoctai@<server-lan-ip>
cd /opt/linhkienpc/linhkienpc
git branch --show-current
git status --short
git log -1 --oneline
pm2 status
sudo nginx -t
sudo systemctl status nginx --no-pager
sudo systemctl status mysql --no-pager
df -h
```

Chỉ deploy khi branch đúng, working tree server sạch, backup thành công và không có cảnh báo dung lượng.

## 5. Deploy theo thứ tự

```bash
cd /opt/linhkienpc/linhkienpc
git status --short
/home/vitinhphuoctai/backup_linhkienpc.sh
git pull --ff-only origin codex-dev
```

Nếu có migration đã được review:

```bash
cd /opt/linhkienpc/linhkienpc/backend
npm install
npm run migrate
```

Build frontend:

```bash
cd /opt/linhkienpc/linhkienpc/frontend
npm install
VITE_API_BASE_URL=/api/v1 npm run build
sudo nginx -t
sudo systemctl reload nginx
```

Restart backend chỉ khi backend hoặc dependency backend thay đổi:

```bash
cd /opt/linhkienpc/linhkienpc/backend
npm install
pm2 restart linhkienpc-api
pm2 status
pm2 logs linhkienpc-api --lines 100 --nostream
```

Không chạy `db:setup` trên production như một thói quen deploy; dùng migration runner và chỉ seed khi có chủ đích.

## 6. Post-deploy verification

```bash
curl -I https://vitinhphuoctai.duckdns.org
curl -sS https://vitinhphuoctai.duckdns.org/api/v1/health
sudo ss -lntp
sudo ufw status
pm2 status
sudo nginx -t
```

Xác nhận:

- Admin login.
- Public Lookup HTTPS.
- Public categories HTTP 200.
- Product list.
- POS search và bán test có kiểm soát.
- Tồn giảm đúng và public lookup phản ánh tồn mới.
- Voucher history/detail/print.
- Serial/Ghi chú và snapshot giá.
- Backend chỉ nghe `127.0.0.1:3000`.
- Cổng 3000/3306 không public.

## 7. Kiểm tra bảo mật/vận hành

```bash
sudo ss -lntp
sudo ufw status verbose
sudo systemctl status certbot.timer --no-pager
sudo certbot renew --dry-run
pm2 status
pm2 save
```

DuckDNS:

```bash
crontab -l
/home/vitinhphuoctai/duckdns/duck.sh
```

Script DuckDNS production: `/home/vitinhphuoctai/duckdns/duck.sh`. Không in nội dung script nếu có token.

Certbot:

```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

Không in `.env`, JWT secret, mật khẩu database hoặc mật khẩu admin ra log/tài liệu. Chỉ kiểm tra tên biến và quyền file.

## 8. Rollback code

Trước deploy, ghi lại commit cũ:

```bash
cd /opt/linhkienpc/linhkienpc
git rev-parse HEAD
```

Nếu cần rollback code, ưu tiên checkout một commit đã biết rõ và build lại:

```bash
git checkout <previous-known-good-commit>
cd frontend
VITE_API_BASE_URL=/api/v1 npm run build
sudo nginx -t
sudo systemctl reload nginx
cd ../backend
pm2 restart linhkienpc-api
```

Sau khi ổn định, đưa repo server trở lại branch deploy theo quy trình Git có kiểm soát. Không dùng `git reset --hard` khi chưa kiểm tra thay đổi local.

## 9. Rollback database

Database rollback chỉ dùng khi migration gây lỗi và đã xác định backup đúng:

```bash
mysql -u <db-user> -p <database-name> < /home/vitinhphuoctai/backups/<backup-file>.sql
```

Restore có thể ghi đè dữ liệu bán hàng mới sau thời điểm backup. Phải dừng thao tác bán, ghi nhận thời điểm và xác nhận phạm vi mất dữ liệu trước khi restore. Vì restore end-to-end chưa được diễn tập đầy đủ, đây là điểm cần dừng và đánh giá thay vì thao tác vội.

## 10. Điểm phải dừng

- Working tree server không sạch hoặc sai branch.
- Backup mới nhất lỗi/rỗng.
- Không đủ dung lượng đĩa.
- Migration chưa được đọc hoặc chưa test local.
- Nginx config test thất bại.
- Backend bind ra `0.0.0.0` ngoài chủ đích.
- Port 3000/3306 xuất hiện public.
- PM2/Nginx/MySQL không ổn định trước deploy.
- Không xác định được commit rollback.

## 11. Local Windows

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run db:setup
npm run dev

cd ..\frontend
npm install
npm run dev
```

Local nên dùng backend/database local. Nếu frontend local trỏ production, mọi thao tác nhập/xuất sẽ tác động dữ liệu thật.
