# One-time product-name condition suffixes

Script `product-name-suffixes.js` appends a condition marker to `products.name` using only the first token of `products.sku`:

- `2nd` -> append ` 2nd`
- `new` -> append ` new`

The first SKU token is trimmed, case-insensitive, and split on `.`, `-`, `_`, or whitespace. Other SKU prefixes are not changed. Existing correct suffixes are skipped; opposite suffixes are reported as conflicts and are never auto-corrected.

## Before running

1. Make a separate full database backup.
2. Confirm the environment points to the intended database without printing credentials.
3. Run dry-run first and review every conflict and proposed change in the generated JSON file.
4. Never run `--apply` before approving that preview.

Generated preview/backup files default to:

```text
~/linhkienpc-maintenance-backups/product-name-suffixes/
```

This keeps product data outside the Git repository. Override it only when necessary with `--output-dir <directory>`.

## Dry-run

With no mode, the script defaults to dry-run. Either command performs no database writes:

```bash
node backend/scripts/product-name-suffixes.js
node backend/scripts/product-name-suffixes.js --dry-run
```

The JSON preview contains product ID, SKU, old name, proposed name, classification, status, and reason for every scanned row. The console summary reports eligible `2nd`/`new`, already-correct, conflict, unknown, length-violation, and planned-change counts.

## Apply

```bash
node backend/scripts/product-name-suffixes.js --apply --confirm APPLY_PRODUCT_NAME_SUFFIXES
```

Apply creates a timestamped JSON backup before writing. It refuses all length violations, updates only `products.name` by immutable product ID plus expected old name, runs in one transaction, verifies every affected row, and rolls back on any mismatch or error.

`products.updated_at` is defined with `ON UPDATE CURRENT_TIMESTAMP`, so rows whose names change will receive a new `updated_at` value automatically.

## Restore preview

Restore defaults to preview-only and performs no writes:

```bash
node backend/scripts/product-name-suffixes.js --restore "<backup-file>"
```

It validates the JSON structure and compares current names with the original and proposed names. Missing products and concurrent/manual name changes are reported as conflicts.

## Apply restore

Only after reviewing the restore preview:

```bash
node backend/scripts/product-name-suffixes.js --restore "<backup-file>" --confirm RESTORE_PRODUCT_NAMES
```

Restore changes only `products.name`, uses product ID plus expected proposed name, verifies row counts, and rolls back the transaction on any mismatch. It never changes SKU, category, quantity, image, price, note, or transaction data.

## Pure helper tests

These tests do not connect to a database:

```bash
node --test backend/scripts/product-name-suffixes.test.js
```
