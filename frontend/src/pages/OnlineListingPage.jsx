import { useEffect, useMemo, useRef, useState } from "react";
import { resolveApiAssetUrl } from "../api/apiClient";
import { AuthenticatedImage } from "../components/AuthenticatedImage";
import {
  downloadOnlineListingProductImage,
  listOnlineListingProductImages,
  listOnlineListingProducts
} from "../services/onlineListing.service";
import {
  ONLINE_LISTING_TITLE_MAX_LENGTH,
  buildOnlineListingDescription,
  buildSuggestedOnlineListingTitle,
  getNoteGroupLabel,
  getOnlinePriceInputFromProduct,
  parseOnlinePriceInput
} from "../utils/onlineListingDraft";
import { handleMoneyInputChange } from "../utils/moneyInput";

const PRODUCT_PAGE_SIZE = 20;
const POS_DRAFT_SOURCE = "vitinh-phuoc-tai-pos";
const TRANSFER_MESSAGE_TYPE = "PHUOC_TAI_CHO_TOT_TRANSFER_DRAFT";
const TRANSFER_RESULT_MESSAGE_TYPE = "PHUOC_TAI_CHO_TOT_TRANSFER_RESULT";
const CHOTOT_MINIMUM_PRICE = 1000;
const CHOTOT_HELPER_BASE_URL = "http://127.0.0.1:17321";
const CHOTOT_PROGRESS_MESSAGES = {
  OPENING_CHOTOT: "Đang mở hoặc chuyển sang tab Chợ Tốt.",
  FORM_ALREADY_OPEN: "Đã nhận diện form đăng tin Chợ Tốt.",
  CATEGORY_STEP_SKIPPED: "Form đăng tin đang mở, tiện ích bỏ qua bước chọn danh mục.",
  DESCRIPTION_FILLED: "Mô tả đã được điền trên Chợ Tốt.",
  WAITING_FOR_MANUAL_IMAGE: "Mô tả đã được điền. Vui lòng thêm ít nhất một ảnh trên Chợ Tốt, tiện ích sẽ tiếp tục tự động.",
  IMAGE_DETECTED: "Đã nhận diện ảnh trên form Chợ Tốt.",
  FILLING_REMAINING_FIELDS: "Đang điền các trường còn lại trên Chợ Tốt.",
  STEP_REMAINING_FIELDS_START: "Đang bắt đầu điền các trường còn lại trên Chợ Tốt.",
  CATEGORY_DETAIL_ALREADY_SET: "Danh mục chi tiết đã có sẵn trên form.",
  STEP_TITLE_FIND_START: "Đang tìm ô tiêu đề...",
  STEP_TITLE_FOUND: "Đã tìm thấy ô tiêu đề.",
  STEP_TITLE_FILL_START: "Đang điền tiêu đề...",
  STEP_TITLE_FILLED: "Đã điền tiêu đề.",
  STEP_TITLE_VERIFY_START: "Đang kiểm tra lại tiêu đề...",
  TITLE_VALUE_CORRECT: "Tiêu đề đang đúng.",
  TITLE_RESTORED: "Đã khôi phục tiêu đề.",
  STEP_PRICE_FIND_START: "Đang tìm ô giá...",
  STEP_PRICE_FOUND: "Đã tìm thấy ô giá.",
  PRICE_FIELD_FOUND: "Đã tìm thấy ô giá.",
  PRICE_LABEL_FOUND: "Đã tìm thấy nhãn Giá bán.",
  PRICE_CONTAINER_FOUND: "Đã tìm thấy vùng Giá bán.",
  PRICE_INPUT_FOUND: "Đã tìm thấy ô nhập giá.",
  PRICE_SCOPE_VERIFIED: "Đã xác nhận đúng ô Giá bán.",
  STEP_PRICE_FILL_START: "Đang điền giá...",
  STEP_PRICE_FILLED: "Đã điền giá.",
  PRICE_VERIFY_SUCCESS: "Đã xác nhận giá đã được điền.",
  PRICE_VALIDATION_CLEARED: "Thông báo lỗi giá đã biến mất.",
  TITLE_STILL_CORRECT: "Tiêu đề vẫn đúng sau khi điền giá.",
  PRICE_FILLED: "Đã điền giá.",
  STEP_CONDITION_START: "Đang chọn tình trạng...",
  STEP_CONDITION_FILLED: "Đã chọn tình trạng.",
  STEP_COMPONENT_TYPE_START: "Đang chọn loại linh kiện...",
  STEP_COMPONENT_TYPE_FILLED: "Đã chọn loại linh kiện.",
  STEP_DEVICE_START: "Đang chọn thiết bị...",
  STEP_DEVICE_FILLED: "Đã chọn thiết bị.",
  STEP_WARRANTY_START: "Đang kiểm tra thông tin bảo hành...",
  STEP_WARRANTY_FILLED: "Đã điền thông tin bảo hành.",
  STEP_WARRANTY_SKIPPED: "Bảo hành chưa được điền tự động, vui lòng kiểm tra thủ công.",
  READY_FOR_MANUAL_REVIEW: "Đã điền thông tin. Vui lòng kiểm tra lại và tự bấm Đăng tin nếu phù hợp."
};
const CHOTOT_ERROR_MESSAGES = {
  INVALID_PAYLOAD: "Dữ liệu gửi sang tiện ích chưa hợp lệ. Vui lòng thử lại.",
  EXTENSION_CONTEXT_INVALIDATED: "Tiện ích vừa được tải lại. Vui lòng tải lại trang POS và thử lại.",
  EXTENSION_COMMUNICATION_FAILED: "Không kết nối được với tiện ích Chrome. Hãy kiểm tra tiện ích đã được bật.",
  DUPLICATE_REQUEST: "Yêu cầu này đã được gửi trước đó. Hãy tạo lại thao tác gửi nếu cần.",
  DRAFT_RETRIEVAL_TIMEOUT: "Tiện ích chưa lấy được dữ liệu tin đăng. Vui lòng thử gửi lại.",
  DRAFT_RETRIEVAL_FAILED: "Tiện ích không lấy được dữ liệu tin đăng. Vui lòng thử gửi lại.",
  NO_PENDING_DRAFT: "Không tìm thấy dữ liệu tin đăng đang chờ trong tiện ích. Vui lòng gửi lại từ POS.",
  UNSUPPORTED_PAGE: "Trang Chợ Tốt hiện tại chưa phải trang đăng tin được hỗ trợ.",
  LOGIN_REQUIRED: "Chợ Tốt đang yêu cầu đăng nhập. Vui lòng đăng nhập rồi thử lại.",
  CAPTCHA_OR_VERIFICATION_REQUIRED: "Chợ Tốt đang yêu cầu xác minh. Vui lòng xử lý thủ công trên Chợ Tốt.",
  PAYMENT_REQUIRED: "Chợ Tốt đang yêu cầu thanh toán hoặc bước ngoài phạm vi tiện ích.",
  CATEGORY_NOT_FOUND: "Tiện ích chưa tìm thấy bước chọn danh mục phù hợp. Nếu form đăng tin đã mở, hãy thử tải lại tiện ích rồi gửi lại.",
  DESCRIPTION_FIELD_NOT_FOUND: "Tiện ích chưa tìm thấy ô mô tả trên Chợ Tốt.",
  DESCRIPTION_FILL_FAILED: "Tiện ích chưa xác nhận được mô tả đã được điền. Vui lòng kiểm tra trên Chợ Tốt.",
  DESCRIPTION_STATE_NOT_PERSISTED: "Chợ Tốt đã xóa nội dung vừa điền. Vui lòng thử lại hoặc nhập mô tả thủ công.",
  MANUAL_IMAGE_TIMEOUT: "Tiện ích đã chờ ảnh quá lâu. Vui lòng thêm ảnh trên Chợ Tốt rồi gửi lại nếu cần.",
  TITLE_FIELD_NOT_FOUND: "Sau khi có ảnh, tiện ích chưa tìm thấy ô tiêu đề.",
  TITLE_FIELD_SCOPE_MISMATCH: "Tiện ích phát hiện ô tiêu đề không đúng vùng nhập liệu. Vui lòng kiểm tra form Chợ Tốt.",
  TITLE_STATE_NOT_PERSISTED: "Chợ Tốt đã xóa tiêu đề vừa điền. Vui lòng thử lại hoặc nhập tiêu đề thủ công.",
  PRICE_FIELD_NOT_FOUND: "Sau khi có ảnh, tiện ích chưa tìm thấy ô giá.",
  PRICE_FIELD_SCOPE_MISMATCH: "Tiện ích phát hiện ô giá không đúng vùng Giá bán, nên đã dừng để tránh ghi nhầm.",
  PRICE_BELOW_CHOTOT_MINIMUM: "Giá đăng Chợ Tốt phải từ 1.000 đ trở lên.",
  PRICE_STATE_NOT_PERSISTED: "Chợ Tốt đã xóa giá vừa điền. Vui lòng thử lại hoặc nhập giá thủ công.",
  CONDITION_FIELD_NOT_FOUND: "Tiện ích chưa tìm thấy trường tình trạng sản phẩm trên Chợ Tốt.",
  CONDITION_OPTION_NOT_FOUND: "Tiện ích chưa chọn được tình trạng sản phẩm trên Chợ Tốt.",
  COMPONENT_TYPE_FIELD_NOT_FOUND: "Tiện ích chưa tìm thấy trường loại linh kiện trên Chợ Tốt.",
  COMPONENT_TYPE_OPTION_NOT_FOUND: "Tiện ích chưa chọn được loại linh kiện trên Chợ Tốt.",
  DEVICE_FIELD_NOT_FOUND: "Tiện ích chưa tìm thấy trường thiết bị trên Chợ Tốt.",
  DEVICE_OPTION_NOT_FOUND: "Tiện ích chưa chọn được thiết bị trên Chợ Tốt.",
  FORBIDDEN_ACTION_BLOCKED: "Tiện ích đã chặn một thao tác không an toàn trên Chợ Tốt. Vui lòng kiểm tra thủ công.",
  UNEXPECTED_FILL_ERROR: "Tiện ích gặp lỗi khi điền form. Vui lòng kiểm tra trên Chợ Tốt."
};
const CONDITION_OPTIONS = [
  { value: "", label: "Chọn tình trạng" },
  { value: "new", label: "Mới" },
  { value: "used_not_repaired", label: "Đã sử dụng (chưa sửa chữa)" },
  { value: "used_repaired", label: "Đã sử dụng (qua sửa chữa)" }
];
const DEVICE_OPTIONS = [
  { value: "unknown", label: "Chọn thiết bị" },
  { value: "mainboard", label: "Mainboard" },
  { value: "cpu", label: "CPU" },
  { value: "vga", label: "VGA" },
  { value: "psu", label: "Nguồn máy tính - PSU" },
  { value: "hdd", label: "Ổ cứng HDD" },
  { value: "ssd", label: "Ổ cứng SSD" }
];

