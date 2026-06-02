# API

Base URL backend:

```text
/api/v1
```

## Response chuẩn

Success:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "server_time": "2026-06-02T10:00:00.000Z"
  }
}
```

List response:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "server_time": "2026-06-02T10:00:00.000Z"
  }
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "field": "body.quantity",
        "issue": "body.quantity must be >= 1"
      }
    ]
  },
  "meta": {
    "request_id": null,
    "server_time": "2026-06-02T10:00:00.000Z"
  }
}
```

Admin endpoints cần header:

```http
Authorization: Bearer <access_token>
```

Trừ các endpoint `/admin/auth/login`, `/admin/auth/refresh`, `/admin/auth/logout`.

## Health

### GET /health

Response:

```json
{
  "success": true,
  "data": {
    "service": "linhkienpc-backend",
    "status": "ok"
  },
  "meta": {
    "server_time": "2026-06-02T10:00:00.000Z"
  }
}
```

## Public Products

### GET /public/products?q=12400f&page=1&limit=20

Tìm public theo SKU, tên sản phẩm hoặc ghi chú nhập kho.

Response:

```json
{
  "success": true,
  "data": [
    {
      "sku": "cpu.intel.12400f",
      "name": "Intel Core i5-12400F",
      "total_quantity": 4,
      "note_groups": [
        {
          "note": "BH04.28",
          "quantity": 3
        },
        {
          "note": "BH2027",
          "quantity": 1
        }
      ]
    }
  ],
  "meta": {
    "q": "12400f",
    "search_mode": "fuzzy_contains",
    "page": 1,
    "limit": 20,
    "total": 1,
    "server_time": "2026-06-02T10:00:00.000Z"
  }
}
```

### GET /public/products/:sku/inventory

Ví dụ:

```http
GET /api/v1/public/products/cpu.intel.12400f/inventory
```

Response:

```json
{
  "success": true,
  "data": {
    "product": {
      "id": 1,
      "sku": "cpu.intel.12400f",
      "name": "Intel Core i5-12400F",
      "total_quantity": 4,
      "is_active": true
    },
    "note_groups": [
      {
        "note": "BH04.28",
        "quantity": 3
      }
    ]
  },
  "meta": {
    "server_time": "2026-06-02T10:00:00.000Z"
  }
}
```

## Public Categories

### GET /public/categories?page=1&limit=100

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "cpu",
      "name": "CPU",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-02 10:00:00",
      "updated_at": "2026-06-02 10:00:00"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 100,
    "total": 1,
    "server_time": "2026-06-02T10:00:00.000Z"
  }
}
```

## Admin Auth

### POST /admin/auth/login

Request:

```json
{
  "username": "admin",
  "password": "Admin@123456"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "access_token": "jwt-access-token",
    "refresh_token": "jwt-refresh-token",
    "token_type": "Bearer",
    "admin": {
      "id": 1,
      "username": "admin",
      "display_name": "System Admin",
      "is_active": true,
      "created_at": "2026-06-02 10:00:00",
      "updated_at": "2026-06-02 10:00:00"
    }
  },
  "meta": {
    "server_time": "2026-06-02T10:00:00.000Z"
  }
}
```

### POST /admin/auth/refresh

Request:

```json
{
  "refresh_token": "jwt-refresh-token"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "access_token": "new-jwt-access-token",
    "refresh_token": "new-jwt-refresh-token",
    "token_type": "Bearer"
  },
  "meta": {
    "server_time": "2026-06-02T10:00:00.000Z"
  }
}
```

### POST /admin/auth/logout

Request:

```json
{
  "refresh_token": "jwt-refresh-token"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "logged_out": true,
    "revoked": true
  },
  "meta": {
    "server_time": "2026-06-02T10:00:00.000Z"
  }
}
```

### GET /admin/auth/me

Response:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin",
    "display_name": "System Admin",
    "is_active": true,
    "created_at": "2026-06-02 10:00:00",
    "updated_at": "2026-06-02 10:00:00"
  },
  "meta": {
    "server_time": "2026-06-02T10:00:00.000Z"
  }
}
```

## Admin Categories

### GET /admin/categories?page=1&limit=20&q=cpu&is_active=true

