# Thiết kế API (hợp đồng JSON) - LINHKIENPC

Base URL: `/api/v1`

## 1) Quy ước chung

### 1.1 Success response (chuẩn)
```json
{
  "success": true,
  "data": {},
  "meta": {
    "request_id": "req_20260601_000001",
    "server_time": "2026-06-01T10:30:00Z"
  }
}
```

### 1.2 Error response (chuẩn)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu không hợp lệ.",
    "details": [
      {
        "field": "quantity",
        "issue": "must_be_greater_than_zero"
      }
    ]
  },
  "meta": {
    "request_id": "req_20260601_000002",
    "server_time": "2026-06-01T10:31:00Z"
  }
}
```

### 1.3 HTTP status đề xuất
- `200`: Lấy dữ liệu thành công.
- `201`: Tạo mới thành công.
- `400`: Lỗi validate/logic.
- `401`: Chưa đăng nhập hoặc token không hợp lệ.
- `403`: Không đủ quyền.
- `404`: Không tìm thấy dữ liệu.
- `409`: Xung đột dữ liệu (ví dụ SKU trùng).
- `422`: Nghiệp vụ không thỏa (ví dụ xuất kho vượt tồn).

### 1.4 Quy tắc dữ liệu bắt buộc
- SKU là model sản phẩm (ví dụ: `cpu.intel.12400f`).
- Batch là bản ghi tồn kho theo bảo hành (ví dụ: `BH 07.26`).
- Không có price/image trong mọi payload.
- Timestamp do server sinh (`created_at`, `updated_at`, `occurred_at`).
- Soft delete qua `is_active`.
- Stock-in/stock-out theo hướng SKU-centric: client gửi `sku` làm định danh chính, backend tự resolve ID nội bộ.

## 2) Chính sách Auth Admin (JWT)
- Header: `Authorization: Bearer <access_token>`.
- Refresh token rotation: lưu hash ở bảng `admin_refresh_tokens`.

### 2.1 POST `/api/v1/admin/auth/login`
Mục đích: Đăng nhập admin.

Request body:
```json
{
  "username": "admin_main",
  "password": "StrongPassword123!"
}
```

Success response (`200`):
```json
{
  "success": true,
  "data": {
    "access_token": "<jwt_access_token>",
    "token_type": "Bearer",
    "expires_in": 3600,
    "refresh_token": "<jwt_refresh_token>",
    "admin": {
      "id": 1,
      "username": "admin_main",
      "display_name": "Main Admin",
      "is_active": true,
      "created_at": "2026-06-01T09:00:00Z",
      "updated_at": "2026-06-01T09:00:00Z"
    }
  },
  "meta": {
    "request_id": "req_login_001",
    "server_time": "2026-06-01T10:35:00Z"
  }
}
```

Error response (`401`):
```json
{
  "success": false,
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Sai tên đăng nhập hoặc mật khẩu."
  },
  "meta": {
    "request_id": "req_login_002",
    "server_time": "2026-06-01T10:35:05Z"
  }
}
```

### 2.2 POST `/api/v1/admin/auth/refresh`
Request body:
```json
{
  "refresh_token": "<jwt_refresh_token>"
}
```

Success response (`200`):
```json
{
  "success": true,
  "data": {
    "access_token": "<new_jwt_access_token>",
    "token_type": "Bearer",
    "expires_in": 3600,
    "refresh_token": "<new_jwt_refresh_token>"
  },
  "meta": {
    "request_id": "req_refresh_001",
    "server_time": "2026-06-01T10:40:00Z"
  }
}
```

### 2.3 POST `/api/v1/admin/auth/logout`
Request body:
```json
{
  "refresh_token": "<jwt_refresh_token>"
}
```

Success response (`200`):
```json
{
  "success": true,
  "data": {
    "logged_out": true
  },
  "meta": {
    "request_id": "req_logout_001",
    "server_time": "2026-06-01T10:41:00Z"
  }
}
```

### 2.4 GET `/api/v1/admin/auth/me`
Success response (`200`):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin_main",
    "display_name": "Main Admin",
    "is_active": true,
    "created_at": "2026-06-01T09:00:00Z",
    "updated_at": "2026-06-01T09:00:00Z"
  },
  "meta": {
    "request_id": "req_me_001",
    "server_time": "2026-06-01T10:41:30Z"
  }
}
```

