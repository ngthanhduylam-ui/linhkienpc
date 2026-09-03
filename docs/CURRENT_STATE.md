# CURRENT STATE — Save Game

> Last updated: **03/09/2026**

## Snapshot

```text
Project:          VI TÍNH PHƯỚC TÀI POS
Branch:           release/chotot-vnd
DEV HEAD:         054ac4f feat: expand recent stock updates
Production HEAD:  9316241 feat: expand recent stock updates
Public domain:    https://vitinhphuoctai.com
PM2:              linhkienpc-api (fork, online baseline)
Pending:          CHOTOT-HELPER-1
```

Production values above are **Operational baseline / production convention**, not queried during this documentation task. Production hash khác DEV vì selective cherry-pick.

## Last deployed feature and health

`Vừa cập nhật kho`:

```text
table-only
limit 14
rolling window 168 giờ
```

Operational baseline says deployment verification passed:

```text
/api/v1/health → 200
recent-stock meta.limit → 14
recent-stock meta.window_hours → 168
```

## Product direction

```text
POS First
Bán tại quầy nhanh, ít bước
Public = catalogue/tra cứu tồn, không checkout
Không mở rộng thành ERP nặng
```

Priority: POS → khách hàng → bảo hành → công nợ → hỗ trợ tồn → báo cáo.

## Closed checkpoints

- Access JWT in-memory; refresh HttpOnly cookie.
- Refresh rotation/family/JTI/reuse handling; `auth_version`.
- JWT issuer/algorithm/`token_use` validation.
- bcrypt 6; Sharp 0.35.3; React Router 7.18.2.
- Admin API `Cache-Control: no-store`; Admin routes protected.
- CORS allowlist/origin policy; source production default `.com`.
- Public rate limits and sanitized unexpected API errors.
- Public image type/size/pixel validation and active/positive-stock protection.
- Helmet/security headers baseline; public selling price omitted from API.

Không tự reopen checkpoint security đã CLOSED nếu không có bug/evidence mới.

## Current business rules

- Public products: active + total stock > 0; zero-stock/inactive/direct SKU hidden.
- Public search: multi-token AND + compact `.`, `-`, space normalization; SKU searchable internally nhưng không public.
- Public category strip: desktop giữ chuột trái để kéo ngang với threshold 6px và suppress click sau drag; touch/mobile giữ native horizontal scrolling.
- Public price luôn `Liên hệ`; API không serialize `sale_price`.
- Recent-stock eligible: create product, stock IN, Inventory Check có quantity change; không tính OUT/metadata/no-op check.
- Recent-stock dedupe product, newest eligible event, table columns: Product/Condition/Stock/Updated.
- `Có thể bạn đang cần`: 5 random cards, độc lập recent-stock.
- Warranty/note mới giữ nguyên case, chỉ trim đầu/cuối; normalized key chỉ dùng match/group/allocation.
- POS `/admin/stock-out` full-screen; không confirm-sale modal; order tabs không persist qua reload.
- Quick Notes là widget chat nổi, draggable; tọa độ không lưu localStorage/DB.
- Print thực tế là HTML/CSS + `window.print()`; Builder Draft không tự activate/render.

## Feature status

| Feature | Status | Notes |
|---|---|---|
| Public Lookup + recent stock | DONE | Current production baseline verified. |
| POS/Stock In/Inventory Check | DONE | Core store workflow. |
| Customers/Suppliers/Vouchers | DONE | Debt/finance not included. |
| Quick Notes | DONE | Page + floating widget. |
| Auth/security hardening | CLOSED | Reopen only on new evidence. |
| Print settings/editor/draft | DONE | Persistence/editor only. |
| Print runtime template integration | DEFERRED | Current renderer remains separate. |
| CHOTOT-HELPER-1 | PENDING | Update/verify production `.com` origin matching. |
| Customer/debt/finance expansion | DEFERRED | Separate future phase. |
| SKU compatibility improvements | DEFERRED | Backlog; require real examples. |
| Future print refinements/A5 | DEFERRED | Backlog; no deadline. |

## Pending checkpoint: CHOTOT-HELPER-1

Source confirms active helper-first + extension-fallback code. Mismatch:

- helper allowlists still use old DuckDNS + localhost;
- extension POS matches only localhost/127.0.0.1;
- current public origin is `.com`.

Next recommended action: audit and update exact production origin matching in helper/extension with focused local tests and explicit operator review. Do not claim production helper is complete before this checkpoint passes.

## Production workflow

```text
local analyze/edit/test
→ explicit task files only
→ commit
→ push only when requested
→ operator fetches production
→ verify clean
→ selective cherry-pick approved commit
→ tests/build
→ PM2 restart only if backend changed
→ health/runtime verification
```

Do not `git pull` entire branch for production. See [`PRODUCTION_RECOVERY.md`](PRODUCTION_RECOVERY.md).

## Known local unrelated files

Common untracked items that future tasks must not blindly stage:

```text
backend/scripts/PUBLIC_CATALOGUE_DEMO_README.md
backend/scripts/seed-public-catalogue-demo.js
backend/scripts/seed-public-catalogue-demo.test.js
design-references/
tools/banner-reference/
```

## Critical DON'Ts

- Never use `git add .` or `git add ..`; stage explicit task files only.
- Do not touch unrelated uncommitted/untracked files.
- No production SSH from Codex.
- No deploy/migration/commit/push without explicit request.
- No force-push/reset/clean/rebase to resolve an unexpected state.
- No secrets, passwords, token/cookie values, keys or `.env` contents in docs/logs.
- Do not treat old DuckDNS/LRT224/DHCP-DNS experiments as current.

## Resume links

- Full handoff: [`PROJECT_HANDOFF.md`](PROJECT_HANDOFF.md)
- Production recovery: [`PRODUCTION_RECOVERY.md`](PRODUCTION_RECOVERY.md)
- Root entry point: [`../README.md`](../README.md)