Response `data[]` item:

```json
{
  "id": 1,
  "code": "cpu",
  "name": "CPU",
  "description": null,
  "is_active": true,
  "created_at": "2026-06-02 10:00:00",
  "updated_at": "2026-06-02 10:00:00"
}
```

### POST /admin/categories

Request:

```json
{
  "code": "cpu",
  "name": "CPU",
  "description": "Bộ xử lý"
}
```

Response: category object.

### GET /admin/categories/:id

Response: category object.

### PATCH /admin/categories/:id

Request:

```json
{
  "name": "CPU",
  "description": "Bộ xử lý"
}
```

Response: category object.

### PATCH /admin/categories/:id/deactivate

Soft deactivate category. Không cascade deactivate product.

### PATCH /admin/categories/:id/activate

Activate category.

## Admin Products

### GET /admin/products?page=1&limit=20&q=12400&category_id=1&is_active=true

Response `data[]` item:

```json
{
  "id": 1,
  "sku": "cpu.intel.12400f",
  "name": "Intel Core i5-12400F",
  "category_id": 1,
  "category": {
    "id": 1,
    "code": "cpu",
    "name": "CPU",
    "is_active": true
  },
  "category_is_active": true,
  "spec_summary": null,
  "total_quantity": 4,
  "note_groups": [
    {
      "note": "BH04.28",
      "quantity": 3
    }
  ],
  "is_active": true,
  "created_at": "2026-06-02 10:00:00",
  "updated_at": "2026-06-02 10:00:00"
}
```

### POST /admin/products

Request:

```json
{
  "sku": "cpu.intel.12400f",
  "name": "Intel Core i5-12400F",
  "category_id": 1,
  "spec_summary": null
}
```

Response: product object.

### GET /admin/products/:id

Response: product object.

### PATCH /admin/products/:id

Request:

```json
{
  "name": "Intel Core i5-12400F Tray",
  "category_id": 1,
  "spec_summary": "CPU Intel socket 1700"
}
```

Response: product object.

### PATCH /admin/products/:id/deactivate

Soft deactivate product.

### PATCH /admin/products/:id/activate

Activate product.

## Admin Customers

### GET /admin/customers?keyword=nguyen&page=1&limit=20

Response `data[]` item:

```json
{
  "id": 1,
  "name": "Nguyễn Văn A",
  "phone": "0909000000",
  "address": "123 Nguyễn Huệ",
  "is_active": true,
  "transaction_count": 2,
  "last_transaction_at": "2026-06-02 10:30:00",
  "created_at": "2026-06-02 10:00:00",
  "updated_at": "2026-06-02 10:00:00"
}
```

### POST /admin/customers

Request:

```json
{
  "name": "Nguyễn Văn A",
  "phone": "0909000000",
  "address": "123 Nguyễn Huệ"
}
```

Response: customer object.

### GET /admin/customers/:id

Response: customer object.

### GET /admin/customers/:id/transactions?page=1&limit=10

Response `data[]` item:

```json
{
  "id": 10,
  "txn_type": "OUT",
  "quantity": 1,
  "note": "BH04.28",
  "occurred_at": "2026-06-02 10:30:00",
  "product": {
    "id": 1,
    "sku": "cpu.intel.12400f",
    "name": "Intel Core i5-12400F"
  },
  "created_by_admin": {
    "id": 1,
    "username": "admin"
  }
}
```

## Admin Suppliers

### GET /admin/suppliers?keyword=abc&page=1&limit=20

Response `data[]` item:

```json
{
  "id": 1,
  "name": "Công ty Linh Kiện ABC",
  "phone": "0280000000",
  "address": "TP.HCM",
  "is_active": true,
  "transaction_count": 3,
  "last_transaction_at": "2026-06-02 10:20:00",
  "created_at": "2026-06-02 10:00:00",
  "updated_at": "2026-06-02 10:00:00"
}
```

### POST /admin/suppliers

Request:

```json
{
  "name": "Công ty Linh Kiện ABC",
  "phone": "0280000000",
  "address": "TP.HCM"
}
```

Response: supplier object.

## Admin Stock Operations

### POST /admin/stock-in

Nhập hàng theo SKU. `supplier_id` là optional.

