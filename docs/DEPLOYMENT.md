# VI TÍNH PHƯỚC TÀI POS - Deployment

Cập nhật gần nhất: **26/06/2026**

Không ghi secret thật vào tài liệu hoặc command history chia sẻ.

## Current production baseline

```text
Stable commit: f736ca2 Revert "feat: persist unfinished POS order drafts"
Branch:        codex-dev
```

Production was considered stable after reverting the optional POS draft persistence feature.

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

Production backup currently targets a separate Samsung SSD and includes:

- daily database backup;
- uploads backup;
- backend configuration backup;
- manifest;
- SHA256 checksums;
- restore guide;
- 30-day retention;
- cron at 23:00.

Do not expose backup paths containing secrets or `.env` contents in chat/logs. It is OK to verify backup file names, timestamps, sizes and checksum presence.

## Pre-deploy

Local:

```powershell
git branch --show-current
git status --short
git log -1 --oneline
cd frontend
npm run build
```

Production inspection before deploy:

```bash
cd /opt/linhkienpc/linhkienpc
git branch --show-current
git status --short
git log -1 --oneline
pm2 status linhkienpc-api
sudo nginx -t
sudo systemctl status nginx --no-pager
df -h
```

Dừng nếu sai branch, working tree dirty, backup lỗi/rỗng, ổ đĩa thiếu hoặc không xác định commit rollback.

## Deploy outline

Only run steps relevant to changed files:

```bash
cd /opt/linhkienpc/linhkienpc
git fetch origin
git pull --ff-only origin codex-dev
```

Backend/migration nếu thay đổi:

```bash
cd /opt/linhkienpc/linhkienpc/backend
npm install
npm run migrate
pm2 restart linhkienpc-api
pm2 logs linhkienpc-api --lines 100 --nostream
```

Frontend nếu thay đổi:

```bash
cd /opt/linhkienpc/linhkienpc/frontend
npm install
npm run build
sudo nginx -t
sudo systemctl reload nginx
```

## Smoke test

- Public Lookup hides zero-stock products.
- Admin login.
- Product image thumbnail/download.
- POS search, sale, optional pricing and line discount.
- Voucher list/detail responsive layout.
- Voucher print page only if print was intentionally changed.

## Rollback

Use a normal revert or deploy a known good commit. Do not rewrite shared history.

For database rollback, restore only from verified backup and only after confirming the intended target database. Never print `.env`, passwords or tokens.

## Known deployment boundaries

- Do not run migrations without backup verification.
- Do not deploy print redesign until requirements are reviewed again.
- Do not treat POS draft persistence as available; it was reverted by `f736ca2`.