function formatSalePrice(value) {
  if (value === null || value === undefined) return "Chưa thiết lập";
  return `${Number(value).toLocaleString("vi-VN")} đ`;
}

function getSalePriceTone(value) {
  if (value === null || value === undefined) return "text-slate-400";
  if (Number(value) === 0) return "text-amber-700";
  return "text-slate-900";
}

function getProductQueueStatus(product) {
  if (!product?.primary_image && Number(product?.image_count || 0) <= 0) {
    return { label: "Thiếu ảnh", className: "bg-amber-50 text-amber-700 ring-amber-100" };
  }
  if (product?.sale_price === null || product?.sale_price === undefined) {
    return { label: "Thiếu giá", className: "bg-red-50 text-red-700 ring-red-100" };
  }
  return { label: "Có thể chuẩn bị", className: "bg-emerald-50 text-emerald-700 ring-emerald-100" };
}

function suggestDeviceType(product) {
  const haystack = [
    product?.category?.code,
    product?.category?.name,
    product?.category_name,
    product?.name
  ].filter(Boolean).join(" ").toLowerCase();

  if (/\b(cpu|processor|ryzen|intel core|i[3579]-?\d{3,5})\b/.test(haystack)) return "cpu";
  if (/\b(vga|gpu|card màn hình|card man hinh|gtx|rtx|radeon)\b/.test(haystack)) return "vga";
  if (/\b(mainboard|main board|bo mạch chủ|bo mach chu|motherboard)\b/.test(haystack)) return "mainboard";
  if (/\b(psu|nguồn|nguon|power supply)\b/.test(haystack)) return "psu";
  if (/\b(ssd|solid state)\b/.test(haystack)) return "ssd";
  if (/\b(hdd|ổ cứng hdd|o cung hdd|hard disk)\b/.test(haystack)) return "hdd";
  return "unknown";
}

function getWarrantyPolicy(selectedNoteGroup) {
  if (!selectedNoteGroup) return "";
  const label = getNoteGroupLabel(selectedNoteGroup);
  return label.toLowerCase() === "hbh" ? "Hết bảo hành" : label;
}

function getChoTotProgressMessage(message) {
  if (message.code === "READY_FOR_MANUAL_REVIEW") {
    return "Đã điền xong. Vui lòng kiểm tra và bấm Đăng tin thủ công.";
  }
  if (!CHOTOT_PROGRESS_MESSAGES[message.code] && /^[A-Z0-9_]+$/.test(message.message || "")) {
    return "Tiện ích đang xử lý trên Chợ Tốt.";
  }
  return CHOTOT_PROGRESS_MESSAGES[message.code] || message.message || "Đã gửi yêu cầu sang tiện ích Chợ Tốt.";
}

function getChoTotErrorMessage(message) {
  if (!CHOTOT_ERROR_MESSAGES[message.error] && /^[A-Z0-9_]+$/.test(message.message || "")) {
    return "Tiện ích gặp lỗi khi xử lý form Chợ Tốt. Vui lòng kiểm tra lại.";
  }
  return CHOTOT_ERROR_MESSAGES[message.error] || message.message || "Không gửi được draft sang Chợ Tốt. Hãy kiểm tra extension.";
}

