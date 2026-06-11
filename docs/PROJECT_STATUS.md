# PROJECT_STATUS.md

# Technology

## Frontend

- React 18
- Vite
- React Router
- TailwindCSS
- API client c? refresh token flow
- LocalStorage d?ng cho token v? recent items

## Backend

- Node.js
- Express
- MySQL
- JWT Authentication
- Refresh token table
- bcrypt
- dotenv
- cors
- helmet
- morgan

## Database

- MySQL
- Migration scripts trong database/migrations
- Schema SQL trong database/schema
- D? li?u admin seed b?ng backend/scripts/seed.js

## Deployment

- Self-hosted offline/local-first
- C?u h?nh b?ng .env
- Frontend Vite, backend Express, database MySQL
- Public lookup v?n ch?y kh?ng c?n ??ng nh?p

# Completed Modules

## Products

?? c? qu?n l? s?n ph?m:

- danh s?ch s?n ph?m
- t?m ki?m
- ph?n trang
- t?o s?n ph?m
- s?a s?n ph?m
- soft delete / ng?ng s? d?ng
- kh?i ph?c
- l?c tr?ng th?i
- SKU th? c?ng, c? h? tr? g?i ? ? m?t s? flow tr??c ??

## Customers

?? c? kh?ch h?ng:

- danh s?ch kh?ch h?ng
- t?o kh?ch h?ng
- s?a kh?ch h?ng
- soft delete / ng?ng giao d?ch
- kh?i ph?c
- l?c tr?ng th?i
- selector trong POS/stock-out
- recent customers b?ng localStorage
- kh?ch h?ng g?n ???c v?o stock transaction/voucher

## Suppliers

?? c? nh? cung c?p:

- danh s?ch nh? cung c?p
- t?o nh? cung c?p
- s?a nh? cung c?p
- soft delete / ng?ng h?p t?c
- kh?i ph?c
- l?c tr?ng th?i
- selector trong stock-in
- recent suppliers b?ng localStorage

## Stock In

?? c? nh?p h?ng nhi?u s?n ph?m:

- /admin/stock-in d?ng StockInBulkPage
- ch?n nh? cung c?p m?t l?n
- th?m nhi?u s?n ph?m
- m?i d?ng c? quantity v? note b?o h?nh/ghi ch? nh?p
- submit bulk t?o nhi?u stock_transactions trong m?t l?n
- backend c? POST /admin/stock-in/bulk

## Stock Out / POS

/admin/stock-out hi?n l? m?n POS ch?nh, d?ng StockOutBulkPage.

- full-screen POS layout
- ?n admin sidebar/header
- top POS bar
- Home button v? /admin
- product search
- recent products
- compact product dropdown
- warranty group selection
- add to cart
- cart table/list
- customer selector
- note
- total quantity
- confirm sale button
- backend v?n d?ng bulk stock-out v? voucher creation

## Stock Voucher

?? c? stock voucher backend:

- stock_vouchers table
- voucher_id trong stock_transactions
- bulk stock-in/out t?o voucher
- GET /admin/stock-vouchers
- GET /admin/stock-vouchers/:id
- TransactionHistoryPage hi?n th? voucher-first

## Inventory Check

?? c? Inventory Check:

- search/select product
- xem total quantity
- xem warranty/note groups
- ?i?u ch?nh s? l??ng t?ng/gi?m
- quantity adjustments table
- note group calculation ?? t?nh stock_transactions, note adjustments v? quantity adjustments
- Inventory Check hi?n t?p trung v?o ch?nh s? l??ng th?c t?, kh?ng ph?i warehouse audit ph?c t?p

## Public Lookup

?? c? public lookup:

- route /
- kh?ng login
- mobile-first
- search theo product name, SKU, warranty note
- kh?ng show to?n b? products khi input r?ng
- search history localStorage
- result card c? total quantity
- warranty/note groups expandable
- single result auto-expand
- copy product name

# POS Progress

## Current POS status

Phase A ?ang ti?n h?nh.

/admin/stock-out ?? ???c chuy?n t? "Xu?t & Giao h?ng" sang "B?n t?i qu?y" theo h??ng POS.

## What already works

- Full-screen POS, kh?ng c?n AdminLayout tr?n /admin/stock-out
- Home button v? /admin
- Product search tr?n top bar
- Recent products khi focus search
- Product dropdown compact
- Warranty group ch?n tr??c khi th?m
- Add product to cart
- Sau khi add: clear search, clear debounce, close dropdown, focus search l?i
- Click outside dropdown ??ng dropdown
- Escape ??ng dropdown
- Cart d?ng table/list
- Customer selector ? right panel
- Note ? right panel
- Total quantity ? right panel
- Confirm sale g?i bulk stock-out nh? c?
- Voucher creation v?n do backend x? l?

## What still needs improvement

- Dropdown v?n c?n ti?p t?c ???c l?m gi?ng Sapo h?n: ?t nested layout, nhi?u row visible h?n
- Workflow t??ng lai n?n chuy?n d?n sang: ch?n product tr??c, warranty/quantity ch?nh trong cart
- POS ch?a c? multi-order th?t s?, n?t + hi?n ch? visual
- Ch?a c? close order tab v?i confirm ??ng ngh?a
- Ch?a c? draft order/session persistence
- Ch?a c? pricing/payment/debt/invoice theo ch? ??ch hi?n t?i
- Customer selector c?n phong c?ch admin h?n Sapo, c?n refactor ? Phase B
- Right panel ch?a c? money/payment v? ?ang b? c?m trong phase hi?n t?i

