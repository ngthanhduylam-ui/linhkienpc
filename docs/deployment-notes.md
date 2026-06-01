# Ghi chú triển khai & portability - LINHKIENPC

## 1) Mục tiêu portability
Dự án có thể chuyển sang máy khác bằng cấu hình `.env` và tài liệu setup.

## 2) Biến môi trường đề xuất
### Backend
- `NODE_ENV`
- `PORT`
- `APP_TIMEZONE` (vd: `Asia/Ho_Chi_Minh`)
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `JWT_SECRET` hoặc `SESSION_SECRET`
- `JWT_EXPIRES_IN` (nếu dùng JWT)

### Frontend
- `VITE_API_BASE_URL` (vd: `http://localhost:3000/api/v1`)

## 3) Triển khai môi trường
- Dev: React + Express + MySQL local.
- Prod: frontend build tĩnh, backend service, MySQL tách riêng.

## 4) Backup/restore
- Lưu backup SQL tại thư mục `backups/`.
- Định kỳ backup theo lịch vận hành nội bộ.
- Kiểm tra restore định kỳ để đảm bảo backup dùng được.

## 5) Bảo mật cơ bản
- Hash mật khẩu admin (bcrypt/argon2).
- Không commit file `.env`.
- Bật CORS có kiểm soát origin.
- Giới hạn rate login để giảm brute force.

## 6) Logging & audit
- Ghi log login admin, thao tác nhập/xuất kho.
- Lưu lịch sử giao dịch kho phục vụ truy vết.
- Timestamp lấy từ server.

## 7) Checklist trước khi viết code
- Chốt schema DB và ràng buộc khóa ngoại.
- Chốt contract API request/response.
- Chốt chiến lược auth (JWT hay session).
- Chốt quy tắc soft delete và hiển thị dữ liệu đã ẩn.
