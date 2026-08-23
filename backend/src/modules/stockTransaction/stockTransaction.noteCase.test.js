const assert = require('node:assert/strict');
const test = require('node:test');
const { pool } = require('../../config/database');
const { NO_NOTE_WARRANTY_KEY, normalizeNoteKey } = require('../../utils/inventoryNoteGroups');
const stockTransactionService = require('./stockTransaction.service');

const originalGetConnection = pool.getConnection;

test.afterEach(() => {
  pool.getConnection = originalGetConnection;
});

function installStockOutFixture({ groupNote, mode }) {
  const captured = {
    transactionNote: undefined,
    warrantySnapshot: undefined
  };
  let transactionId = 700;

  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async query(sql, params = []) {
      if (/SELECT id, sku, is_active\s+FROM products/i.test(sql)) {
        return [[{ id: 17, sku: '2nd.cpu.intel.test', is_active: 1 }]];
      }

      if (/SELECT id, sku, name, sale_price, is_active\s+FROM products/i.test(sql)) {
        return [[{
          id: 17,
          sku: '2nd.cpu.intel.test',
          name: 'CPU Intel Test',
          sale_price: 1000000,
          is_active: 1
        }]];
      }

      if (/SELECT id, quantity\s+FROM product_inventory_balances/i.test(sql)) {
        return [[{ id: 33, quantity: 5 }]];
      }

      if (/SELECT id, product_id, quantity\s+FROM product_inventory_balances/i.test(sql)) {
        return [[{ id: 33, product_id: 17, quantity: 5 }]];
      }

      if (/SELECT product_id, txn_type, quantity, note\s+FROM stock_transactions/i.test(sql)) {
        return [[{ product_id: 17, txn_type: 'IN', quantity: 5, note: groupNote }]];
      }

      if (/FROM inventory_quantity_adjustments/i.test(sql)) {
        return [[]];
      }

      if (/FROM inventory_note_adjustments/i.test(sql)) {
        return [[]];
      }

      if (/SELECT product_id, quantity\s+FROM product_inventory_balances/i.test(sql)) {
        return [[{ product_id: 17, quantity: 5 }]];
      }

      if (/INSERT INTO stock_vouchers/i.test(sql)) {
        return [{ insertId: 90 }];
      }

      if (/UPDATE stock_vouchers\s+SET voucher_code/i.test(sql)) {
        return [{ affectedRows: 1 }];
      }

      if (/UPDATE stock_vouchers\s+SET total_amount/i.test(sql)) {
        return [{ affectedRows: 1 }];
      }

      if (/UPDATE product_inventory_balances/i.test(sql) || /INSERT INTO product_inventory_balances/i.test(sql)) {
        return [{ affectedRows: 1 }];
      }

      if (/INSERT INTO stock_transactions/i.test(sql)) {
        captured.transactionNote = mode === 'bulk' ? params[4] : params[5];
        transactionId += 1;
        return [{ insertId: transactionId }];
      }

      if (/SELECT id, txn_type, product_id/i.test(sql) && /FROM stock_transactions/i.test(sql)) {
        return [[{
          id: transactionId,
          txn_type: 'OUT',
          product_id: 17,
          customer_id: null,
          supplier_id: null,
          quantity: 1,
          note: captured.transactionNote,
          created_by_admin_id: 2,
          occurred_at: '2026-08-23 10:00:00'
        }]];
      }

      if (/SELECT quantity, updated_at\s+FROM product_inventory_balances/i.test(sql)) {
        return [[{ quantity: 4, updated_at: '2026-08-23 10:00:00' }]];
      }

      if (/INSERT INTO stock_voucher_items/i.test(sql)) {
        captured.warrantySnapshot = params[5];
        return [{ insertId: 800 }];
      }

      throw new Error(`Unexpected query: ${sql}`);
    }
  };

  pool.getConnection = async () => connection;
  return captured;
}

test('single stock-out matches a normalized key but stores the canonical group note', async () => {
  const captured = installStockOutFixture({ groupNote: 'BH 3 tháng tại shop', mode: 'single' });

  const result = await stockTransactionService.stockOut({
    adminId: 2,
    sku: '2nd.cpu.intel.test',
    quantity: 1,
    warrantyNote: '  bh 3 THÁNG TẠI shop  '
  });

  assert.equal(captured.transactionNote, 'BH 3 tháng tại shop');
  assert.equal(result.transaction.note, 'BH 3 tháng tại shop');
});

test('bulk stock-out stores the canonical group note in transaction and voucher snapshot', async () => {
  const captured = installStockOutFixture({ groupNote: 'Bao test 7 ngày', mode: 'bulk' });

  const result = await stockTransactionService.bulkStockOut({
    adminId: 2,
    items: [{
      sku: '2nd.cpu.intel.test',
      quantity: 1,
      warranty_note: 'bao TEST 7 NGÀY',
      discount_amount: 0
    }]
  });

  assert.equal(captured.transactionNote, 'Bao test 7 ngày');
  assert.equal(captured.warrantySnapshot, 'Bao test 7 ngày');
  assert.equal(result.items[0].warranty_note, 'Bao test 7 ngày');
});

test('no-note stock-out continues to store null', async () => {
  const captured = installStockOutFixture({ groupNote: null, mode: 'single' });

  const result = await stockTransactionService.stockOut({
    adminId: 2,
    sku: '2nd.cpu.intel.test',
    quantity: 1,
    warrantyNote: NO_NOTE_WARRANTY_KEY
  });

  assert.equal(captured.transactionNote, null);
  assert.equal(result.transaction.note, null);
});

test('normalized note keys remain case-insensitive and whitespace-normalized for matching', () => {
  assert.equal(normalizeNoteKey('BH 3 tháng tại shop'), normalizeNoteKey('  bh 3 THÁNG TẠI shop  '));
  assert.equal(normalizeNoteKey('Bao test 7 ngày'), normalizeNoteKey('bao TEST 7 NGÀY'));
  assert.equal(normalizeNoteKey(NO_NOTE_WARRANTY_KEY), '');
});
