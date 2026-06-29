import { useEffect, useMemo, useRef, useState } from "react";
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

function formatSalePrice(value) {
  if (value === null || value === undefined) {
    return "Chưa thiết lập";
  }

  return `${Number(value).toLocaleString("vi-VN")} đ`;
}

function getSalePriceTone(value) {
  if (value === null || value === undefined) return "text-slate-400";
  if (Number(value) === 0) return "text-amber-700";
  return "text-slate-900";
}

function formatNoteLabel(group) {
  return getNoteGroupLabel(group);
}

function ProductListItem({ product, isSelected, onSelect }) {
  const thumbnailPath = product.primary_image
    ? `/admin/products/${product.id}/images/${product.primary_image.id}/thumbnail`
    : "";

  return (
    <button
      type="button"
      onClick={() => onSelect(product)}
      className={[
        "grid w-full grid-cols-[56px_minmax(0,1fr)] gap-3 rounded-md border p-3 text-left transition",
        isSelected
          ? "border-brand-500 bg-brand-50 ring-1 ring-brand-200"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      ].join(" ")}
    >
      <AuthenticatedImage
        path={thumbnailPath}
        alt={product.name}
        className="h-14 w-14 rounded border border-slate-200 object-contain"
      />
      <div className="min-w-0">
        <p className="line-clamp-2 break-words text-sm font-semibold text-slate-900">{product.name}</p>
        <p className="mt-1 truncate text-xs text-slate-500" title={product.sku}>
          {product.sku}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className={`font-semibold ${getSalePriceTone(product.sale_price)}`}>
            {formatSalePrice(product.sale_price)}
          </span>
          <span className="font-bold text-brand-800">Tồn {Number(product.total_quantity || 0)}</span>
        </div>
      </div>
    </button>
  );
}

