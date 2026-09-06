import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getModernA5VoucherRows,
  LEGACY_SYSTEM_PRINT_TEMPLATE,
  MODERN_A5_NOTICE_LINES,
  MODERN_A5_PREVIEW_TEMPLATE,
  MODERN_A5_SHOP_INFO,
  resolveVoucherPrintPreviewTemplate
} from "./voucherPrintPreview.js";

test("no template parameter selects Modern A5 by default", () => {
  assert.equal(resolveVoucherPrintPreviewTemplate(""), MODERN_A5_PREVIEW_TEMPLATE);
  assert.equal(resolveVoucherPrintPreviewTemplate("?foo=1"), MODERN_A5_PREVIEW_TEMPLATE);
});

test("the existing Modern A5 preview parameter remains compatible", () => {
  assert.equal(
    resolveVoucherPrintPreviewTemplate("?template=modern_a5_preview"),
    MODERN_A5_PREVIEW_TEMPLATE
  );
  assert.equal(
    resolveVoucherPrintPreviewTemplate("?foo=1&template=modern_a5_preview"),
    MODERN_A5_PREVIEW_TEMPLATE
  );
});

test("only the explicit System parameter selects the legacy renderer", () => {
  assert.equal(
    resolveVoucherPrintPreviewTemplate("?template=system"),
    LEGACY_SYSTEM_PRINT_TEMPLATE
  );
});

test("invalid or unsupported template values use the Modern default", () => {
  for (const search of [
    "?template=modern_clone",
    "?template=modern_clone_preview",
    "?template=unknown",
    null
  ]) {
    assert.equal(resolveVoucherPrintPreviewTemplate(search), MODERN_A5_PREVIEW_TEMPLATE);
  }
});

test("Modern rows remain dynamic and never add filler rows", () => {
  for (const count of [1, 7, 10]) {
    const items = Array.from({ length: count }, (_, index) => ({ transaction_id: index + 1 }));
    assert.equal(getModernA5VoucherRows({ items }), items);
    assert.equal(getModernA5VoucherRows({ items }).length, count);
  }
  assert.deepEqual(getModernA5VoucherRows({}), []);
});

test("Modern keeps the exact approved header and five notice lines", () => {
  assert.deepEqual(MODERN_A5_SHOP_INFO, {
    businessType: "HỘ KINH DOANH",
    name: "VI TÍNH PHƯỚC TÀI",
    taxId: "038188039542",
    address: "98/14 đường số 5, phường Gò Vấp, TP. Hồ Chí Minh",
    phone: "0933.712.571",
    email: "sallynguyen001@gmail.com"
  });
  assert.deepEqual([...MODERN_A5_NOTICE_LINES], [
    "Quý khách vui lòng kiểm tra hàng hóa và thông tin trên phiếu trước khi ký nhận.",
    "Hàng đã mua không trả lại, trừ trường hợp được cửa hàng chấp thuận.",
    "Sản phẩm bảo hành theo điều kiện của nhà sản xuất hoặc nhà phân phối.",
    "Không bảo hành các trường hợp rách tem, cháy nổ, vào nước, móp méo, lỗi vật lý hoặc sử dụng sai quy định.",
    "Sản phẩm bán ra có thể kèm tem và số serial để phục vụ đối chiếu."
  ]);
});