function getHelperErrorMessage(code) {
  const messages = {
    HELPER_OFFLINE: "Không kết nối được helper trên laptop.",
    NO_IMAGE: "Sản phẩm chưa có ảnh được chọn để gửi sang Chợ Tốt.",
    INVALID_PAYLOAD: "Dữ liệu gửi sang helper chưa hợp lệ.",
    POS_ORIGIN_NOT_ALLOWED: "Helper chưa cho phép origin POS hiện tại.",
    DUPLICATE_REQUEST: "Yêu cầu này đã được gửi trước đó.",
    REQUEST_IN_PROGRESS: "Helper đang xử lý một tin khác. Vui lòng chờ hoàn tất rồi thử lại.",
    CHOTOT_TAB_CLOSED_BEFORE_READY: "Cửa sổ Chợ Tốt đã đóng trước khi tin đăng sẵn sàng. Vui lòng thử lại.",
    IMAGE_FETCH_FAILED: "Helper không tải được ảnh từ POS.",
    IMAGE_PREPARATION_COUNT_MISMATCH: "Helper chưa chuẩn bị đủ file ảnh trước khi gửi sang Chợ Tốt.",
    IMAGE_NOT_AVAILABLE: "Ảnh công khai chưa sẵn sàng hoặc không tồn tại.",
    IMAGE_INVALID_SIGNATURE: "Helper không nhận diện được định dạng ảnh.",
    IMAGE_TOO_LARGE: "Ảnh vượt giới hạn dung lượng helper.",
    CHOTOT_LOGIN_REQUIRED: "Chợ Tốt cần đăng nhập hoặc xác minh thủ công.",
    CHOTOT_POSTING_FORM_NOT_FOUND: "Helper chưa tìm thấy form đăng tin Chợ Tốt.",
    CHOTOT_ELECTRONICS_CATEGORY_NOT_FOUND: "Không tìm thấy danh mục Đồ điện tử trên Chợ Tốt.",
    CHOTOT_ELECTRONICS_CATEGORY_AMBIGUOUS: "Helper chưa xác định chắc chắn dòng Đồ điện tử trên Chợ Tốt.",
    CHOTOT_COMPONENT_CATEGORY_NOT_FOUND: "Không tìm thấy danh mục Linh kiện trên Chợ Tốt.",
    CHOTOT_POSTING_FORM_TIMEOUT: "Chợ Tốt chưa mở được biểu mẫu đăng tin.",
    CHOTOT_WRONG_CATEGORY_FORM: "Chợ Tốt đang mở sai loại biểu mẫu. Helper đã dừng để tránh tải ảnh nhầm.",
    CHOTOT_EXISTING_IMAGES: "Form Chợ Tốt đã có ảnh. Hãy dùng form trống để thử.",
    IMAGE_INPUT_NOT_FOUND: "Helper chưa tìm thấy ô tải ảnh trên Chợ Tốt.",
    IMAGE_UPLOAD_COMMAND_FAILED: "Helper chưa gửi được lệnh tải ảnh sang Chợ Tốt.",
    IMAGE_UPLOAD_FAILED: "Helper chưa tải được ảnh lên Chợ Tốt.",
    IMAGE_PROCESSING_PARTIAL_TIMEOUT: "Chợ Tốt đang xử lý ảnh lâu hơn bình thường. Vui lòng kiểm tra ảnh trên form.",
    IMAGE_COUNT_MISMATCH: "Số ảnh trên Chợ Tốt chưa khớp với số ảnh đã chọn.",
    IMAGE_THUMBNAIL_COUNT_MISMATCH: "Helper chưa xác minh được đủ số thumbnail ảnh trên Chợ Tốt.",
    IMAGE_THUMBNAIL_VERIFICATION_TIMEOUT: "Helper chờ xác minh thumbnail ảnh quá lâu.",
    IMAGES_VISIBLE_VERIFICATION_UNCERTAIN: "Ảnh đã xuất hiện trên Chợ Tốt nhưng helper chưa xác minh chắc chắn. Vui lòng kiểm tra trước khi tiếp tục.",
    IMAGE_UPLOAD_REJECTED: "Chợ Tốt từ chối ảnh sau khi tải lên.",
    IMAGE_THUMBNAIL_NOT_DETECTED: "Helper chưa xác nhận được thumbnail ảnh trên Chợ Tốt.",
    DESCRIPTION_TOO_SHORT: "Mô tả cần tối thiểu 10 từ.",
    DESCRIPTION_TOO_LONG: "Mô tả vượt quá 1500 ký tự.",
    DESCRIPTION_FIELD_NOT_FOUND: "Helper chưa tìm thấy ô mô tả trên Chợ Tốt.",
    DESCRIPTION_FIELD_SCOPE_MISMATCH: "Helper phát hiện vùng mô tả không đúng nên đã dừng để tránh ghi nhầm.",
    DESCRIPTION_FILL_FAILED: "Helper chưa điền được mô tả trên Chợ Tốt.",
    DESCRIPTION_CONFIRM_FAILED: "Helper chưa xác nhận được phần mô tả trên Chợ Tốt.",
    CHOTOT_AI_RENDER_TIMEOUT: "Chợ Tốt xử lý tự động quá lâu sau khi xác nhận mô tả.",
    REMAINING_FIELDS_TIMEOUT: "Chợ Tốt chưa mở các trường chi tiết sau khi tải ảnh và mô tả.",
    TITLE_FIELD_NOT_FOUND: "Helper chưa tìm thấy ô tiêu đề trên Chợ Tốt.",
    TITLE_FIELD_SCOPE_MISMATCH: "Helper phát hiện vùng tiêu đề không đúng nên đã dừng để tránh ghi nhầm.",
    TITLE_FILL_FAILED: "Helper chưa điền được tiêu đề trên Chợ Tốt.",
    PRICE_FIELD_NOT_FOUND: "Helper chưa tìm thấy ô giá trên Chợ Tốt.",
    PRICE_FIELD_SCOPE_MISMATCH: "Helper phát hiện vùng giá không đúng nên đã dừng để tránh ghi nhầm.",
    PRICE_FILL_FAILED: "Helper chưa điền được giá trên Chợ Tốt.",
    PRICE_STATE_NOT_PERSISTED: "Chợ Tốt đã xóa giá vừa điền. Vui lòng thử lại hoặc nhập giá thủ công.",
    CATEGORY_DETAIL_NOT_FOUND: "Helper chưa chọn được danh mục chi tiết Linh kiện trên Chợ Tốt.",
    CONDITION_OPTION_NOT_FOUND: "Helper chưa chọn được tình trạng trên Chợ Tốt.",
    COMPONENT_TYPE_OPTION_NOT_FOUND: "Helper chưa chọn được loại linh kiện trên Chợ Tốt.",
    DEVICE_OPTION_NOT_FOUND: "Helper chưa chọn được thiết bị trên Chợ Tốt.",
    CAPTCHA_DETECTED: "Chợ Tốt đang hiển thị CAPTCHA. Vui lòng xử lý thủ công.",
    PAYMENT_OR_VERIFICATION_REQUIRED: "Chợ Tốt đang yêu cầu xác minh hoặc thanh toán. Vui lòng xử lý thủ công.",
    FORM_VERIFICATION_FAILED: "Helper chưa xác minh được toàn bộ form sau khi điền.",
    BROWSER_NOT_READY: "Helper chưa mở được trình duyệt đăng tin."
  };
  return `${messages[code] || "Helper chưa xử lý thành công yêu cầu."} (${code})`;
}