Request:

```json
{
  "sku": "cpu.intel.12400f",
  "quantity": 3,
  "supplier_id": 1,
  "note": "BH04.28"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "resolved": {
      "product_id": 1,
      "sku": "cpu.intel.12400f"
    },
    "transaction": {
      "id": 10,
      "txn_type": "IN",
      "product_id": 1,
      "customer_id": null,
      "supplier_id": 1,
      "quantity": 3,
      "note": "BH04.28",
      "created_by_admin_id": 1,
      "occurred_at": "2026-06-02 10:20:00"
    },
    "inventory_balance": {
      "sku": "cpu.intel.12400f",
      "quantity": 4,
      "updated_at": "2026-06-02 10:20:00"
    }
  },
  "meta": {
    "server_time": "2026-06-02T10:20:00.000Z"
  }
}
```

### POST /admin/stock-out

Xuất hàng theo SKU. `customer_id` là optional. Nếu sản phẩm có note group còn tồn thì cần chọn `warranty_note` hoặc gửi note tương ứng.

Request:

```json
{
  "sku": "cpu.intel.12400f",
  "quantity": 1,
  "customer_id": 1,
  "warranty_note": "BH04.28",
  "note": "BH04.28"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "resolved": {
      "product_id": 1,
      "sku": "cpu.intel.12400f"
    },
    "transaction": {
      "id": 11,
      "txn_type": "OUT",
      "product_id": 1,
      "customer_id": 1,
      "supplier_id": null,
      "quantity": 1,
      "note": "BH04.28",
      "created_by_admin_id": 1,
      "occurred_at": "2026-06-02 10:30:00"
    },
    "inventory_balance": {
      "sku": "cpu.intel.12400f",
      "quantity": 3,
      "updated_at": "2026-06-02 10:30:00"
    }
  },
  "meta": {
    "server_time": "2026-06-02T10:30:00.000Z"
  }
}
```

## Admin Stock Transactions

### GET /admin/stock-transactions?page=1&limit=10&sku=cpu.intel.12400f&txn_type=IN&note=BH04.28

Query hỗ trợ trong service hiện tại:

- `page`
- `limit`
- `sku`
- `txn_type`
- `from`
- `to`
- `product_id`
- `note`
- `batch_code` như alias để tìm trong `note`

Response `data[]` item:

```json
{
  "id": 11,
  "txn_type": "OUT",
  "product": {
    "id": 1,
    "sku": "cpu.intel.12400f",
    "name": "Intel Core i5-12400F",
    "is_active": true
  },
  "category": {
    "id": 1,
    "name": "CPU",
    "is_active": true
  },
  "warranty_batch": null,
  "customer": {
    "id": 1,
    "name": "Nguyễn Văn A",
    "phone": "0909000000",
    "address": "123 Nguyễn Huệ"
  },
  "supplier": null,
  "quantity": 1,
  "note": "BH04.28",
  "created_by_admin": {
    "id": 1,
    "username": "admin"
  },
  "occurred_at": "2026-06-02 10:30:00"
}
```

## Admin Inventory

### GET /admin/inventory?page=1&limit=20&q=12400&category_id=1&include_inactive=false

Response `data[]` item:

```json
{
  "product_id": 1,
  "sku": "cpu.intel.12400f",
  "product_name": "Intel Core i5-12400F",
  "product_is_active": true,
  "category": {
    "id": 1,
    "code": "cpu",
    "name": "CPU",
    "is_active": true
  },
  "total_quantity": 3,
  "updated_at": "2026-06-02 10:30:00"
}
```

## Admin Warranty Batch Module

Module này vẫn tồn tại ở backend nhưng không phải workflow tồn kho chính hiện tại.

### GET /admin/products/:productId/batches

List batch theo product.

### POST /admin/products/:productId/batches

Request:

```json
{
  "batch_code": "BH 07.26",
  "warranty_end_month": 7,
  "warranty_end_year": 2026
}
```

### GET /admin/batches/:id

Get batch.

### PATCH /admin/batches/:id

Update batch.

### PATCH /admin/batches/:id/deactivate

Soft deactivate batch.

### PATCH /admin/batches/:id/activate

Activate batch.
