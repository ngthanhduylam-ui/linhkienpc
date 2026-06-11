# POS_SCREEN_GUIDE.md

# M?c ti?u m?n POS

M?n POS ch?nh l?:

/admin/stock-out

T?n nghi?p v? hi?n th?:

B?n t?i qu?y

M?c ti?u: ng??i b?n t?i qu?y c? th? t?m s?n ph?m, ch?n nh?m b?o h?nh, th?m v?o ??n v? x?c nh?n b?n nhanh nh?t c? th?.

M?n n?y kh?ng ???c t?o c?m gi?c ?ang l?m phi?u kho ho?c form ERP.

# Layout hi?n t?i

POS d?ng full-screen layout ri?ng.

Kh?ng d?ng:

- AdminSidebar
- AdminHeader
- AdminLayout padding/max-width

B? c?c ch?nh:

- Top POS bar
- Main cart/product area b?n tr?i
- Summary/customer panel b?n ph?i

# Top POS Bar

Top bar g?m:

1. Home button
   - D?ng icon only
   - Link t?i /admin
   - Lu?n hi?n th?

2. Product search
   - Placeholder hi?n t?i: Th?m s?n ph?m v?o ??n
   - Kh?ng c? F3/F10/shortcut hint
   - L? ?i?m focus ch?nh c?a m?n POS

3. Order tab visual
   - ??n 1

4. Plus button visual
   - N?t + hi?n ch? visual ?? chu?n b? multi-order trong t??ng lai

Kh?ng hi?n th? chi nh?nh/store info ? header v? workflow l? single-store offline.

# Search Behavior

Lu?ng b?t bu?c:

1. User focus/click product search.
2. N?u input r?ng, hi?n th? recent products.
3. User g? t?n s?n ph?m, SKU ho?c category.
4. Hi?n th? matching products.
5. User ch?n warranty group v? quantity.
6. User click Th?m.
7. Product ???c th?m v?o cart.
8. Search input clear.
9. Debounced search clear.
10. Dropdown ??ng ho?n to?n.
11. Search input focus l?i.
12. Dropdown v?n ??ng sau khi focus l?i.

Dropdown ch? m? l?i khi:

- user ch? ??ng click/focus search input
- ho?c user b?t ??u g?

Kh?ng t? ??ng m? recent products ngay sau khi add.

# Dropdown Behavior

Dropdown ph?i l? POS autocomplete, kh?ng ph?i admin form.

Y?u c?u:

- Floating, kh?ng ??y layout
- Compact
- Max height kho?ng 50-55vh
- Width kho?ng 520-600px t?y m?n
- Product row th?p
- ?t padding
- Nhi?u s?n ph?m visible tr??c khi scroll

M?i product row n?n hi?n th?:

- Product name
- SKU nh?/muted
- Category n?u c?n g?n
- Available quantity / T?n ? b?n ph?i

Warranty groups trong dropdown:

- Hi?n d??i product row
- Nh?, g?n
- Quantity stepper compact
- Button Th?m compact

Hi?n t?i flow l?:

Product
? warranty group
? quantity
? Th?m

T??ng lai c? th? ??i th?nh:

Product
? Add Product
? warranty group/quantity ch?nh trong cart

V? v?y code kh?ng n?n l?m workflow hi?n t?i qu? c?ng ho?c kh? t?ch.

# Click Outside / Escape

Dropdown ph?i ??ng khi:

- click v?ng tr?ng ngo?i dropdown/search
- click right customer panel
- click textarea/note
- press Escape

Dropdown ph?i gi? m? khi:

- click search input
- click trong dropdown
- click +/- quantity trong dropdown

Click Th?m trong dropdown:

- add product
- clear search
- close dropdown
- focus search input
- kh?ng reopen dropdown

Implementation hi?n t?i d?ng m?t container ref b?c c? search v? dropdown ?? click-outside ??n gi?n h?n.

# Cart Behavior

Cart l? order table/list, kh?ng ph?i card.

C?t ch?nh:

- STT
- remove button
- product name
- SKU nh? d??i product name
- warranty note
- quantity

Y?u c?u visual:

- Row compact
- ?t padding
- Product name d? ??c nh?t
- SKU muted
- Warranty note ng?n g?n
- Quantity r?
- Hover subtle

Remove product:

- X?a ri?ng t?ng d?ng kh?i cart

Clear all:

- N?u cart c? s?n ph?m, ph?i h?i confirm tr??c
- N?i dung confirm hi?n t?i n?i r?ng h? th?ng kh?ng l?u l?i ??n b?n n?y

Empty state:

??

??n h?ng c?a b?n ch?a c? s?n ph?m n?o

T?m s?n ph?m ?? b?t ??u b?n h?ng

[Th?m s?n ph?m ngay]

Kh?ng d?ng admin-style cards.