## 3) Public APIs

### 3.1 GET `/api/v1/public/products`
Mục đích: Public inventory search.
Query:
- `q`: từ khóa tìm kiếm tổng quát (fuzzy/partial text).
- `category_id`: lọc category (tuỳ chọn).
- `batch_code`: lọc theo batch cụ thể (tuỳ chọn).
- `page`, `limit`.

Phạm vi fuzzy search của `q`:
- SKU (`products.sku`)
- Tên sản phẩm (`products.name`)
- Mã/tên category (`categories.code`, `categories.name`)
- Batch code (`warranty_batches.batch_code`)

Ghi chú tối ưu:
- Nếu MySQL hỗ trợ FULLTEXT, backend ưu tiên chiến lược tìm kiếm với `FULLTEXT(products.name)`.
- Nếu không hỗ trợ FULLTEXT, backend fallback về `LIKE` theo partial text (kết hợp phân trang và giới hạn kết quả).

Ví dụ `q` phải match được sản phẩm liên quan:
- `12400`
- `12400f`
- `07.26`
- `4060`
- `b760`

Quy tắc:
- Chỉ lọc theo `products.is_active = true`.
- Category inactive không ẩn product active.

Success response (`200`):
```json
{
  "success": true,
  "data": [
    {
      "id": 101,
      "sku": "cpu.intel.12400f",
      "name": "Intel Core i5-12400F",
      "category": {
        "id": 1,
        "code": "cpu",
        "name": "CPU",
        "is_active": false
      },
      "matched_batches": [
        "BH 07.26"
      ],
      "is_active": true,
      "created_at": "2026-06-01T09:10:00Z",
      "updated_at": "2026-06-01T10:00:00Z"
    }
  ],
  "meta": {
    "q": "07.26",
    "search_mode": "fuzzy_contains",
    "page": 1,
    "limit": 20,
    "total": 1,
    "request_id": "req_public_products_001",
    "server_time": "2026-06-01T10:45:00Z"
  }
}
```

### 3.2 GET `/api/v1/public/products/:sku/inventory`
Mục đích: Xem tồn kho theo batch của một SKU.
Quy tắc: mặc định chỉ batch active.

Success response (`200`):
```json
{
  "success": true,
  "data": {
    "product": {
      "id": 101,
      "sku": "cpu.intel.12400f",
      "name": "Intel Core i5-12400F",
      "is_active": true
    },
    "batches": [
      {
        "warranty_batch_id": 5001,
        "batch_code": "BH 07.26",
        "is_active": true,
        "quantity": 12,
        "updated_at": "2026-06-01T10:20:00Z"
      },
      {
        "warranty_batch_id": 5002,
        "batch_code": "BH 11.27",
        "is_active": true,
        "quantity": 8,
        "updated_at": "2026-06-01T10:25:00Z"
      }
    ]
  },
  "meta": {
    "request_id": "req_public_inventory_001",
    "server_time": "2026-06-01T10:46:00Z"
  }
}
```

### 3.3 GET `/api/v1/public/categories`
Success response (`200`):
```json
{
  "success": true,
  "data": [
    {
      "id": 2,
      "code": "mainboard",
      "name": "Mainboard",
      "is_active": true
    }
  ],
  "meta": {
    "request_id": "req_public_categories_001",
    "server_time": "2026-06-01T10:47:00Z"
  }
}
```

## 4) Admin Category CRUD

