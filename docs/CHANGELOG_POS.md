# VI TÍNH PHƯỚC TÀI POS - Changelog theo milestone

Cập nhật gần nhất: **26/06/2026**

Tài liệu này ghi lại các mốc lớn của hướng POS-first. Khi ghi chú lịch sử mâu thuẫn với code hiện tại, ưu tiên code, migrations và Git history.

## 2026-06-26 - Current production baseline

Stable production baseline:

```text
f736ca2 Revert "feat: persist unfinished POS order drafts"
```

Important rollback:

```text
3dd615e feat: persist unfinished POS order drafts
f736ca2 Revert "feat: persist unfinished POS order drafts"
```

Current behavior:

- POS unfinished order tabs are in-memory only.
- Tabs are not persisted across F5/browser restart.
- Draft persistence must not be treated as implemented.
- Future reimplementation needs browser testing for closing one tab, selling one tab, preserving sibling tabs and refreshing immediately afterward.

Production currently tested stable after the revert.

## Recent completed work

- POS full-screen counter-sale workflow.
- Product and customer search.
- Multi-order tabs, in-memory only.
- Multi-token AND product search.
- Public Lookup hides zero-stock products.
- Product images, maximum 5 images.
- Category rename.
- Safe deletion of unused categories.
- Per-line fixed VND discount snapshots.
- Products without configured selling price can still be sold.
- Voucher detail responsive layout.
- Previous inventory note-group discrepancy fixed.

## Backup milestone

Production backup now targets a separate Samsung SSD and includes:

- daily database backup;
- uploads backup;
- backend configuration backup;
- manifest;
- SHA256 checksums;
- restore guide;
- 30-day retention;
- cron at 23:00.

Older notes saying uploads/image backup is not automated are stale.

## POS pricing milestone

Completed behavior:

- `products.sale_price` is the reference price.
- `sale_price = NULL`: no configured reference price; POS sale is still allowed.
- Manual unit price is optional when no reference price exists.
- `sale_price = 0`: valid configured reference price.
- `discount_amount` is fixed VND discount per unit.
- Backend validates discount/manual price and calculates `unit_price`, `line_total`, `total_amount`.
- Frontend does not send backend-calculated totals.
- Snapshots are stored on voucher items:
  - `reference_unit_price`;
  - `discount_amount`;
  - `unit_price`;
  - `line_total`.

## Voucher milestone

- Voucher detail uses transaction snapshots, not current product price.
- Sale voucher item table is responsive.
- Price concepts are grouped compactly for sale vouchers.
- Legacy vouchers without discount snapshots remain compatible.
- Print work beyond the current page is paused until requirements are reviewed again.

## Print direction, paused

Future agreed direction only:

- title: `Phiếu bán & giao hàng`;
- A4 and A5 support;
- dynamic product rows;
- long text wraps automatically;
- no separate SKU/code column;
- signatures: `Người bán` and `Khách hàng`;
- review requirements again before implementation.

## Deferred items

- Customer payment/debt.
- Supplier debt.
- Cost price / giá vốn.
- Financial/accounting reports.
- Order-wide discount.
- Advanced invoice/accounting work.
- Print redesign/implementation.
- ERP inventory/accounting workflow.

Principle: stabilize POS and real data first; financial/accounting features later by separate phase.