# Customer Workflow

Customer ? right panel.

Hi?n t?i:

- Customer optional
- C? CustomerSelector
- C? recent customers b?ng localStorage
- Ch?n customer g?n v?o bulk stock-out payload b?ng customer_id

Y?u c?u UX:

- Customer selector ph?i nhanh, g?n Sapo
- Khi ch?a nh?p keyword, hi?n recent customers
- Inactive customers kh?ng ???c hi?n
- C? th? t?o customer inline n?u c?n

Phase B s? refactor s?u h?n:

- ??a ch? t?ch Province/City, District, Ward, detailed address
- auto-fill ??a ch? khi ch?n customer
- chu?n b? cho delivery/debt/warranty tracking

# Right Summary Panel

Th? t? target:

1. Customer selector
2. Delivery/Giao nh?n placeholder
3. Separator
4. Total product lines
5. Total quantity
6. Separator
7. Selected customer display
8. Note
9. Error/success message
10. Sticky confirm sale button

Kh?ng th?m:

- price
- payment
- invoice
- discount
- tax/VAT
- debt fields

Button ch?nh hi?n t?i:

X?c nh?n b?n

N?t ph?i d? th?y, sticky ? ??y panel n?u c? th?.

# Confirm Sale

Confirm sale gi? logic hi?n t?i:

- frontend g?i bulkStockOutRequest
- backend x? l? stock-out/bulk
- inventory validation gi? nguy?n
- voucher creation gi? nguy?n
- n?u thi?u t?n ho?c thi?u warranty group quantity th? backend t? ch?i

Kh?ng ??i API ch? v? UI ??i t? stock-out sang POS.

# Warranty Workflow hi?n t?i

Hi?n t?i warranty group ???c ch?n tr??c khi th?m v?o cart.

Ngu?n warranty group:

- stock transaction notes
- inventory note adjustments
- inventory quantity adjustments
- no-note group n?u c? t?n kh?ng ghi ch?

Quy t?c:

- Kh?ng d?ng warranty_batches UI
- Kh?ng t?o batch workflow th?t
- Kh?ng b?t user nh?p fake note cho no-note group
- __NO_NOTE__ d?ng cho backend khi c?n bi?u di?n nh?m kh?ng ghi ch?

# Future Warranty Workflow

T??ng lai c? th? ??i sang:

Search Product
? Add Product
? Trong cart ch?n Warranty Group
? Trong cart ch?nh Quantity

L? do: g?n POS h?n, search dropdown nh? h?n, cart l? n?i x? l? chi ti?t d?ng h?ng.

Ch?a implement trong Phase A.2.

# Future Multi-Order Workflow

N?t + v? ??n 1 hi?n l? visual.

T??ng lai c? th? h? tr?:

- nhi?u ??n ?ang m?
- ??n 1, ??n 2, ...
- ??ng ??n v?i confirm n?u c? s?n ph?m
- l?u draft local/session
- chuy?n qua l?i gi?a ??n

Ch?a implement trong Phase A.2.

# Forbidden in POS Phase A

Kh?ng th?m:

- pricing
- discounts
- payments
- invoices
- VAT/tax
- loyalty
- marketplace
- Sapo keyboard shortcuts
- ERP workflows
- warehouse-first wording

# POS Wording

N?n d?ng:

- B?n t?i qu?y
- ??n b?n
- s?n ph?m trong ??n
- x?c nh?n b?n
- kh?ch h?ng
- ghi ch? ??n h?ng

Tr?nh d?ng l?m primary UI:

- xu?t kho
- phi?u xu?t
- giao h?ng nh? concept ch?nh
- warehouse/inventory-first wording

T?n h?m/API/backend c? th? v?n l? stock-out v? backend ch?a refactor sales domain.

# Manual Regression Checklist

Sau m?i l?n s?a POS, test:

1. M? /admin/stock-out.
2. Admin sidebar/header b? ?n.
3. Home button v? /admin.
4. Focus search input hi?n th? recent products.
5. Typing filter products.
6. Click outside ??ng dropdown.
7. Escape ??ng dropdown.
8. Click +/- trong dropdown kh?ng ??ng dropdown.
9. Click Th?m add product.
10. Sau add, search input clear.
11. Sau add, dropdown ??ng.
12. Sau add, focus quay l?i search input.
13. Dropdown kh?ng t? m? l?i sau add.
14. Typing ti?p m? dropdown l?i.
15. Cart row hi?n th? product name, SKU, warranty, quantity.
16. Remove product ho?t ??ng.
17. Clear all h?i confirmation.
18. Customer selection ho?t ??ng.
19. Note nh?p ???c.
20. Confirm sale t?o stock-out voucher.
21. Inventory validation v?n ho?t ??ng.
22. Public Lookup kh?ng b? ?nh h??ng.