test("Modern reuses System print primitives without changing the legacy branch", async () => {
  const pageSource = await readFile(new URL("../pages/TransactionVoucherPrintPage.jsx", import.meta.url), "utf8");
  const systemCss = await readFile(new URL("../pages/TransactionVoucherPrintPage.css", import.meta.url), "utf8");
  const modernSource = await readFile(new URL("../components/print/ModernA5VoucherPrint.jsx", import.meta.url), "utf8");
  const modernCss = await readFile(new URL("../components/print/ModernA5VoucherPrint.css", import.meta.url), "utf8");

  assert.match(pageSource, /return <ModernA5VoucherPrint voucher=\{voucher\} voucherId=\{voucherId\} \/>/);
  assert.equal((pageSource.match(/className="voucher-print-page /g) || []).length, 1);
  assert.equal((pageSource.match(/className="voucher-print-table"/g) || []).length, 1);
  assert.equal((pageSource.match(/className="voucher-print-notice"/g) || []).length, 1);

  for (const className of [
    "voucher-print-screen",
    "voucher-print-page",
    "voucher-print-header",
    "voucher-print-title",
    "voucher-print-customer",
    "voucher-print-table-wrap",
    "voucher-print-table",
    "voucher-print-summary-row",
    "voucher-print-summary-box",
    "voucher-print-summary-grid",
    "voucher-print-signatures",
    "voucher-print-notice"
  ]) {
    assert.match(modernSource, new RegExp(className));
  }

  assert.match(modernSource, /\/print-assets\/hkd-payment-qr\.png/);
  assert.match(modernSource, /const WEBSITE_QR_URL = "\/print-assets\/website-qr\.png";/);
  assert.match(modernSource, /const WEBSITE_QR_PAYLOAD = "https:\/\/vitinhphuoctai\.com";/);
  assert.match(modernSource, /data-qr-payload=\{WEBSITE_QR_PAYLOAD\}/);
  assert.match(modernSource, /className="modern-a5-website-qr"/);
  assert.match(modernSource, /items\.map\(\(item, index\)/);
  assert.match(modernSource, /item\?\.sale_note/);
  assert.doesNotMatch(modernSource, /Bằng chữ|amountToVietnameseWords|filler|blankRows/);
  assert.match(modernCss, /\.modern-a5-page \.voucher-print-product-name \{[^}]*font-size: 13px;[^}]*font-weight: 700;[^}]*line-height: 1\.35;/);
  assert.match(modernCss, /\.modern-a5-page \.voucher-print-sale-note \{[^}]*font-size: 11\.5px;[^}]*font-weight: 500;[^}]*line-height: 1\.15;/);
  assert.match(modernCss, /\.modern-a5-page td\.voucher-print-qty-col,[^{]*\{[^}]*font-size: 12\.5px;[^}]*font-weight: 500;[^}]*line-height: 1\.4;/);
  assert.match(modernCss, /\.voucher-print-notice\.modern-a5-notice \{[^}]*font-size: 11\.5px;[^}]*line-height: 1\.32;/);
  assert.match(modernSource, /className="voucher-print-signatures"/);
  assert.equal((modernSource.match(/className="modern-a5-signature-content"/g) || []).length, 2);
  assert.match(modernCss, /\.modern-a5-page \.voucher-print-signatures > div \{[^}]*min-height: 22mm;/);
  assert.match(modernCss, /\.voucher-print-signatures \.modern-a5-signature-content \{[^}]*min-height: 0;/);
  assert.doesNotMatch(modernCss, /\.modern-a5-signature-content[^}]*transform|translateY/);
  assert.match(modernCss, /\.modern-a5-signature-content p \{[^}]*font-size: 13px;[^}]*font-weight: 700;[^}]*line-height: 1\.35;/);
  assert.match(modernCss, /\.modern-a5-signature-content span \{[^}]*font-size: 10\.5px;[^}]*font-weight: 400;[^}]*line-height: 1\.4;/);
  assert.doesNotMatch(modernCss, /\.voucher-print-signatures\s*\{/);
  assert.match(modernCss, /\.modern-a5-footer \{[^}]*margin-top: 2mm;/);
  assert.match(modernCss, /\.voucher-print-header\.modern-a5-header \{[^}]*grid-template-columns: 26mm minmax\(0, 1fr\) 18mm 46mm;[^}]*gap: 2mm;/);
  assert.match(modernCss, /\.modern-a5-business-type \{[^}]*font-size: 12\.5px;[^}]*font-weight: 700;[^}]*line-height: 1\.05;/);
  assert.match(modernCss, /\.modern-a5-header-line \{[^}]*font-size: 10\.75px;[^}]*font-weight: 600;[^}]*line-height: 1\.07;/);
  assert.match(modernCss, /\.modern-a5-website-qr \{[^}]*width: 18mm;[^}]*height: 18mm;/);
  assert.match(modernCss, /\.modern-a5-website-qr img \{[^}]*width: 18mm;[^}]*height: 18mm;[^}]*object-fit: contain;/);
  assert.doesNotMatch(modernCss, /\.voucher-print-signatures\.modern|modern-a5-signatures|\.modern-a5-signature-content\s*\{[^}]*(?:margin|padding|position):/);
  assert.match(systemCss, /\.voucher-print-page \{[^}]*font-size: 12px;[^}]*font-weight: 400;[^}]*line-height: 1\.45;/);
  assert.match(systemCss, /\.voucher-print-shop \{[^}]*font-size: 12px;[^}]*line-height: 1\.5;/);
  assert.match(systemCss, /\.voucher-print-signatures \{[^}]*margin-top: 3mm;/);
  assert.match(systemCss, /\.voucher-print-signatures div \{[^}]*min-height: 14mm;/);
  assert.match(systemCss, /\.voucher-print-signatures p \{[^}]*font-weight: 600;/);
  assert.match(systemCss, /\.voucher-print-signatures span \{[^}]*font-size: 10px;[^}]*font-style: italic;/);
  assert.doesNotMatch(modernCss, /@page|transform:\s*scale|position:\s*(?:absolute|fixed)|margin-top:\s*-/);
  assert.doesNotMatch(pageSource, /hkd-payment-qr|website-qr|vitinhphuoctai\.com|HỘ KINH DOANH|Bằng chữ|@page/);
});

test("Modern print assets keep website and payment QR purposes separate", async () => {
  const websiteQr = await readFile(
    new URL("../../public/print-assets/website-qr.png", import.meta.url)
  );
  const paymentQr = await readFile(
    new URL("../../public/print-assets/hkd-payment-qr.png", import.meta.url)
  );
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  assert.deepEqual(websiteQr.subarray(0, 8), pngSignature);
  assert.equal(websiteQr.readUInt32BE(16), 360);
  assert.equal(websiteQr.readUInt32BE(20), 360);
  assert.notDeepEqual(websiteQr, paymentQr);
});
