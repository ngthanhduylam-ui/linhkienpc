ALTER TABLE stock_transactions
  ADD COLUMN customer_id BIGINT UNSIGNED NULL AFTER warranty_batch_id,
  ADD KEY idx_stock_txn_customer_time (customer_id, occurred_at),
  ADD CONSTRAINT fk_stock_txn_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON UPDATE CASCADE;
