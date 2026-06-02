ALTER TABLE stock_transactions
  ADD COLUMN supplier_id BIGINT UNSIGNED NULL AFTER customer_id,
  ADD KEY idx_stock_txn_supplier_time (supplier_id, occurred_at),
  ADD CONSTRAINT fk_stock_txn_supplier
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    ON UPDATE CASCADE;
