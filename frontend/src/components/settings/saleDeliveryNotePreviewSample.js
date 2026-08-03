export const SALE_DELIVERY_NOTE_PREVIEW_SAMPLE = Object.freeze({
  voucherCode: "OUT-000114",
  date: "03/08/2026",
  time: "12:11",
  customer: Object.freeze({
    name: "Khách lẻ",
    phone: "0901 234 567",
    address: "125 Nguyễn Oanh, Phường 17, Gò Vấp, TP.HCM",
    note: "Giao hàng trong giờ hành chính"
  }),
  items: Object.freeze([
    Object.freeze({
      name: "Mainboard MSI PRO B760M-A WIFI DDR4 2nd",
      saleNote: "Bảo hành 3 tháng, đủ anten Wi-Fi",
      quantity: 1,
      unitPrice: 2350000,
      discount: 100000,
      lineTotal: 2250000
    }),
    Object.freeze({
      name: "CPU Intel Core i5-12400F Box chính hãng",
      saleNote: "Bảo hành 36 tháng",
      quantity: 1,
      unitPrice: 2850000,
      discount: 0,
      lineTotal: 2850000
    }),
    Object.freeze({
      name: "RAM Kingston Fury Beast 16GB DDR4 3200MHz",
      saleNote: "2 thanh 8GB",
      quantity: 2,
      unitPrice: 650000,
      discount: 50000,
      lineTotal: 1200000
    })
  ]),
  grossTotal: 6500000,
  discountTotal: 200000,
  grandTotal: 6300000
});
