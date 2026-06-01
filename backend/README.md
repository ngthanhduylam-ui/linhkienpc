# Backend Foundation - LINHKIENPC

## Cài đặt
1. Sao chép `backend/.env.example` thành `backend/.env` và điền thông tin MySQL/JWT.
2. Cài dependency:
   - `npm install`

## Database setup
1. Tạo database MySQL trước: `linhkienpc`.
2. Chạy migration:
   - `npm run migrate`
3. Chạy seed mặc định:
   - `npm run seed`

## Khởi động server
- Chế độ dev: `npm run dev`
- Chế độ chạy thường: `npm start`

## Ghi chú
- Đây là foundation Phase 1: chưa có endpoint CRUD nghiệp vụ.
- Health check hiện tại: `GET /api/v1/health`