### 4.1 GET `/api/v1/admin/categories`
Success response (`200`):
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "cpu",
      "name": "CPU",
      "description": "Bo xu ly trung tam",
      "is_active": false,
      "created_at": "2026-06-01T09:01:00Z",
      "updated_at": "2026-06-01T09:59:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "request_id": "req_admin_categories_001",
    "server_time": "2026-06-01T10:50:00Z"
  }
}
```

### 4.2 POST `/api/v1/admin/categories`
Request body:
```json
{
  "code": "ram",
  "name": "RAM",
  "description": "Bo nho trong"
}
```

Success response (`201`):
```json
{
  "success": true,
  "data": {
    "id": 3,
    "code": "ram",
    "name": "RAM",
    "description": "Bo nho trong",
    "is_active": true,
    "created_at": "2026-06-01T10:50:30Z",
    "updated_at": "2026-06-01T10:50:30Z"
  },
  "meta": {
    "request_id": "req_admin_categories_002",
    "server_time": "2026-06-01T10:50:30Z"
  }
}
```

### 4.3 GET `/api/v1/admin/categories/:id`
Success response (`200`):
```json
{
  "success": true,
  "data": {
    "id": 3,
    "code": "ram",
    "name": "RAM",
    "description": "Bo nho trong",
    "is_active": true,
    "created_at": "2026-06-01T10:50:30Z",
    "updated_at": "2026-06-01T10:50:30Z"
  },
  "meta": {
    "request_id": "req_admin_categories_003",
    "server_time": "2026-06-01T10:51:00Z"
  }
}
```

### 4.4 PATCH `/api/v1/admin/categories/:id`
Request body:
```json
{
  "name": "Memory RAM",
  "description": "Bo nho he thong"
}
```

Success response (`200`):
```json
{
  "success": true,
  "data": {
    "id": 3,
    "code": "ram",
    "name": "Memory RAM",
    "description": "Bo nho he thong",
    "is_active": true,
    "created_at": "2026-06-01T10:50:30Z",
    "updated_at": "2026-06-01T10:52:00Z"
  },
  "meta": {
    "request_id": "req_admin_categories_004",
    "server_time": "2026-06-01T10:52:00Z"
  }
}
```

### 4.5 PATCH `/api/v1/admin/categories/:id/deactivate`
Request body:
```json
{}
```

Success response (`200`):
```json
{
  "success": true,
  "data": {
    "id": 3,
    "is_active": false,
    "updated_at": "2026-06-01T10:53:00Z"
  },
  "meta": {
    "request_id": "req_admin_categories_005",
    "server_time": "2026-06-01T10:53:00Z"
  }
}
```

### 4.6 PATCH `/api/v1/admin/categories/:id/activate`
Request body:
```json
{}
```

Success response (`200`):
```json
{
  "success": true,
  "data": {
    "id": 3,
    "is_active": true,
    "updated_at": "2026-06-01T10:54:00Z"
  },
  "meta": {
    "request_id": "req_admin_categories_006",
    "server_time": "2026-06-01T10:54:00Z"
  }
}
```

## 5) Admin Product CRUD

### 5.1 GET `/api/v1/admin/products`
Query: `q`, `category_id`, `is_active`, `page`, `limit`.

Success response (`200`):
```json
{
  "success": true,
  "data": [
    {
      "id": 101,
      "sku": "cpu.intel.12400f",
      "name": "Intel Core i5-12400F",
      "category": {
        "id": 1,
        "code": "cpu",
        "name": "CPU",
        "is_active": false
      },
      "category_is_active": false,
      "spec_summary": "6C/12T, LGA1700",
      "is_active": true,
      "created_at": "2026-06-01T09:10:00Z",
      "updated_at": "2026-06-01T10:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "request_id": "req_admin_products_001",
    "server_time": "2026-06-01T10:55:00Z"
  }
}
```

### 5.2 POST `/api/v1/admin/products`
Request body:
```json
{
  "sku": "ram.corsair.3200.16gb",
  "name": "Corsair Vengeance LPX 16GB 3200",
  "category_id": 3,
  "spec_summary": "DDR4 16GB (2x8GB), 3200MHz"
}
```

Success response (`201`):
```json
{
  "success": true,
  "data": {
    "id": 102,
    "sku": "ram.corsair.3200.16gb",
    "name": "Corsair Vengeance LPX 16GB 3200",
    "category_id": 3,
    "spec_summary": "DDR4 16GB (2x8GB), 3200MHz",
    "is_active": true,
    "created_at": "2026-06-01T10:56:00Z",
    "updated_at": "2026-06-01T10:56:00Z"
  },
  "meta": {
    "request_id": "req_admin_products_002",
    "server_time": "2026-06-01T10:56:00Z"
  }
}
```

### 5.3 GET `/api/v1/admin/products/:id`
Success response (`200`):
```json
{
  "success": true,
  "data": {
    "id": 102,
    "sku": "ram.corsair.3200.16gb",
    "name": "Corsair Vengeance LPX 16GB 3200",
    "category": {
      "id": 3,
      "code": "ram",
      "name": "RAM",
      "is_active": true
    },
    "spec_summary": "DDR4 16GB (2x8GB), 3200MHz",
    "is_active": true,
    "created_at": "2026-06-01T10:56:00Z",
    "updated_at": "2026-06-01T10:56:00Z"
  },
  "meta": {
    "request_id": "req_admin_products_003",
    "server_time": "2026-06-01T10:56:20Z"
  }
}
```

### 5.4 PATCH `/api/v1/admin/products/:id`
Request body:
```json
{
  "name": "Corsair Vengeance LPX 16GB 3200 CL16",
  "spec_summary": "DDR4 16GB (2x8GB), 3200MHz, CL16"
}
```

Success response (`200`):
```json
{
  "success": true,
  "data": {
    "id": 102,
    "sku": "ram.corsair.3200.16gb",
    "name": "Corsair Vengeance LPX 16GB 3200 CL16",
    "category_id": 3,
    "spec_summary": "DDR4 16GB (2x8GB), 3200MHz, CL16",
    "is_active": true,
    "created_at": "2026-06-01T10:56:00Z",
    "updated_at": "2026-06-01T10:57:00Z"
  },
  "meta": {
    "request_id": "req_admin_products_004",
    "server_time": "2026-06-01T10:57:00Z"
  }
}
```

### 5.5 PATCH `/api/v1/admin/products/:id/deactivate`
Request body:
```json
{}
```

Success response (`200`):
```json
{
  "success": true,
  "data": {
    "id": 102,
    "is_active": false,
    "updated_at": "2026-06-01T10:58:00Z"
  },
  "meta": {
    "request_id": "req_admin_products_005",
    "server_time": "2026-06-01T10:58:00Z"
  }
}
```

### 5.6 PATCH `/api/v1/admin/products/:id/activate`
Request body:
```json
{}
```

Success response (`200`):
```json
{
  "success": true,
  "data": {
    "id": 102,
    "is_active": true,
    "updated_at": "2026-06-01T10:59:00Z"
  },
  "meta": {
    "request_id": "req_admin_products_006",
    "server_time": "2026-06-01T10:59:00Z"
  }
}
```

## 6) Admin Warranty Batch CRUD

### 6.1 GET `/api/v1/admin/products/:productId/batches`
Success response (`200`):
```json
{
  "success": true,
  "data": [
    {
      "id": 5001,
      "product_id": 101,
      "batch_code": "BH 07.26",
      "warranty_end_month": 7,
      "warranty_end_year": 2026,
      "is_active": true,
      "quantity": 12,
      "created_at": "2026-06-01T09:20:00Z",
      "updated_at": "2026-06-01T10:20:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "request_id": "req_admin_batches_001",
    "server_time": "2026-06-01T11:00:00Z"
  }
}
```

### 6.2 POST `/api/v1/admin/products/:productId/batches`
Request body:
```json
{
  "batch_code": "BH 02.28",
  "warranty_end_month": 2,
  "warranty_end_year": 2028
}
```

Success response (`201`):
```json
{
  "success": true,
  "data": {
    "id": 5003,
    "product_id": 101,
    "batch_code": "BH 02.28",
    "warranty_end_month": 2,
    "warranty_end_year": 2028,
    "is_active": true,
    "created_at": "2026-06-01T11:01:00Z",
    "updated_at": "2026-06-01T11:01:00Z"
  },
  "meta": {
    "request_id": "req_admin_batches_002",
    "server_time": "2026-06-01T11:01:00Z"
  }
}
```

### 6.3 GET `/api/v1/admin/batches/:id`
Success response (`200`):
```json
{
  "success": true,
  "data": {
    "id": 5003,
    "product_id": 101,
    "batch_code": "BH 02.28",
    "warranty_end_month": 2,
    "warranty_end_year": 2028,
    "is_active": true,
    "created_at": "2026-06-01T11:01:00Z",
    "updated_at": "2026-06-01T11:01:00Z"
  },
  "meta": {
    "request_id": "req_admin_batches_003",
    "server_time": "2026-06-01T11:01:30Z"
  }
}
```

### 6.4 PATCH `/api/v1/admin/batches/:id`
Request body:
```json
{
  "warranty_end_month": 3,
  "warranty_end_year": 2028
}
```

Success response (`200`):
```json
{
  "success": true,
  "data": {
    "id": 5003,
    "product_id": 101,
    "batch_code": "BH 02.28",
    "warranty_end_month": 3,
    "warranty_end_year": 2028,
    "is_active": true,
    "created_at": "2026-06-01T11:01:00Z",
    "updated_at": "2026-06-01T11:02:00Z"
  },
  "meta": {
    "request_id": "req_admin_batches_004",
    "server_time": "2026-06-01T11:02:00Z"
  }
}
```

### 6.5 PATCH `/api/v1/admin/batches/:id/deactivate`
Request body:
```json
{}
```

Success response (`200`):
```json
{
  "success": true,
  "data": {
    "id": 5003,
    "is_active": false,
    "updated_at": "2026-06-01T11:03:00Z"
  },
  "meta": {
    "request_id": "req_admin_batches_005",
    "server_time": "2026-06-01T11:03:00Z"
  }
}
```

### 6.6 PATCH `/api/v1/admin/batches/:id/activate`
Request body:
```json
{}
```

Success response (`200`):
```json
{
  "success": true,
  "data": {
    "id": 5003,
    "is_active": true,
    "updated_at": "2026-06-01T11:04:00Z"
  },
  "meta": {
    "request_id": "req_admin_batches_006",
    "server_time": "2026-06-01T11:04:00Z"
  }
}
```

## 7) Admin Inventory Movements (SKU-centric)

Transaction workflow bắt buộc cho cả stock-in và stock-out:
1. `BEGIN TRANSACTION`
2. Validate `sku`
3. Validate `batch_code` (nếu có) và resolve batch mục tiêu
4. Validate `quantity`
5. Với stock-out: kiểm tra tồn khả dụng, thiếu tồn thì reject
6. Update `inventory_balances`
7. Insert `stock_transactions`
8. `COMMIT`
9. Lỗi bất kỳ bước nào: `ROLLBACK`

### 7.1 POST `/api/v1/admin/stock-in`
Request body (SKU-centric):
```json
{
  "sku": "cpu.intel.12400f",
  "batch_code": "BH 07.26",
  "quantity": 10,
  "note": "Nhap kho theo phieu NK-2026-0001"
}
```

Ghi chú:
- `sku` là bắt buộc.
- `batch_code` là tuỳ chọn; nếu SKU có nhiều batch active, backend có thể yêu cầu `batch_code` để định danh chính xác.
- Backend tự resolve `product_id` và `warranty_batch_id` nội bộ.

Success response (`201`):
```json
{
  "success": true,
  "data": {
    "resolved": {
      "product_id": 101,
      "warranty_batch_id": 5001,
      "sku": "cpu.intel.12400f",
      "batch_code": "BH 07.26"
    },
    "transaction": {
      "id": 9001,
      "txn_type": "IN",
      "product_id": 101,
      "warranty_batch_id": 5001,
      "quantity": 10,
      "note": "Nhap kho theo phieu NK-2026-0001",
      "created_by_admin_id": 1,
      "occurred_at": "2026-06-01T11:05:00Z"
    },
    "inventory_balance": {
      "sku": "cpu.intel.12400f",
      "batch_code": "BH 07.26",
      "quantity": 22,
      "updated_at": "2026-06-01T11:05:00Z"
    }
  },
  "meta": {
    "request_id": "req_stock_in_001",
    "server_time": "2026-06-01T11:05:00Z"
  }
}
```

### 7.2 POST `/api/v1/admin/stock-out`
Request body (SKU-centric):
```json
{
  "sku": "cpu.intel.12400f",
  "batch_code": "BH 07.26",
  "quantity": 4,
  "note": "Xuat kho cho ky thuat lap may"
}
```

Success response (`201`):
```json
{
  "success": true,
  "data": {
    "resolved": {
      "product_id": 101,
      "warranty_batch_id": 5001,
      "sku": "cpu.intel.12400f",
      "batch_code": "BH 07.26"
    },
    "transaction": {
      "id": 9002,
      "txn_type": "OUT",
      "product_id": 101,
      "warranty_batch_id": 5001,
      "quantity": 4,
      "note": "Xuat kho cho ky thuat lap may",
      "created_by_admin_id": 1,
      "occurred_at": "2026-06-01T11:06:00Z"
    },
    "inventory_balance": {
      "sku": "cpu.intel.12400f",
      "batch_code": "BH 07.26",
      "quantity": 18,
      "updated_at": "2026-06-01T11:06:00Z"
    }
  },
  "meta": {
    "request_id": "req_stock_out_001",
    "server_time": "2026-06-01T11:06:00Z"
  }
}
```

Error response ví dụ (`422`, xuất vượt tồn):
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "So luong ton khong du de xuat.",
    "details": [
      {
        "field": "quantity",
        "issue": "exceeds_available_stock",
        "available": 2
      }
    ]
  },
  "meta": {
    "request_id": "req_stock_out_002",
    "server_time": "2026-06-01T11:06:10Z"
  }
}
```

Error response ví dụ (`400`, thiếu `batch_code` khi SKU có nhiều batch active):
```json
{
  "success": false,
  "error": {
    "code": "BATCH_CODE_REQUIRED",
    "message": "SKU co nhieu batch active, can cung cap batch_code."
  },
  "meta": {
    "request_id": "req_stock_out_003",
    "server_time": "2026-06-01T11:06:15Z"
  }
}
```

## 8) Admin Transaction History

### 8.1 GET `/api/v1/admin/stock-transactions`
Query:
- `sku` (ưu tiên dùng)
- `batch_code` (tuỳ chọn)
- `txn_type`, `from`, `to`, `page`, `limit`
- `product_id`, `warranty_batch_id` (tuỳ chọn, dùng nội bộ/admin nâng cao)

Quy tắc: luôn giữ lịch sử kể cả khi category/product/batch inactive.

Success response (`200`):
```json
{
  "success": true,
  "data": [
    {
      "id": 9002,
      "txn_type": "OUT",
      "product": {
        "id": 101,
        "sku": "cpu.intel.12400f",
        "name": "Intel Core i5-12400F",
        "is_active": true
      },
      "category": {
        "id": 1,
        "name": "CPU",
        "is_active": false
      },
      "warranty_batch": {
        "id": 5001,
        "batch_code": "BH 07.26",
        "is_active": true
      },
      "quantity": 4,
      "note": "Xuat kho cho ky thuat lap may",
      "created_by_admin": {
        "id": 1,
        "username": "admin_main"
      },
      "occurred_at": "2026-06-01T11:06:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "request_id": "req_tx_history_001",
    "server_time": "2026-06-01T11:07:00Z"
  }
}
```

## 9) Lỗi nghiệp vụ thường gặp (mã lỗi đề xuất)
- `AUTH_INVALID_CREDENTIALS`
- `AUTH_TOKEN_EXPIRED`
- `AUTH_TOKEN_INVALID`
- `RESOURCE_NOT_FOUND`
- `SKU_ALREADY_EXISTS`
- `SKU_NOT_FOUND`
- `CATEGORY_CODE_ALREADY_EXISTS`
- `CATEGORY_NAME_ALREADY_EXISTS`
- `BATCH_CODE_ALREADY_EXISTS_FOR_PRODUCT`
- `BATCH_CODE_REQUIRED`
- `BATCH_CODE_NOT_FOUND_FOR_SKU`
- `BATCH_NOT_BELONG_TO_PRODUCT`
- `INSUFFICIENT_STOCK`
- `VALIDATION_ERROR`

## 10) Ghi chú triển khai contract
- Không nhận timestamp từ client.
- Không có bất kỳ trường giá nhập/giá bán/doanh thu.
- Không có trường hình ảnh sản phẩm.
- Endpoint deactivate/activate là chuẩn soft delete cho `categories`, `products`, `warranty_batches`.
- Deactivate category không cascade deactivate products.
- Public search và admin product list mặc định chỉ ẩn product inactive.
- Fuzzy search công khai hỗ trợ SKU/tên/category/batch code theo partial text.
- Mọi thao tác stock-in/stock-out phải chạy trong transaction DB để đảm bảo tính nhất quán dữ liệu.
