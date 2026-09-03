# Production Recovery — VI TÍNH PHƯỚC TÀI POS

> Cập nhật: **03/09/2026**
> Mọi dữ kiện production/network dưới đây là **Operational baseline / production convention** do người vận hành cung cấp; task tài liệu này không SSH hoặc truy vấn production.

## 1. Current production identity

```text
Public domain:     https://vitinhphuoctai.com
Repo:              /opt/linhkienpc/linhkienpc
Branch convention: release/chotot-vnd
Production HEAD:   9316241 feat: expand recent stock updates
Backend service:   linhkienpc-api
PM2 mode:          fork
PM2 baseline:      online
Backend bind:      localhost:3000
Database:          MySQL localhost only
Health:            /api/v1/health
```

Recent production history:

```text
9316241 feat: expand recent stock updates
041ac90 feat: add mouse drag to public categories
619321d fix: simplify recent stock table
e041523 feat: add recent public stock updates
7359914 fix: preserve warranty note casing
```

Production dùng selective cherry-pick nên hash production có thể khác DEV dù message/diff giống nhau.

Health đã được người vận hành xác nhận sau deployment hiện tại:

```text
/api/v1/health → 200
recent-stock meta.limit → 14
recent-stock meta.window_hours → 168
```

## 2. Responsibility boundary

Codex:

```text
analyze local repo → edit local code → test → commit → push khi được yêu cầu
```

Codex không SSH production. Lệnh production do người vận hành chạy thủ công. Không đưa passwords, token/cookie values, private keys, API keys hoặc `.env` contents vào chat/tài liệu.

## 3. Network baseline

```text
FPT Fiber
  ↓
G-97CM ONU/converter
  ↓
TP-Link Archer C9(EU) Ver 5.1
  ↓ LAN 192.168.1.0/24
SG1016D
  ├ Ubuntu POS server 192.168.1.50
  ├ cameras/NVR
  ├ printer
  └ PCs/AP/etc
```

```text
Router:       192.168.1.1
DHCP pool:    .100–.199
Server:       192.168.1.50/24
Gateway:      192.168.1.1
Public NAT:   TCP 80, TCP 443
SSH:          LAN only
```

UFW baseline:

```text
deny incoming
allow outgoing
22/tcp from LAN only
80/tcp public
443/tcp public
```

Nginx là public reverse proxy: phục vụ frontend và proxy `/api/v1` tới backend loopback. MySQL và port 3000 không public.

Cloudflare DNS là current production convention cho domain `.com`; repo không chứa DNS records, proxy mode, account credentials hoặc token. Xác minh các giá trị đó trong dashboard/operator records, không đoán. Exact Nginx/TLS config cũng không nằm trong repo; kiểm runtime/config trước khi thay security headers hoặc TLS policy.

Operational baseline / production convention:

- Cloudflare apex `vitinhphuoctai.com`: DNS-only.
- `www`: HTTP 301 redirect về apex HTTPS.

Old LRT224 và các thử nghiệm Ubuntu DHCP/DNS cũ là **historical/not current**.

## 4. Pre-deploy gate

Không deploy nếu chưa có exact approved commit và task nói rõ frontend/backend/migration scope.

```bash
cd /opt/linhkienpc/linhkienpc
git fetch origin
git status --short
git log -5 --oneline
```

Yêu cầu:

- working tree sạch;
- current production HEAD đúng baseline/task;
- approved commit tồn tại trên origin;
- biết rõ commit là frontend-only, backend-only hay có DB migration;
- đã có test result local;
- nếu có database impact: backup và rollback plan đã được xác nhận.

Nếu working tree không sạch, HEAD lệch hoặc có commit ngoài scope: **dừng**, không tự reset/clean/pull/rebase.

## 5. Selective deployment workflow

Không dùng `git pull` cả branch. Không cherry-pick commit khác “cho tiện”.

```bash
git cherry-pick <approved-commit>
git status --short
git log -5 --oneline
```

Sau cherry-pick, production hash mới có thể khác approved DEV hash. Ghi lại production hash mới trong deployment report.

