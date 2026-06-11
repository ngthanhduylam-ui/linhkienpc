# PROJECT_DIRECTION.md

# Project Identity

VI T?NH PH??C T?I POS

- POS First
- Offline First
- Self Hosted
- Sapo Inspired

D? ?n n?y l? h? th?ng POS offline t? host cho c?a h?ng m?y t?nh, linh ki?n v? s?a ch?a VI T?NH PH??C T?I.

# Core Philosophy

Th? t? ?u ti?n s?n ph?m:

1. Counter Sales
2. Customer Management
3. Warranty Tracking
4. Debt Tracking
5. Inventory Support
6. Reporting

Inventory exists to support sales.

Sales workflow always has higher priority than warehouse workflow.

M?i m?n h?nh m?i ph?i t? h?i tr??c: n?u ??y l? Sapo POS, h? s? l?m th? n?o ?? b?n t?i qu?y nhanh h?n?

# Non Goals

Kh?ng thi?t k? nh?:

- ERP
- Warehouse First
- Enterprise Inventory Software
- H? th?ng kho ph?c t?p nhi?u b??c
- H? th?ng k? to?n ??y ??
- Website th??ng m?i ?i?n t?

Kh?ng ?u ti?n bi?u m?u kho d?i, quy tr?nh ERP, hay thao t?c qu?n tr? n?ng.

# Public Lookup

Public Lookup ph?i lu?n ???c gi? l?i.

Kh?ng y?u c?u ??ng nh?p.

Public Lookup h? tr?:

- Product search
- SKU search
- Inventory quantity
- Warranty groups

V? d? public lookup c?n ti?p t?c hi?n th? ???c:

- Intel Core i5 12400F
- BH 12.28: 2
- BH 09.28: 1
- Kh?ng ghi ch?: 1
- T?ng t?n: 4

Ki?n tr?c c? ? c?a d? ?n l?:

POS Offline
+
Public Lookup

Public Lookup l? ?i?m m?nh c?a d? ?n, kh?ng ???c lo?i b? khi refactor sang POS.

# UI Philosophy

Inspired by Sapo POS.

Copy t? Sapo:

- workflow
- density
- layout hierarchy
- search behavior
- dropdown behavior
- user flow
- t?c ?? thao t?c
- c?ch gi?m s? click

Kh?ng copy t? Sapo:

- branding
- pricing workflows ? giai ?o?n hi?n t?i
- loyalty
- marketplace integrations
- e-commerce integrations
- multi-channel complexity
- keyboard shortcut branding nh? F1/F3/F6/F8/F10

UI n?n g?n, d?y th?ng tin, nhanh, ?t card l?n, ?t kho?ng tr?ng, ?t hi?u ?ng n?ng.

# Current Main Screen

/admin/stock-out

? ngh?a hi?n t?i:

B?n t?i qu?y

Kh?ng g?i l?:

Xu?t kho

M?n n?y l? POS screen ch?nh, kh?ng ph?i trang kho.

# Mandatory Search Workflow

Lu?ng t?m v? th?m s?n ph?m b?t bu?c:

Focus search
? recent products
? search products
? select warranty group
? add product
? clear search
? close dropdown
? focus search again

Sau khi th?m s?n ph?m, dropdown kh?ng ???c t? m? l?i recent products. Recent products ch? hi?n khi ng??i d?ng ch? ??ng focus/click v?o search ho?c b?t ??u g?.

# Things Currently Forbidden

Hi?n t?i kh?ng ???c th?m:

- pricing
- payment
- invoices
- discounts
- ERP workflows
- Sapo keyboard shortcuts
- forcing login for public lookup
- e-commerce cart/checkout/customer account public
- revenue/profit/accounting screens n?u ch?a ???c duy?t

Kh?ng ??i backend/API ch? ?? ??i wording POS.

# Official Roadmap

## Phase A

POS Refactor

M?c ti?u: bi?n /admin/stock-out th?nh m?n B?n t?i qu?y th?t s?, full-screen, nhanh, gi?ng workflow Sapo POS.

## Phase B

Customer Refactor

M?c ti?u: qu?n l? kh?ch h?ng t?t h?n, chu?n b? ??a ch? giao nh?n, c?ng n? v? l?ch s? mua/b?o h?nh.

## Phase C

Supplier & Purchasing

M?c ti?u: nh? cung c?p, nh?p h?ng, phi?u mua, gi? nh?p v? c?ng n? nh? cung c?p trong t??ng lai.

## Phase D

Financial

M?c ti?u: c?ng n?, s? qu?, thu chi. Kh?ng l?m qu? s?m khi POS ch?a ?n.

## Phase E

Analytics

M?c ti?u: b?o c?o doanh thu, l?i nhu?n, t?n kho, export. ??y l? giai ?o?n sau, kh?ng chen v?o workflow POS hi?n t?i.