function getHelperProgressMessage(progressOrCode) {
  const code = typeof progressOrCode === "string" ? progressOrCode : progressOrCode?.code;
  const detail = typeof progressOrCode === "string" ? null : progressOrCode?.detail;
  const detected = Number(detail?.detectedRealThumbnailCount ?? detail?.realThumbnailCount ?? 0);
  const expected = Number(detail?.expectedCount ?? 0);
  if ((code === "WAITING_FOR_IMAGE_PROCESSING" || code === "IMAGE_COUNT_PROGRESS") && expected > 0) {
    return `Chợ Tốt đang xử lý ảnh (${detected}/${expected})...`;
  }
  if (code === "IMAGE_PROCESSING_PARTIAL_TIMEOUT") {
    return "Ảnh đang được Chợ Tốt xử lý lâu hơn bình thường...";
  }

  const aiFirstMessages = {
    IMAGE_FILES_ASSIGNED: "Đã gửi file ảnh sang Chợ Tốt. Đang chờ xử lý...",
    WAITING_FOR_IMAGE_PROCESSING: "Chợ Tốt đang xử lý ảnh...",
    IMAGE_COUNT_PROGRESS: "Chợ Tốt đang xử lý ảnh...",
    IMAGES_READY: "Ảnh đã sẵn sàng trên Chợ Tốt.",
    FAST_PRICE_WAITING: "Đang cập nhật giá đăng...",
    FAST_PRICE_READY: "Đang cập nhật giá đăng...",
    FAST_PRICE_FILLED: "Đã cập nhật giá đăng. Đang kiểm tra thông tin chi tiết...",
    CHECKING_AI_DETAIL_FIELDS: "Đang kiểm tra thông tin chi tiết Chợ Tốt đã tự chọn...",
    LISTING_NEEDS_TITLE: "Chợ Tốt chưa tạo tiêu đề. Vui lòng nhập tiêu đề thủ công.",
    LISTING_NEEDS_ADDRESS: "Tin đăng đã được điền. Vui lòng chọn địa chỉ rồi bấm Đăng tin.",
    LISTING_NEEDS_DETAIL_REVIEW: "Chợ Tốt còn thiếu thông tin chi tiết. Vui lòng kiểm tra trước khi đăng.",
    LISTING_READY_FOR_MANUAL_POST: "Tin đăng đã sẵn sàng. Bạn có thể kiểm tra và bấm Đăng tin.",
    SELLER_COMPLETED_OR_CLOSED_AFTER_READY: "Tin đăng đã được chuẩn bị. Cửa sổ Chợ Tốt đã được đóng hoặc chuyển trang."
  };
  if (aiFirstMessages[code]) return aiFirstMessages[code];

  const messages = {
    UPLOADING_IMAGES: "Đang tải ảnh...",
    ALL_IMAGES_UPLOADED: "Đã tải ảnh xong. Đang điền mô tả...",
    FILLING_DESCRIPTION: "Đang điền mô tả...",
    DESCRIPTION_FILLED: "Đã điền mô tả. Đang chờ form chi tiết...",
    REMAINING_FIELDS_READY: "Đang điền tiêu đề và giá...",
    FILLING_TITLE_PRICE: "Đang điền tiêu đề và giá...",
    FILLING_DETAIL_FIELDS: "Đang chọn thông tin chi tiết...",
    LISTING_READY_FOR_MANUAL_REVIEW: "Đã chuẩn bị xong tin đăng. Vui lòng kiểm tra và bấm Đăng tin."
  };
  return messages[code] || "Helper đang xử lý trên Chợ Tốt...";
}

function ProductListItem({ product, isSelected, onSelect }) {
  const thumbnailPath = product.primary_image
    ? `/admin/products/${product.id}/images/${product.primary_image.id}/thumbnail`
    : "";
  const status = getProductQueueStatus(product);

  return (
    <button
      type="button"
      onClick={() => onSelect(product)}
      className={[
        "grid w-full grid-cols-[48px_minmax(0,1fr)] gap-3 rounded-md border px-3 py-2 text-left transition",
        isSelected
          ? "border-brand-500 bg-brand-50 ring-1 ring-brand-200"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      ].join(" ")}
    >
      <AuthenticatedImage
        path={thumbnailPath}
        alt={product.name}
        className="h-12 w-12 rounded border border-slate-200 object-contain"
      />
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 break-words text-sm font-semibold leading-5 text-slate-900">{product.name}</p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${status.className}`}>
            {status.label}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500" title={product.sku}>
          {product.sku}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className={`font-semibold ${getSalePriceTone(product.sale_price)}`}>{formatSalePrice(product.sale_price)}</span>
          <span className="font-bold text-brand-800">Tồn {Number(product.total_quantity || 0)}</span>
        </div>
      </div>
    </button>
  );
}

function DetailEmptyState() {
  return (
    <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <div className="max-w-sm">
        <p className="text-base font-semibold text-slate-800">Chưa chọn sản phẩm</p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Chọn một sản phẩm còn tồn để chuẩn bị tiêu đề, giá, mô tả và ảnh cho hàng chờ đăng.
        </p>
      </div>
    </div>
  );
}

function ReadinessItem({ label, ok }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
        ok ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : "bg-slate-100 text-slate-600 ring-slate-200"
      ].join(" ")}
    >
      {ok ? "✓" : "•"} {label}
    </span>
  );
}

