export const LEGACY_SYSTEM_PRINT_TEMPLATE = "system";
export const MODERN_A5_PREVIEW_TEMPLATE = "modern_a5_preview";

export const MODERN_A5_SHOP_INFO = Object.freeze({
  businessType: "HỘ KINH DOANH",
  name: "VI TÍNH PHƯỚC TÀI",
  taxId: "038188039542",
  address: "98/14 đường số 5, phường Gò Vấp, TP. Hồ Chí Minh",
  phone: "0933.712.571",
  email: "sallynguyen001@gmail.com"
});

export const MODERN_A5_NOTICE_LINES = Object.freeze([
  "Quý khách vui lòng kiểm tra hàng hóa và thông tin trên phiếu trước khi ký nhận.",
  "Hàng đã mua không trả lại, trừ trường hợp được cửa hàng chấp thuận.",
  "Sản phẩm bảo hành theo điều kiện của nhà sản xuất hoặc nhà phân phối.",
  "Không bảo hành các trường hợp rách tem, cháy nổ, vào nước, móp méo, lỗi vật lý hoặc sử dụng sai quy định.",
  "Sản phẩm bán ra có thể kèm tem và số serial để phục vụ đối chiếu."
]);

export function resolveVoucherPrintPreviewTemplate(search = "") {
  try {
    const params = search instanceof URLSearchParams
      ? search
      : new URLSearchParams(typeof search === "string" ? search : "");

    return params.get("template") === LEGACY_SYSTEM_PRINT_TEMPLATE
      ? LEGACY_SYSTEM_PRINT_TEMPLATE
      : MODERN_A5_PREVIEW_TEMPLATE;
  } catch {
    return MODERN_A5_PREVIEW_TEMPLATE;
  }
}

export function getModernA5VoucherRows(voucher) {
  return Array.isArray(voucher?.items) ? voucher.items : [];
}
