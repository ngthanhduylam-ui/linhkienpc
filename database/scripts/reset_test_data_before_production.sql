-- =========================================================
-- RESET TEST DATA BEFORE PRODUCTION DEPLOY
-- Project: VI TINH PHUOC TAI / LINHKIENPC
--
-- WARNING:
-- - Backup the database before running this script.
-- - Run this script manually only. Do NOT wire it into app startup.
-- - This script NEVER deletes admins.
-- - Mode A is active by default.
-- - Mode B is intentionally commented out.
-- - MySQL ALTER TABLE may implicit commit, so AUTO_INCREMENT resets are placed after COMMIT.
-- =========================================================

-- =========================================================
-- MODE A: KEEP PRODUCT CATALOG
--
-- Deletes:
-- - inventory_note_adjustments
-- - inventory_quantity_adjustments
-- - stock_transactions
-- - stock_vouchers
-- - customers
-- - suppliers
--
-- Keeps:
-- - admins
-- - categories
-- - products
--
-- Resets:
-- - product_inventory_balances.quantity = 0
-- =========================================================

START TRANSACTION;

-- 1. Delete adjustment/audit data that references products/admins.
DELETE FROM inventory_note_adjustments;
DELETE FROM inventory_quantity_adjustments;

-- 2. Delete stock transaction rows before voucher/customer/supplier rows.
DELETE FROM stock_transactions;

-- 3. Delete voucher headers after transaction rows.
DELETE FROM stock_vouchers;

-- 4. Keep products, but reset product-level inventory to zero.
UPDATE product_inventory_balances
SET quantity = 0,
    updated_at = CURRENT_TIMESTAMP;

-- 5. Delete partner/contact test data after removing transaction/voucher references.
DELETE FROM customers;
DELETE FROM suppliers;

COMMIT;

-- Reset AUTO_INCREMENT only after COMMIT because ALTER TABLE may implicit commit in MySQL.
ALTER TABLE inventory_note_adjustments AUTO_INCREMENT = 1;
ALTER TABLE inventory_quantity_adjustments AUTO_INCREMENT = 1;
ALTER TABLE stock_transactions AUTO_INCREMENT = 1;
ALTER TABLE stock_vouchers AUTO_INCREMENT = 1;
ALTER TABLE customers AUTO_INCREMENT = 1;
ALTER TABLE suppliers AUTO_INCREMENT = 1;


-- =========================================================
-- MODE B: FULL CLEAN BUSINESS DATA
--
-- WARNING:
-- - Mode B removes products and categories too.
-- - Keep this block commented unless you intentionally want a full business data reset.
--
-- Deletes:
-- - inventory_note_adjustments
-- - inventory_quantity_adjustments
-- - stock_transactions
-- - stock_vouchers
-- - product_inventory_balances
-- - inventory_balances
-- - warranty_batches
-- - products
-- - categories
-- - customers
-- - suppliers
--
-- Keeps:
-- - admins only
-- =========================================================

-- START TRANSACTION;

-- 1. Delete adjustment/audit data first.
-- DELETE FROM inventory_note_adjustments;
-- DELETE FROM inventory_quantity_adjustments;

-- 2. Delete stock transaction rows before voucher/customer/supplier rows.
-- DELETE FROM stock_transactions;

-- 3. Delete voucher headers after transaction rows.
-- DELETE FROM stock_vouchers;

-- 4. Delete inventory/batch rows before product rows.
-- DELETE FROM product_inventory_balances;
-- DELETE FROM inventory_balances;
-- DELETE FROM warranty_batches;

-- 5. Delete master business data. Admins are intentionally preserved.
-- DELETE FROM products;
-- DELETE FROM categories;
-- DELETE FROM customers;
-- DELETE FROM suppliers;

-- COMMIT;

-- Reset AUTO_INCREMENT only after COMMIT because ALTER TABLE may implicit commit in MySQL.
-- ALTER TABLE inventory_note_adjustments AUTO_INCREMENT = 1;
-- ALTER TABLE inventory_quantity_adjustments AUTO_INCREMENT = 1;
-- ALTER TABLE stock_transactions AUTO_INCREMENT = 1;
-- ALTER TABLE stock_vouchers AUTO_INCREMENT = 1;
-- ALTER TABLE product_inventory_balances AUTO_INCREMENT = 1;
-- ALTER TABLE inventory_balances AUTO_INCREMENT = 1;
-- ALTER TABLE warranty_batches AUTO_INCREMENT = 1;
-- ALTER TABLE products AUTO_INCREMENT = 1;
-- ALTER TABLE categories AUTO_INCREMENT = 1;
-- ALTER TABLE customers AUTO_INCREMENT = 1;
-- ALTER TABLE suppliers AUTO_INCREMENT = 1;