export function OnlineListingPage() {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [products, setProducts] = useState([]);
  const [sourceProductCount, setSourceProductCount] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [productError, setProductError] = useState("");
  const [images, setImages] = useState([]);
  const [selectedImageIds, setSelectedImageIds] = useState([]);
  const [coverImageId, setCoverImageId] = useState("");
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [imageError, setImageError] = useState("");
  const [downloadingImageId, setDownloadingImageId] = useState(null);
  const [downloadError, setDownloadError] = useState("");
  const [onlinePriceInput, setOnlinePriceInput] = useState("");
  const [condition, setCondition] = useState("");
  const [deviceType, setDeviceType] = useState("unknown");
  const [quickSellingNote, setQuickSellingNote] = useState("");
  const [selectedNoteGroupIndex, setSelectedNoteGroupIndex] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [isTitleEdited, setIsTitleEdited] = useState(false);
  const [isDescriptionEdited, setIsDescriptionEdited] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [copyError, setCopyError] = useState("");
  const [prepareMessage, setPrepareMessage] = useState("");
  const [prepareError, setPrepareError] = useState("");
  const [isHelperSending, setIsHelperSending] = useState(false);
  const imageRequestIdRef = useRef(0);
  const copyFeedbackTimerRef = useRef(null);
  const transferRequestIdRef = useRef("");

  const selectedNoteGroups = useMemo(
    () => (selectedProduct?.note_groups || []).filter((group) => Number(group.quantity || 0) > 0),
    [selectedProduct]
  );
  const selectedNoteGroup = selectedNoteGroupIndex === "" ? null : selectedNoteGroups[Number(selectedNoteGroupIndex)] || null;
  const onlinePrice = useMemo(() => parseOnlinePriceInput(onlinePriceInput), [onlinePriceInput]);
  const suggestedTitle = useMemo(() => buildSuggestedOnlineListingTitle(selectedProduct), [selectedProduct]);
  const generatedDescription = useMemo(
    () => buildOnlineListingDescription({
      product: selectedProduct,
      quickSellingNote,
      selectedNoteGroup
    }),
    [quickSellingNote, selectedNoteGroup, selectedProduct]
  );
  const readiness = useMemo(() => {
    const hasTitle = titleDraft.trim().length > 0;
    const hasPrice = !onlinePrice.error && Number(onlinePrice.value || 0) >= CHOTOT_MINIMUM_PRICE;
    const hasDescription = descriptionDraft.trim().length > 0;
    const hasDescriptionLength = descriptionDraft.trim().split(/\s+/).filter(Boolean).length >= 10 && descriptionDraft.trim().length <= 1500;
    const hasImages = selectedImageIds.length > 0;
    const hasCondition = Boolean(condition);
    const hasDevice = deviceType && deviceType !== "unknown";
    const missing = [
      !hasTitle ? "tiêu đề" : "",
      !hasPrice ? "giá Chợ Tốt từ 1.000 đ" : "",
      !hasDescription ? "mô tả" : "",
      hasDescription && !hasDescriptionLength ? "mô tả 10 từ trở lên và tối đa 1500 ký tự" : "",
      !hasImages ? "ảnh" : "",
      !hasCondition ? "tình trạng" : "",
      !hasDevice ? "thiết bị" : ""
    ].filter(Boolean);

    return { hasTitle, hasPrice, hasDescription: hasDescription && hasDescriptionLength, hasImages, hasCondition, hasDevice, missing, isReady: missing.length === 0 };
  }, [condition, descriptionDraft, deviceType, onlinePrice.error, onlinePrice.value, selectedImageIds.length, titleDraft]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => () => {
    if (copyFeedbackTimerRef.current) window.clearTimeout(copyFeedbackTimerRef.current);
  }, []);

  useEffect(() => {
    function handleExtensionResult(event) {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const message = event.data || {};
      if (message.type !== TRANSFER_RESULT_MESSAGE_TYPE) return;
      if (message.requestId && message.requestId !== transferRequestIdRef.current) return;

      if (message.code || message.error) {
        if (message.ok) {
          setPrepareError("");
          setPrepareMessage(getChoTotProgressMessage(message));
        } else {
          setPrepareMessage("");
          setPrepareError(getChoTotErrorMessage(message));
        }
        return;
      }

      if (message.ok) {
        setPrepareError("");
        setPrepareMessage(message.message || "Đã gửi draft sang Chợ Tốt. Vui lòng kiểm tra form trước khi đăng tin.");
      } else {
        setPrepareMessage("");
        setPrepareError(message.error || "Không gửi được draft sang Chợ Tốt. Hãy kiểm tra extension.");
      }
    }

    window.addEventListener("message", handleExtensionResult);
    return () => window.removeEventListener("message", handleExtensionResult);
  }, []);

  useEffect(() => {
    let active = true;
    imageRequestIdRef.current += 1;
    setSelectedProduct(null);
    setImages([]);
    setSelectedImageIds([]);
    setCoverImageId("");
    setImageError("");
    setDownloadError("");
    setIsHelperSending(false);
    resetDraftState();

    async function loadProducts() {
      setIsLoadingProducts(true);
      setProductError("");
      try {
        const result = await listOnlineListingProducts({
          keyword: debouncedSearch,
          page,
          limit: PRODUCT_PAGE_SIZE
        });
        if (!active) return;
        setProducts(result.items);
        setSourceProductCount(Number(result.source_count || 0));
        setTotalPages(Math.max(1, Number(result.meta?.total_pages || 1)));
      } catch (error) {
        if (!active) return;
        setProducts([]);
        setSourceProductCount(0);
        setTotalPages(1);
        setProductError(error?.message || "Không thể tải danh sách sản phẩm.");
      } finally {
        if (active) setIsLoadingProducts(false);
      }
    }

    loadProducts();
    return () => {
      active = false;
    };
  }, [debouncedSearch, page]);

  useEffect(() => {
    const requestId = imageRequestIdRef.current + 1;
    imageRequestIdRef.current = requestId;
    setImages([]);
    setSelectedImageIds([]);
    setCoverImageId("");
    setImageError("");

    if (!selectedProduct) {
      setIsLoadingImages(false);
      return undefined;
    }

    let active = true;
    async function loadImages() {
      setIsLoadingImages(true);
      try {
        const nextImages = await listOnlineListingProductImages(selectedProduct.id);
        if (!active || imageRequestIdRef.current !== requestId) return;
        const limitedImages = nextImages.slice(0, 5);
        setImages(limitedImages);
        setSelectedImageIds(limitedImages.map((image) => String(image.id)));
        setCoverImageId(limitedImages[0]?.id ? String(limitedImages[0].id) : "");
      } catch (error) {
        if (!active || imageRequestIdRef.current !== requestId) return;
        setImages([]);
        setSelectedImageIds([]);
        setCoverImageId("");
        setImageError(error?.message || "Không thể tải ảnh sản phẩm.");
      } finally {
        if (active && imageRequestIdRef.current === requestId) setIsLoadingImages(false);
      }
    }

    loadImages();
    return () => {
      active = false;
    };
  }, [selectedProduct]);

  useEffect(() => {
    if (!selectedProduct || isDescriptionEdited) return;
    setDescriptionDraft(generatedDescription);
  }, [generatedDescription, isDescriptionEdited, selectedProduct]);

  function resetDraftState() {
    setOnlinePriceInput("");
    setCondition("");
    setDeviceType("unknown");
    setQuickSellingNote("");
    setSelectedNoteGroupIndex("");
    setTitleDraft("");
    setDescriptionDraft("");
    setIsTitleEdited(false);
    setIsDescriptionEdited(false);
    setCopyFeedback("");
    setCopyError("");
    setPrepareMessage("");
    setPrepareError("");
    setIsHelperSending(false);
  }

  function handleClearSearch() {
    setSearchInput("");
    setDebouncedSearch("");
    setPage(1);
  }

  function resetDraftForProduct(product) {
    const nextTitle = buildSuggestedOnlineListingTitle(product);
    setOnlinePriceInput(getOnlinePriceInputFromProduct(product));
    setCondition("");
    setDeviceType(suggestDeviceType(product));
    setQuickSellingNote("");
    setSelectedNoteGroupIndex("");
    setTitleDraft(nextTitle);
    setDescriptionDraft(buildOnlineListingDescription({ product, quickSellingNote: "", selectedNoteGroup: null }));
    setIsTitleEdited(false);
    setIsDescriptionEdited(false);
    setCopyFeedback("");
    setCopyError("");
    setPrepareMessage("");
    setPrepareError("");
  }

  function handleSelectProduct(product) {
    imageRequestIdRef.current += 1;
    setSelectedProduct(product);
    setImages([]);
    setSelectedImageIds([]);
    setCoverImageId("");
    setImageError("");
    setDownloadError("");
    setIsHelperSending(false);
    resetDraftForProduct(product);
  }

  function handleOnlinePriceChange(event) {
    handleMoneyInputChange(event, setOnlinePriceInput);
    setPrepareMessage("");
    setPrepareError("");
  }

  function handleQuickSellingNoteChange(event) {
    setQuickSellingNote(event.target.value);
    setPrepareMessage("");
    setPrepareError("");
  }

  function handleNoteGroupChange(value) {
    setSelectedNoteGroupIndex(value);
    setPrepareMessage("");
    setPrepareError("");
  }

  function handleConditionChange(event) {
    setCondition(event.target.value);
    setPrepareMessage("");
    setPrepareError("");
  }

  function handleDeviceTypeChange(event) {
    setDeviceType(event.target.value);
    setPrepareMessage("");
    setPrepareError("");
  }

  function handleTitleChange(event) {
    setTitleDraft(event.target.value);
    setIsTitleEdited(event.target.value !== suggestedTitle);
    setPrepareMessage("");
    setPrepareError("");
  }

  function handleDescriptionChange(event) {
    setDescriptionDraft(event.target.value);
    setIsDescriptionEdited(event.target.value !== generatedDescription);
    setPrepareMessage("");
    setPrepareError("");
  }

  function handleRestoreTitle() {
    setTitleDraft(suggestedTitle);
    setIsTitleEdited(false);
  }

  function handleRegenerateDescription() {
    const confirmed = window.confirm("Tạo lại mô tả sẽ thay thế nội dung đang sửa. Tiếp tục?");
    if (!confirmed) return;
    setDescriptionDraft(generatedDescription);
    setIsDescriptionEdited(false);
  }

  function getOrderedSelectedImages() {
    const selectedSet = new Set(selectedImageIds.map(String));
    const selectedImages = images.filter((image) => selectedSet.has(String(image.id)));
    const cover = selectedImages.find((image) => String(image.id) === String(coverImageId));
    const rest = selectedImages.filter((image) => String(image.id) !== String(coverImageId));
    return cover ? [cover, ...rest] : selectedImages;
  }

  function handleToggleImage(imageId) {
    const id = String(imageId);
    setSelectedImageIds((current) => {
      const exists = current.includes(id);
      const next = exists ? current.filter((value) => value !== id) : [...current, id].slice(0, 5);
      if (!next.includes(String(coverImageId))) {
        setCoverImageId(next[0] || "");
      }
      return next;
    });
    setPrepareMessage("");
    setPrepareError("");
  }

  function handleChooseCover(imageId) {
    const id = String(imageId);
    if (!selectedImageIds.includes(id)) {
      setSelectedImageIds((current) => [id, ...current].slice(0, 5));
    }
    setCoverImageId(id);
    setPrepareMessage("");
    setPrepareError("");
  }

  function buildChoTotDraftPayload(requestId) {
    return {
      version: 1,
      source: POS_DRAFT_SOURCE,
      requestId,
      productId: Number(selectedProduct.id),
      sku: selectedProduct.sku,
      title: titleDraft.trim(),
      price: Number(onlinePrice.value),
      description: descriptionDraft.trim(),
      condition,
      componentType: "computer_component",
      deviceType,
      origin: "vietnam",
      warrantyPolicy: getWarrantyPolicy(selectedNoteGroup),
      images: getOrderedSelectedImages().map((image) => ({
        id: Number(image.id),
        originalName: image.original_name || "",
        mimeType: image.mime_type || "",
        thumbnailUrl: resolveApiAssetUrl(image.thumbnail_url),
        downloadUrl: resolveApiAssetUrl(image.download_url)
      }))
    };
  }

  function buildHelperListingPayload(requestId) {
    return {
      version: 1,
      requestId,
      posOrigin: getCurrentPosOrigin(),
      product: {
        id: Number(selectedProduct.id),
        sku: selectedProduct.sku
      },
      images: getOrderedSelectedImages().map((image, index) => ({
        id: Number(image.id),
        position: index + 1,
        isCover: index === 0
      })),
      title: titleDraft.trim(),
      price: Number(onlinePrice.value),
      description: descriptionDraft.trim(),
      condition,
      componentType: "computer_component",
      deviceType,
      warrantyPolicy: getWarrantyPolicy(selectedNoteGroup)
    };
  }

  function sendDraftToExtension(requestId) {
    if (!window.postMessage) {
      setPrepareError("Trình duyệt không hỗ trợ gửi draft sang extension.");
      return false;
    }
    transferRequestIdRef.current = requestId;
    window.postMessage({ type: TRANSFER_MESSAGE_TYPE, payload: buildChoTotDraftPayload(requestId) }, window.location.origin);
    return true;
  }

  async function sendListingToHelper(requestId) {
    const healthResponse = await fetch(`${CHOTOT_HELPER_BASE_URL}/health`, { method: "GET" });
    if (!healthResponse.ok) {
      const error = new Error("HELPER_OFFLINE");
      error.code = "HELPER_OFFLINE";
      throw error;
    }

    setPrepareMessage("Đang mở Chợ Tốt...");
    let progressTimer = null;
    try {
      progressTimer = window.setInterval(async () => {
        try {
          const progressResponse = await fetch(`${CHOTOT_HELPER_BASE_URL}/v1/progress?requestId=${encodeURIComponent(requestId)}`);
          const progressPayload = await progressResponse.json().catch(() => null);
          if (progressPayload?.progress?.code) {
            setPrepareMessage(getHelperProgressMessage(progressPayload.progress));
          }
        } catch {
          // Progress polling is best-effort; the main request remains authoritative.
        }
      }, 800);

      const response = await fetch(`${CHOTOT_HELPER_BASE_URL}/v1/prepare-listing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildHelperListingPayload(requestId))
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        const error = new Error(payload?.error || "HELPER_UPLOAD_FAILED");
        error.code = payload?.error || "HELPER_UPLOAD_FAILED";
        throw error;
      }
      return payload;
    } finally {
      if (progressTimer) window.clearInterval(progressTimer);
    }
  }

  async function handlePrepareChoTot() {
    setPrepareMessage("");
    setPrepareError("");
    if (!readiness.isReady) {
      setPrepareError(`Còn thiếu: ${readiness.missing.join(", ")}.`);
      return;
    }

    const requestId = `helper-listing-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setIsHelperSending(true);
    setPrepareMessage("Đang kết nối helper...");
    try {
      const result = await sendListingToHelper(requestId);
      setPrepareError("");
      setPrepareMessage(result.message || "Đã chuẩn bị xong tin đăng. Vui lòng kiểm tra và bấm Đăng tin.");
    } catch (error) {
      const code = error?.code || error?.message || "HELPER_UPLOAD_FAILED";
      if (code === "HELPER_OFFLINE" || code === "Failed to fetch") {
        const extensionRequestId = `extension-fallback-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        if (sendDraftToExtension(extensionRequestId)) {
          setPrepareError("");
          setPrepareMessage("Không kết nối được helper trên laptop. Đang dùng Chrome extension tạm thời; vui lòng kiểm tra Chợ Tốt thủ công.");
        }
      } else {
        setPrepareMessage("");
        setPrepareError(getHelperErrorMessage(code));
      }
    } finally {
      setIsHelperSending(false);
    }
  }

  async function copyText(text, successMessage) {
    if (copyFeedbackTimerRef.current) {
      window.clearTimeout(copyFeedbackTimerRef.current);
      copyFeedbackTimerRef.current = null;
    }

    setCopyFeedback("");
    setCopyError("");
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(successMessage);
      copyFeedbackTimerRef.current = window.setTimeout(() => {
        setCopyFeedback("");
        copyFeedbackTimerRef.current = null;
      }, 1800);
    } catch {
      setCopyError("Không thể sao chép. Vui lòng kiểm tra quyền clipboard của trình duyệt.");
    }
  }

  async function handleDownloadImage(image) {
    if (!selectedProduct) return;

    setDownloadingImageId(image.id);
    setDownloadError("");
    try {
      await downloadOnlineListingProductImage(selectedProduct.id, image);
    } catch (error) {
      setDownloadError(error?.message || "Không thể tải ảnh gốc.");
    } finally {
      setDownloadingImageId(null);
    }
  }

  function getCurrentPosOrigin() {
    try {
      return new URL(resolveApiAssetUrl("/api/v1"), window.location.origin).origin;
    } catch {
      return window.location.origin;
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Hàng chờ đăng</h2>
        <p className="mt-1 text-sm text-slate-600">
          Chọn sản phẩm còn tồn, rà nhanh phần còn thiếu và chuẩn bị nội dung để đăng Chợ Tốt ở bước sau.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(360px,0.85fr)_minmax(0,1.45fr)]">
        <aside className="min-w-0 space-y-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <label className="mb-1 block text-sm font-medium text-slate-700">Tìm hàng còn tồn</label>
            <div className="relative">
              <input
                className="h-10 w-full rounded-md border border-slate-300 px-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Tên sản phẩm hoặc SKU"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
              {searchInput && (
                <button
                  type="button"
                  aria-label="Xóa tìm kiếm"
                  onClick={handleClearSearch}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2.5">
              <div>
                <p className="text-sm font-semibold text-slate-900">Sản phẩm còn tồn</p>
                <p className="text-xs text-slate-500">Chọn sản phẩm để chuẩn bị tin đăng.</p>
              </div>
              <span className="text-xs font-semibold text-slate-500">Trang {page}/{totalPages}</span>
            </div>

            <div className="max-h-[calc(100vh-270px)] min-h-[300px] space-y-2 overflow-y-auto p-2.5">
              {isLoadingProducts ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((item) => (
                    <div key={item} className="grid grid-cols-[48px_1fr] gap-3 rounded-md border border-slate-100 p-2">
                      <div className="h-12 w-12 animate-pulse rounded bg-slate-100" />
                      <div className="space-y-2 py-1">
                        <div className="h-4 w-4/5 animate-pulse rounded bg-slate-100" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : productError ? (
                <div className="rounded-md bg-red-50 px-3 py-3 text-sm text-red-700">{productError}</div>
              ) : products.length === 0 ? (
                <div className="flex min-h-[220px] items-center justify-center rounded-md border border-dashed border-slate-300 px-4 py-8 text-center">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      {sourceProductCount > 0 ? "Trang này không có sản phẩm còn tồn." : "Không có sản phẩm phù hợp."}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {sourceProductCount > 0 ? "Hãy thử trang khác hoặc đổi từ khóa." : "Thử tìm bằng tên hoặc SKU khác."}
                    </p>
                  </div>
                </div>
              ) : (
                products.map((product) => (
                  <ProductListItem
                    key={product.id}
                    product={product}
                    isSelected={Number(selectedProduct?.id) === Number(product.id)}
                    onSelect={handleSelectProduct}
                  />
                ))
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-3 py-2.5">
              <button
                type="button"
                disabled={page <= 1 || isLoadingProducts}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="h-8 rounded-md border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Trước
              </button>
              <button
                type="button"
                disabled={page >= totalPages || isLoadingProducts}
                onClick={() => setPage((current) => (current < totalPages ? current + 1 : current))}
                className="h-8 rounded-md border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Sau
              </button>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          {!selectedProduct ? (
            <DetailEmptyState />
          ) : (
            <article className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="break-words text-xl font-semibold text-slate-900">{selectedProduct.name}</h3>
                    <span
                      className={[
                        "rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                        readiness.isReady
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                          : "bg-amber-50 text-amber-700 ring-amber-100"
                      ].join(" ")}
                    >
                      {readiness.isReady ? "Sẵn sàng đăng" : "Chưa sẵn sàng"}
                    </span>
                  </div>
                  <p className="mt-1 break-all text-sm text-slate-500">SKU: {selectedProduct.sku}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className={`rounded-md bg-slate-50 px-3 py-2 font-semibold ${getSalePriceTone(selectedProduct.sale_price)}`}>
                    Giá bán: {formatSalePrice(selectedProduct.sale_price)}
                  </span>
                  <span className="rounded-md bg-slate-50 px-3 py-2 font-bold text-brand-800">
                    Tồn {Number(selectedProduct.total_quantity || 0)}
                  </span>
                </div>
              </div>

              <section className="rounded-lg bg-brand-50/40 p-3 ring-1 ring-brand-100">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h4 className="text-base font-semibold text-slate-900">Chuẩn bị tin đăng</h4>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <ReadinessItem label="Tiêu đề" ok={readiness.hasTitle} />
                      <ReadinessItem label="Giá" ok={readiness.hasPrice} />
                      <ReadinessItem label="Mô tả" ok={readiness.hasDescription} />
                      <ReadinessItem label="Ảnh" ok={readiness.hasImages} />
                      <ReadinessItem label="Tình trạng" ok={readiness.hasCondition} />
                      <ReadinessItem label="Thiết bị" ok={readiness.hasDevice} />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handlePrepareChoTot}
                    disabled={isHelperSending}
                    className="h-11 rounded-md bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isHelperSending ? "Đang gửi..." : "Gửi sang Chợ Tốt"}
                  </button>
                </div>
                {(prepareMessage || prepareError || copyFeedback || copyError) && (
                  <p
                    className={[
                      "mt-2 text-sm font-medium",
                      prepareError || copyError ? "text-red-700" : "text-emerald-700"
                    ].join(" ")}
                  >
                    {prepareError || copyError || prepareMessage || copyFeedback}
                  </p>
                )}

                <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(220px,0.7fr)_minmax(0,1.3fr)]">
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Tình trạng</label>
                        <select
                          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                          value={condition}
                          onChange={handleConditionChange}
                        >
                          {CONDITION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Thiết bị</label>
                        <select
                          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                          value={deviceType}
                          onChange={handleDeviceTypeChange}
                        >
                          {DEVICE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Giá đăng online</label>
                      <input
                        inputMode="numeric"
                        className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="Để trống nếu chưa nhập giá"
                        value={onlinePriceInput}
                        onChange={handleOnlinePriceChange}
                      />
                      {onlinePrice.error ? (
                        <p className="mt-1 text-xs font-medium text-red-600">{onlinePrice.error}</p>
                      ) : onlinePrice.value === 0 ? (
                        <p className="mt-1 text-xs font-medium text-amber-700">
                          Giá đang để 0 đ. Hãy kiểm tra trước khi sao chép nội dung.
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-slate-500">Chỉ dùng cho tin đăng, không đổi giá bán tại cửa hàng.</p>
                      )}
                    </div>

                    <div>
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <label className="block text-sm font-medium text-slate-700">Tiêu đề</label>
                        <span className={`text-xs ${titleDraft.length > ONLINE_LISTING_TITLE_MAX_LENGTH ? "text-amber-700" : "text-slate-500"}`}>
                          {titleDraft.length}/{ONLINE_LISTING_TITLE_MAX_LENGTH}
                        </span>
                      </div>
                      <input
                        className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                        value={titleDraft}
                        onChange={handleTitleChange}
                      />
                      {titleDraft.length > ONLINE_LISTING_TITLE_MAX_LENGTH && (
                        <p className="mt-1 text-xs font-medium text-amber-700">
                          Tiêu đề dài hơn giới hạn nội bộ tạm dùng.
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Ghi chú bán hàng nhanh</label>
                      <input
                        className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="VD: tháo máy, hàng 2nd hết BH, bao test 7 ngày"
                        value={quickSellingNote}
                        onChange={handleQuickSellingNoteChange}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <label className="block text-sm font-medium text-slate-700">Mô tả</label>
                      {isDescriptionEdited && <span className="text-xs font-medium text-amber-700">Đã sửa thủ công</span>}
                    </div>
                    <textarea
                      className="min-h-44 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-6 outline-none focus:ring-2 focus:ring-brand-500"
                      value={descriptionDraft}
                      onChange={handleDescriptionChange}
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => copyText(titleDraft, "Đã sao chép tiêu đề")}
                        className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Sao chép tiêu đề
                      </button>
                      <button
                        type="button"
                        onClick={() => copyText(descriptionDraft, "Đã sao chép mô tả")}
                        className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Sao chép mô tả
                      </button>
                      {isTitleEdited && (
                        <button
                          type="button"
                          onClick={handleRestoreTitle}
                          className="h-9 rounded-md border border-brand-200 bg-white px-3 text-sm font-medium text-brand-700 hover:bg-brand-50"
                        >
                          Khôi phục tiêu đề
                        </button>
                      )}
                      {isDescriptionEdited && (
                        <button
                          type="button"
                          onClick={handleRegenerateDescription}
                          className="h-9 rounded-md border border-brand-200 bg-white px-3 text-sm font-medium text-brand-700 hover:bg-brand-50"
                        >
                          Tạo lại mô tả
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  POC hiện gửi thông tin tin đăng sang extension; upload ảnh tự động chưa được bật, vui lòng kiểm tra và thêm ảnh thủ công trên Chợ Tốt nếu cần.
                </p>
              </section>

              <section className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.8fr)]">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold text-slate-900">Ảnh sản phẩm</h4>
                    <span className="text-xs text-slate-500">Chọn tối đa 5 ảnh, cover gửi đầu tiên</span>
                  </div>

                  {isLoadingImages ? (
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 2, 3].map((item) => (
                        <div key={item} className="aspect-square animate-pulse rounded-md bg-slate-100" />
                      ))}
                    </div>
                  ) : imageError ? (
                    <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{imageError}</p>
                  ) : images.length === 0 ? (
                    <p className="rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                      Chưa có ảnh — cần bổ sung trước khi đăng.
                    </p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                        {images.map((image, index) => (
                          <div key={image.id} className="min-w-0 rounded-md bg-slate-50 p-2">
                            <AuthenticatedImage
                              path={`/admin/products/${selectedProduct.id}/images/${image.id}/thumbnail`}
                              alt={`${selectedProduct.name} ${index + 1}`}
                              className="aspect-square w-full rounded border border-slate-200 bg-white object-contain"
                            />
                            <button
                              type="button"
                              disabled={downloadingImageId === image.id}
                              onClick={() => handleDownloadImage(image)}
                              className="mt-1.5 h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {downloadingImageId === image.id ? "Đang tải..." : "Tải ảnh gốc"}
                            </button>
                            <label className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-700">
                              <input
                                type="checkbox"
                                checked={selectedImageIds.includes(String(image.id))}
                                onChange={() => handleToggleImage(image.id)}
                              />
                              Gửi ảnh này
                            </label>
                            <label className="mt-1 flex items-center gap-2 text-xs font-medium text-slate-700">
                              <input
                                type="radio"
                                name="online-listing-cover"
                                checked={String(coverImageId) === String(image.id)}
                                disabled={!selectedImageIds.includes(String(image.id))}
                                onChange={() => handleChooseCover(image.id)}
                              />
                              Cover
                            </label>
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        Helper sẽ gửi ảnh cover trước, sau đó các ảnh còn lại theo thứ tự sản phẩm.
                      </p>
                      {downloadError && <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{downloadError}</p>}
                    </>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Bảo hành / ghi chú</h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleNoteGroupChange("")}
                      className={[
                        "rounded-full px-3 py-1.5 text-xs font-semibold ring-1",
                        selectedNoteGroupIndex === ""
                          ? "bg-brand-700 text-white ring-brand-700"
                          : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                      ].join(" ")}
                    >
                      Không đưa bảo hành
                    </button>
                    {selectedNoteGroups.map((group, index) => (
                      <button
                        key={`${group.note_key || group.note || "empty"}-${group.quantity}`}
                        type="button"
                        onClick={() => handleNoteGroupChange(String(index))}
                        className={[
                          "rounded-full px-3 py-1.5 text-xs font-semibold ring-1",
                          selectedNoteGroupIndex === String(index)
                            ? "bg-brand-700 text-white ring-brand-700"
                            : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                        ].join(" ")}
                      >
                        {getNoteGroupLabel(group)}
                        <span className="ml-1 opacity-70">({Number(group.quantity || 0)})</span>
                      </button>
                    ))}
                    {selectedNoteGroups.length === 0 && (
                      <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">
                        Không có nhóm ghi chú
                      </span>
                    )}
                  </div>
                </div>
              </section>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}
