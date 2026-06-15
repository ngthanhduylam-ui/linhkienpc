ALTER TABLE stock_voucher_items
  ADD COLUMN sale_note_snapshot VARCHAR(500) NULL AFTER warranty_note_snapshot;
