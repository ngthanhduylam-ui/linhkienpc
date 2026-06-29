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
  formatMoneyInputValue,
  getNoteGroupLabel,
  getOnlinePriceInputFromProduct,
  parseOnlinePriceInput
} from "../utils/onlineListingDraft";

const PRODUCT_PAGE_SIZE = 20;
const POS_DRAFT_SOURCE = "vitinh-phuoc-tai-pos";
const TRANSFER_MESSAGE_TYPE = "PHUOC_TAI_CHO_TOT_TRANSFER_DRAFT";
const TRANSFER_RESULT_MESSAGE_TYPE = "PHUOC_TAI_CHO_TOT_TRANSFER_RESULT";
const CHOTOT_MINIMUM_PRICE = 1000;
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
    const hasImages = images.length > 0;
    const hasCondition = Boolean(condition);
    const hasDevice = deviceType && deviceType !== "unknown";
    const missing = [
      !hasTitle ? "tiêu đề" : "",
      !hasPrice ? "giá Chợ Tốt từ 1.000 đ" : "",
      !hasDescription ? "mô tả" : "",
      !hasImages ? "ảnh" : "",
      !hasCondition ? "tình trạng" : "",
      !hasDevice ? "thiết bị" : ""
    ].filter(Boolean);

    return { hasTitle, hasPrice, hasDescription, hasImages, hasCondition, hasDevice, missing, isReady: missing.length === 0 };
  }, [condition, descriptionDraft, deviceType, images.length, onlinePrice.error, onlinePrice.value, titleDraft]);

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
    setImageError("");
    setDownloadError("");
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
        setImages(nextImages.slice(0, 3));
      } catch (error) {
        if (!active || imageRequestIdRef.current !== requestId) return;
        setImages([]);
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
    setImageError("");
    setDownloadError("");
    resetDraftForProduct(product);
  }

  function handleOnlinePriceChange(event) {
    setOnlinePriceInput(event.target.value);
    setPrepareMessage("");
    setPrepareError("");
  }

  function handleOnlinePriceBlur() {
    const parsed = parseOnlinePriceInput(onlinePriceInput);
    if (!onlinePriceInput.trim() || parsed.error || parsed.value === null) return;
    setOnlinePriceInput(formatMoneyInputValue(parsed.value));
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
      images: images.map((image) => ({
        id: Number(image.id),
        originalName: image.original_name || "",
        mimeType: image.mime_type || "",
        thumbnailUrl: resolveApiAssetUrl(image.thumbnail_url),
        downloadUrl: resolveApiAssetUrl(image.download_url)
      }))
    };
  }

  function handlePrepareChoTot() {
    setPrepareMessage("");
    setPrepareError("");
    if (!readiness.isReady) {
      setPrepareError(`Còn thiếu: ${readiness.missing.join(", ")}.`);
      return;
    }
    if (!window.postMessage) {
      setPrepareError("Trình duyệt không hỗ trợ gửi draft sang extension.");
      return;
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    transferRequestIdRef.current = requestId;
    window.postMessage({ type: TRANSFER_MESSAGE_TYPE, payload: buildChoTotDraftPayload(requestId) }, window.location.origin);
    setPrepareMessage("Đã gửi yêu cầu sang Chrome extension. Nếu không có phản hồi, hãy kiểm tra extension đã được cài và bật.");
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
                    className="h-11 rounded-md bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-900"
                  >
                    Gửi sang Chợ Tốt
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
                        onBlur={handleOnlinePriceBlur}
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
                    <span className="text-xs text-slate-500">Tối đa 3 ảnh hiện có</span>
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
                      <div className="grid grid-cols-3 gap-2">
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
                          </div>
                        ))}
                      </div>
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