# Current Phase

Phase A: POS Refactor

??c l??ng ho?n th?nh: 60-70%

L? do: core POS full-screen v? add-to-cart ?? c?, nh?ng density/dropdown/cart/customer panel v?n c?n c?n polish th?m tr??c khi coi l? POS mature.

# Current Priorities

Top 10 task hi?n t?i:

1. Ti?p t?c polish product dropdown gi?ng Sapo POS h?n.
2. ??m b?o search ? add ? clear ? close dropdown ? focus l?i lu?n ?n ??nh.
3. L?m cart table d?y h?n, d? scan nhi?u d?ng h?n.
4. T?i ?u CustomerSelector cho POS, ?t admin-form h?n.
5. Chu?n b? workflow ch?n warranty group trong cart ? t??ng lai.
6. Th?m multi-order visual th?t s? sau khi POS core ?n ??nh.
7. Th?m confirm close order/tab n?u cart c? s?n ph?m.
8. Refactor Customer module Phase B v?i ??a ch? t?ch t?nh/huy?n/x?/??a ch? chi ti?t.
9. Gi? Public Lookup nhanh, mobile-first, kh?ng login.
10. Ch? sau khi POS ?n m?i m? pricing/payment/debt.

# Known UX Decisions

C?c quy?t ??nh UX ?? ch?t trong l?ch s? chat:

- POS First, kh?ng c?n Inventory First.
- /admin/stock-out ngh?a l? B?n t?i qu?y, kh?ng ph?i Xu?t kho.
- POS screen ?n admin sidebar v? admin header.
- POS c? Home button v? /admin.
- Kh?ng hi?n th? chi nh?nh trong POS header v? ??y l? single-store offline workflow.
- Kh?ng hi?n th? keyboard shortcut UI nh? F1/F3/F6/F8/F10.
- Product search n?m tr?n top POS bar.
- Focus search r?ng hi?n th? recent products.
- Typing search hi?n th? matching products.
- Add product xong ph?i clear input, clear debounced search, close dropdown, focus l?i input.
- Dropdown kh?ng ???c t? m? l?i ngay sau khi add.
- Recent products ch? hi?n khi user ch? ??ng click/focus search ho?c g?.
- Click outside dropdown ??ng dropdown.
- Click trong dropdown kh?ng ??ng dropdown.
- Escape ??ng dropdown.
- Warranty group v?n ph?i ch?n tr??c khi add trong hi?n t?i.
- Same SKU + same warranty group c? th? merge trong cart ?? cart s?ch.
- Cart n?n l? table/list compact, kh?ng ph?i card l?n.
- Empty state POS d?ng gi? h?ng v? text h??ng d?n b?n h?ng, kh?ng d?ng admin card.
- Right summary panel ph?i d?y, ?t whitespace, button confirm sticky bottom.
- Customer selector hi?n th? recent customers.
- Supplier selector hi?n th? recent suppliers.
- Product recent list d?ng localStorage, inactive products kh?ng ???c hi?n.
- Customer/supplier inactive kh?ng ???c hi?n trong selector/recent.
- Soft delete l? inactive, kh?ng hard delete.
- Product creation thu?c Product Management, kh?ng n?m trong POS/Inventory Workbench.
- Public Lookup kh?ng ???c y?u c?u login.
- Public Lookup kh?ng show all products khi search r?ng.
- Public Lookup c? copy product name.
- Public Lookup warranty groups d?a tr?n remaining note groups.
- Warranty batches table c? c? th? t?n t?i nh?ng UI kh?ng d?ng warranty batch workflow.
- Warranty info hi?n d?a v?o stock transaction notes v? adjustments.
- Inventory Check d?ng ?? ch?nh t?n th?c t?, kh?ng quay l?i warehouse-first mindset.
- Kh?ng th?m price/payment/debt/invoice khi ch?a ???c duy?t.

# Future Architecture Notes

- D? ?n ?ang chuy?n t? inventory management sang POS offline. T?n folder/code c? c? th? c?n stock-out/stock-transaction, nh?ng UI ph?i n?i ng?n ng? POS.
- Backend/API hi?n v?n d?ng stock-out ?? tr? t?n. Kh?ng ??i API ch? v? ??i wording UI.
- V? l?u d?i c? th? c?n sales/order/voucher abstraction ri?ng, nh?ng ch?a l?m n?u ch?a c? pricing/payment.
- Stock vouchers hi?n l? l?ch s? phi?u nh?p/b?n, kh?ng ph?i invoice.
- Warranty note groups hi?n l? display/logic group t? notes + adjustments, kh?ng ph?i batch th?t.
- N?u sau n?y th?m gi?, ph?i l?m c?n th?n ?? kh?ng ph? public lookup v? existing inventory logic.
- Customer debt/payment l? phase sau, kh?ng chen v?o POS refactor A.
- Supplier purchasing l? phase C, kh?ng ?p nh?p h?ng th?nh ERP s?m.
- N?n x?a c?c backup file t?m khi chu?n b? production.
- C?c file PROJECT_DIRECTION.md, PROJECT_STATUS.md, POS_SCREEN_GUIDE.md l? memory source cho chat Codex m?i.