function DetailEmptyState() {
  return (
    <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <div className="max-w-sm">
        <p className="text-base font-semibold text-slate-800">Chưa chọn sản phẩm</p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Tìm sản phẩm còn tồn ở danh sách bên trái, sau đó chọn một sản phẩm để xem thông tin và ảnh hiện có.
        </p>
      </div>
    </div>
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
  const [selectedNoteGroupIndex, setSelectedNoteGroupIndex] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [isTitleEdited, setIsTitleEdited] = useState(false);
  const [isDescriptionEdited, setIsDescriptionEdited] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [copyError, setCopyError] = useState("");
  const imageRequestIdRef = useRef(0);
  const copyFeedbackTimerRef = useRef(null);

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
      onlinePrice: onlinePrice.error ? null : onlinePrice.value,
      selectedNoteGroup,
      hasImages: images.length > 0
    }),
    [images.length, onlinePrice.error, onlinePrice.value, selectedNoteGroup, selectedProduct]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => () => {
    if (copyFeedbackTimerRef.current) {
      window.clearTimeout(copyFeedbackTimerRef.current);
    }
  }, []);

  useEffect(() => {
    let active = true;
    imageRequestIdRef.current += 1;
    setSelectedProduct(null);
    setImages([]);
    setImageError("");
    setDownloadError("");
    setOnlinePriceInput("");
    setSelectedNoteGroupIndex("");
    setTitleDraft("");
    setDescriptionDraft("");
    setIsTitleEdited(false);
    setIsDescriptionEdited(false);
    setCopyFeedback("");
    setCopyError("");

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
        if (active && imageRequestIdRef.current === requestId) {
          setIsLoadingImages(false);
        }
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

  function handleClearSearch() {
    setSearchInput("");
    setDebouncedSearch("");
    setPage(1);
  }

  function resetDraftForProduct(product) {
    const nextTitle = buildSuggestedOnlineListingTitle(product);
    const nextPriceInput = getOnlinePriceInputFromProduct(product);
    const nextPrice = parseOnlinePriceInput(nextPriceInput);

    setOnlinePriceInput(nextPriceInput);
    setSelectedNoteGroupIndex("");
    setTitleDraft(nextTitle);
    setDescriptionDraft(buildOnlineListingDescription({
      product,
      onlinePrice: nextPrice.error ? null : nextPrice.value,
      selectedNoteGroup: null,
      hasImages: false
    }));
    setIsTitleEdited(false);
    setIsDescriptionEdited(false);
    setCopyFeedback("");
    setCopyError("");
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
  }

  function handleOnlinePriceBlur() {
    const parsed = parseOnlinePriceInput(onlinePriceInput);
    if (!onlinePriceInput.trim() || parsed.error || parsed.value === null) return;
    setOnlinePriceInput(formatMoneyInputValue(parsed.value));
  }

  function handleNoteGroupChange(event) {
    setSelectedNoteGroupIndex(event.target.value);
  }

  function handleTitleChange(event) {
    setTitleDraft(event.target.value);
    setIsTitleEdited(event.target.value !== suggestedTitle);
  }

  function handleDescriptionChange(event) {
    setDescriptionDraft(event.target.value);
    setIsDescriptionEdited(event.target.value !== generatedDescription);
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
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Đăng bán online</h2>
        <p className="mt-1 text-sm text-slate-600">
          Chọn sản phẩm còn tồn để xem thông tin và ảnh trước khi chuẩn bị tin đăng.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.4fr)]">
        <aside className="min-w-0 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <label className="mb-1 block text-sm font-medium text-slate-700">Tìm sản phẩm còn tồn</label>
            <div className="relative">
              <input
                className="h-11 w-full rounded-md border border-slate-300 px-3 pr-11 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Tìm theo tên sản phẩm hoặc SKU"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
              {searchInput && (
                <button
                  type="button"
                  aria-label="Xóa tìm kiếm"
                  onClick={handleClearSearch}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Sản phẩm</p>
              <p className="mt-1 text-xs text-slate-500">Chỉ hiển thị sản phẩm đang hoạt động và có tồn.</p>
            </div>

            <div className="max-h-[calc(100vh-300px)] min-h-[320px] space-y-2 overflow-y-auto p-3">
              {isLoadingProducts ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((item) => (
                    <div key={item} className="grid grid-cols-[56px_1fr] gap-3 rounded-md border border-slate-100 p-3">
                      <div className="h-14 w-14 animate-pulse rounded bg-slate-100" />
                      <div className="space-y-2 py-1">
                        <div className="h-4 w-4/5 animate-pulse rounded bg-slate-100" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
                        <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : productError ? (
                <div className="rounded-md bg-red-50 px-3 py-3 text-sm text-red-700">{productError}</div>
              ) : products.length === 0 ? (
                <div className="flex min-h-[260px] items-center justify-center rounded-md border border-dashed border-slate-300 px-4 py-8 text-center">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      {sourceProductCount > 0
                        ? "Trang này không có sản phẩm còn tồn."
                        : "Không có sản phẩm phù hợp."}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {sourceProductCount > 0
                        ? "Hãy thử trang khác hoặc thay đổi từ khóa tìm kiếm."
                        : "Thử tìm bằng tên hoặc SKU khác."}
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

            <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-4 py-3">
              <button
                type="button"
                disabled={page <= 1 || isLoadingProducts}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Trước
              </button>
              <span className="text-sm text-slate-600">
                Trang {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages || isLoadingProducts}
                onClick={() => setPage((current) => (current < totalPages ? current + 1 : current))}
                className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
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
            <article className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <h3 className="break-words text-xl font-semibold text-slate-900">{selectedProduct.name}</h3>
                  <p className="mt-2 break-all text-sm text-slate-500">SKU: {selectedProduct.sku}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:min-w-80">
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Giá bán</p>
                    <p className={`mt-1 text-base font-bold ${getSalePriceTone(selectedProduct.sale_price)}`}>
                      {formatSalePrice(selectedProduct.sale_price)}
                    </p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tổng tồn</p>
                    <p className="mt-1 text-base font-bold text-brand-800">
                      {Number(selectedProduct.total_quantity || 0)}
                    </p>
                  </div>
                </div>
              </div>

              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-slate-900">Ảnh sản phẩm</h4>
                  <p className="text-xs text-slate-500">Tối đa 3 ảnh hiện có</p>
                </div>

                {isLoadingImages ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[1, 2, 3].map((item) => (
                      <div key={item} className="aspect-square animate-pulse rounded-md bg-slate-100" />
                    ))}
                  </div>
                ) : imageError ? (
                  <p className="rounded-md bg-red-50 px-3 py-3 text-sm text-red-700">{imageError}</p>
                ) : images.length === 0 ? (
                  <div className="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                    Sản phẩm này chưa có ảnh.
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {images.map((image, index) => (
                        <div key={image.id} className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-2">
                          <AuthenticatedImage
                            path={`/admin/products/${selectedProduct.id}/images/${image.id}/thumbnail`}
                            alt={`${selectedProduct.name} ${index + 1}`}
                            className="aspect-square w-full rounded border border-slate-200 bg-white object-contain"
                          />
                          <p className="mt-2 truncate text-xs text-slate-600" title={image.original_name}>
                            {image.original_name}
                          </p>
                          <button
                            type="button"
                            disabled={downloadingImageId === image.id}
                            onClick={() => handleDownloadImage(image)}
                            className="mt-2 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {downloadingImageId === image.id ? "Đang tải..." : "Tải ảnh gốc"}
                          </button>
                        </div>
                      ))}
                    </div>
                    {downloadError && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{downloadError}</p>}
                  </>
                )}
              </section>

              <section>
                <h4 className="text-sm font-semibold text-slate-900">Nhóm bảo hành / ghi chú</h4>
                <div className="mt-3 space-y-2">
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                    <input
                      type="radio"
                      name="online-listing-note-group"
                      value=""
                      checked={selectedNoteGroupIndex === ""}
                      onChange={handleNoteGroupChange}
                      className="h-4 w-4"
                    />
                    <span className="font-medium text-slate-700">Không đưa bảo hành/ghi chú vào tin</span>
                  </label>

                  {selectedNoteGroups.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {selectedNoteGroups.map((group, index) => (
                        <label
                          key={`${group.note_key || group.note || "empty"}-${group.quantity}`}
                          className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <input
                              type="radio"
                              name="online-listing-note-group"
                              value={String(index)}
                              checked={selectedNoteGroupIndex === String(index)}
                              onChange={handleNoteGroupChange}
                              className="h-4 w-4 shrink-0"
                            />
                            <span className="break-words font-medium text-slate-700">{formatNoteLabel(group)}</span>
                          </span>
                          <span className="shrink-0 font-bold text-brand-800">{Number(group.quantity || 0)}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-md border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500">
                      Chưa có tồn kho theo nhóm bảo hành / ghi chú.
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="text-base font-semibold text-slate-900">Bản nháp Chợ Tốt</h4>
                    <p className="mt-1 text-sm text-slate-500">
                      Nội dung chỉ nằm trên trình duyệt trong phiên làm việc này, chưa lưu vào hệ thống.
                    </p>
                  </div>
                  {(copyFeedback || copyError) && (
                    <p className={`text-sm font-medium ${copyError ? "text-red-700" : "text-emerald-700"}`}>
                      {copyError || copyFeedback}
                    </p>
                  )}
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.2fr)]">
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Giá đăng online</label>
                      <input
                        inputMode="numeric"
                        className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
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
                        <p className="mt-1 text-xs text-slate-500">
                          Giá này chỉ dùng cho tin đăng, không làm thay đổi giá bán tại cửa hàng.
                        </p>
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
                        className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                        value={titleDraft}
                        onChange={handleTitleChange}
                      />
                      {titleDraft.length > ONLINE_LISTING_TITLE_MAX_LENGTH && (
                        <p className="mt-1 text-xs font-medium text-amber-700">
                          Tiêu đề đang dài hơn giới hạn nội bộ tạm dùng, chưa phải giới hạn chính thức của Chợ Tốt.
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => copyText(titleDraft, "Đã sao chép tiêu đề")}
                          className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Sao chép tiêu đề
                        </button>
                        {isTitleEdited && (
                          <button
                            type="button"
                            onClick={handleRestoreTitle}
                            className="h-9 rounded-md border border-brand-200 bg-white px-3 text-sm font-medium text-brand-700 hover:bg-brand-50"
                          >
                            Khôi phục tiêu đề gợi ý
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <label className="block text-sm font-medium text-slate-700">Mô tả</label>
                      {isDescriptionEdited && (
                        <span className="text-xs font-medium text-amber-700">Đã sửa thủ công</span>
                      )}
                    </div>
                    <textarea
                      className="min-h-72 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-6 outline-none focus:ring-2 focus:ring-brand-500"
                      value={descriptionDraft}
                      onChange={handleDescriptionChange}
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => copyText(descriptionDraft, "Đã sao chép mô tả")}
                        className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Sao chép mô tả
                      </button>
                      {isDescriptionEdited && (
                        <button
                          type="button"
                          onClick={handleRegenerateDescription}
                          className="h-9 rounded-md border border-brand-200 bg-white px-3 text-sm font-medium text-brand-700 hover:bg-brand-50"
                          title="Tạo lại mô tả sẽ thay thế nội dung đang sửa."
                        >
                          Tạo lại mô tả
                        </button>
                      )}
                    </div>
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
