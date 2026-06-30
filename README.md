# VI TÍNH PHƯỚC TÀI POS

Cập nhật gần nhất: **23/06/2026**

Ứng dụng POS tự host cho cửa hàng linh kiện PC **VI TÍNH PHƯỚC TÀI**.

Định hướng:

- POS First
- Offline First theo nghĩa ưu tiên vận hành tại cửa hàng và hạ tầng tự quản
- Self-Hosted
- Sapo-inspired workflow
- Stability First
- Inventory supports sales
- Not an ERP

Hệ thống đang chạy thử production tại cửa hàng. Chức năng hiện có gồm quản lý sản phẩm, khách hàng, nhà cung cấp, nhập hàng, bán tại quầy, kiểm hàng, tra cứu tồn công khai, lịch sử phiếu, snapshot giá bán, Serial/Ghi chú theo dòng và in phiếu bán A4.

Chưa có giá nhập, chiết khấu, thanh toán, công nợ, hóa đơn hoặc báo cáo tài chính.

## Trạng thái production

```text
Domain:           https://vitinhphuoctai.duckdns.org
Server:           Ubuntu self-hosted
Repo:             /opt/linhkienpc/linhkienpc
Branch:           codex-dev
Frontend:         Nginx
Backend:          PM2 process linhkienpc-api
Backend bind:     127.0.0.1:3000
Database:         MySQL localhost
Product uploads:  /opt/linhkienpc/uploads/products
```

Hạ tầng đã có HTTPS/Certbot, UFW, DuckDNS cron và backup MySQL lúc 23:00 hằng ngày, giữ 14 ngày. Backup ảnh tự động sang HDD riêng chưa được triển khai.

## Chức năng chính

- Public Lookup `/`: tìm nhiều token theo tên, SKU hoặc ghi chú bảo hành; chỉ hiển thị sản phẩm active có tổng tồn lớn hơn 0; không trả giá hoặc dữ liệu nội bộ.
- Product Admin `/admin/products`: list/search/filter/pagination, giá bán mặc định nullable, ảnh sản phẩm tối đa 5 ảnh.
- Nhập hàng `/admin/stock-in`: bulk stock-in, supplier optional, nhóm bảo hành/ghi chú, không có giá nhập.
- Bán tại quầy `/admin/stock-out`: full-screen POS, nhiều đơn local, server-side product search, recent products, khách hàng, giá chỉ đọc, Serial/Ghi chú theo dòng.
- Kiểm hàng `/admin/inventory-check`: chuyển nhóm ghi chú và tăng/giảm tồn theo nhóm có lịch sử.
- Lịch sử phiếu `/admin/transaction-history`: list/detail phiếu nhập và phiếu bán.
- In phiếu bán `/admin/transaction-history/:voucherId/print`: HTML/A4, dùng `window.print()`, không lưu PDF.

## Kiến trúc

```text
Browser
  -> Nginx (HTTPS, frontend/dist, reverse proxy /api/v1)
  -> Express API under PM2 (127.0.0.1:3000)
  -> MySQL localhost
```

Stack:

- Frontend: React 18, Vite, React Router, TailwindCSS
- Backend: Node.js 18+, Express, MySQL, JWT, bcrypt
- Storage ảnh: filesystem; MySQL chỉ lưu metadata
- Database changes: migration runner trong `backend/scripts/migrate.js`

## Chạy local

Yêu cầu: Git, Node.js 18+ và MySQL.

```powershell
git clone -b codex-dev https://github.com/ngthanhduylam-ui/linhkienpc.git
cd linhkienpc

cd backend
npm install
Copy-Item .env.example .env
npm run db:setup
npm run dev
```

Terminal khác:

```powershell
cd frontend
npm install
npm run dev
```

Frontend production dùng:

```env
VITE_API_BASE_URL=/api/v1
```

Backend production dùng `HOST=127.0.0.1`. Không commit `.env`, mật khẩu, token hoặc backup dữ liệu thật.

## Quy tắc quan trọng

- SKU unique; chỉ dùng chữ thường, số và dấu chấm.
- Tồn chỉ thay đổi qua stock-in, stock-out hoặc inventory-check.
- `product_inventory_balances` là tổng tồn hiện tại.
- Nhóm bảo hành/tình trạng chỉ quản lý tồn, không phải bảng giá.
- Backend là nguồn snapshot tiền khi bán; POS hiện không gửi field tiền.
- Public Lookup không trả `sale_price`, snapshot tiền hoặc `sale_note`.
- Stock voucher là phiếu nghiệp vụ, không phải hóa đơn thanh toán.
- Không tự mở rộng thành ERP.

## Tài liệu

- [Chat Handoff](CHAT_HANDOFF.md)
- [Project Rules](PROJECT_RULES.md)
- [Project Direction](docs/PROJECT_DIRECTION.md)
- [Project Status](docs/PROJECT_STATUS.md)
- [Business Rules](docs/BUSINESS_RULES.md)
- [Architecture](docs/ARCHITECTURE.md)
- [API](docs/api.md)
- [Database](docs/database.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Folder Structure](docs/FOLDER_STRUCTURE.md)
- [POS Screen Guide](docs/POS_SCREEN_GUIDE.md)
- [POS Changelog](docs/CHANGELOG_POS.md)
