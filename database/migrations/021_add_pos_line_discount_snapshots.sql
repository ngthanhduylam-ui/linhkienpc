ALTER TABLE stock_voucher_items
  ADD COLUMN reference_unit_price DECIMAL(15,0) NULL AFTER quantity,
  ADD COLUMN discount_amount DECIMAL(15,0) NOT NULL DEFAULT 0 AFTER reference_unit_price,
  ADD CONSTRAINT chk_stock_voucher_items_reference_price_non_negative
    CHECK (reference_unit_price IS NULL OR reference_unit_price >= 0),
  ADD CONSTRAINT chk_stock_voucher_items_discount_non_negative
    CHECK (discount_amount >= 0);

UPDATE stock_voucher_items
SET reference_unit_price = unit_price
WHERE reference_unit_price IS NULL
  AND unit_price IS NOT NULL;