### Frontend-only patch

```bash
cd /opt/linhkienpc/linhkienpc/frontend
node --test
npm run build

cd /opt/linhkienpc/linhkienpc
git status --short
```

Frontend-only: test + build; **không restart PM2**.

### Backend source/runtime patch

```bash
cd /opt/linhkienpc/linhkienpc/backend
node --test

cd /opt/linhkienpc/linhkienpc
git status --short
```

Nếu backend source/runtime thực sự thay đổi và test PASS, người vận hành restart đúng process:

```bash
pm2 restart linhkienpc-api
pm2 status
```

Không restart process khác. Nếu commit đổi dependency lock/package files, dùng exact dependency-install procedure đã được người vận hành phê duyệt trước khi restart; repo không định nghĩa production install script riêng nên không đoán.

### Migration patch

Không chạy migration theo thói quen. Chỉ chạy exact migration được task phê duyệt, sau backup và schema review. `npm run migrate` chạy mọi migration chưa ghi trong `schema_migrations`; vì vậy phải kiểm expected history trước. Không seed production.

## 6. Verification after deploy

Kiểm repo:

```bash
cd /opt/linhkienpc/linhkienpc
git status --short
git log -5 --oneline
git rev-parse HEAD
```

Working tree phải sạch.

Health/API:

```bash
curl -fsS https://vitinhphuoctai.com/api/v1/health
curl -fsS https://vitinhphuoctai.com/api/v1/public/recent-stock-updates
```

Không paste response chứa credentials/private business data vào public logs. Với current feature, xác minh meta `limit=14`, `window_hours=168`.

Browser smoke tests theo scope:

- Public Lookup load/search/category/detail/images.
- Nếu Public UI changed: desktop + mobile, no document overflow.
- Nếu Admin changed: login restore, protected request, logout.
- Nếu POS changed: search/add/edit quantity/note, sale flow chỉ trên dữ liệu test được phép.
- Nếu print changed: voucher detail và browser print preview.

## 7. Restart decision

| Change | Frontend build | PM2 restart | Migration |
|---|---:|---:|---:|
| Frontend source/assets only | Yes | No | No |
| Backend source | As applicable | Yes, after tests | No unless explicitly included |
| Backend dependency/runtime | As applicable | Yes, after approved install/tests | No unless explicitly included |
| Documentation only | No | No | No |
| Database migration | As applicable | Only if backend also changed/required | Exact approved migration only |

## 8. Rollback philosophy

- Dừng traffic-changing work nếu verification fail; giữ evidence/log không chứa secrets.
- Không `git reset --hard`, force-push, clean hoặc pull/rebase để “sửa nhanh”.
- Xác định production cherry-pick hash vừa tạo và tạo rollback/revert có review; không dùng DEV hash thay cho production hash một cách mù quáng.
- Rebuild frontend sau code rollback.
- Restart `linhkienpc-api` chỉ khi backend rollback thay source/runtime.
- Database rollback không đồng nghĩa code rollback: cần backup/restore plan riêng, không tự reverse migration.

## 9. Backup warning

Repo không chứng minh được current backup schedule/retention; tài liệu lịch sử đang mâu thuẫn (14 ngày so với 30 ngày). Vì vậy:

- trước migration/data maintenance: xác minh backup mới nhất và restore path với operator;
- backup tối thiểu cần cover MySQL, product uploads và runtime configuration;
- không ghi backup contents/secrets vào Git;
- không tuyên bố backup “healthy” nếu chưa test restore.

## 10. Critical DON'Ts

- Không SSH production từ Codex.
- Không `git pull` cả branch để deploy.
- Không tự cherry-pick commit khác.
- Không `git add .` / `git add ..`.
- Không deploy khi production working tree bẩn.
- Không force-push/reset/clean/rebase production.
- Không seed hoặc chạy tất cả migration nếu task chỉ duyệt một migration.
- Không restart PM2 cho frontend-only/docs-only patch.
- Không expose port 3000/3306 hoặc SSH ra Internet.
- Không copy secrets vào command output, docs hoặc issue report.
