import { useEffect, useMemo, useRef, useState } from "react";
import { resolveApiAssetUrl } from "../api/apiClient";
import { listPublicProductImages } from "../services/publicSearch.service";
import {
  IMAGE_SHARE_ERROR_MESSAGE,
  IMAGE_SHARE_UNSUPPORTED_MESSAGE,
  sharePublicProductImages,
  supportsPublicImageFileSharing
} from "../utils/publicImageShare";
import {
  copyPublicImageToClipboard,
  IMAGE_COPY_ERROR_MESSAGE,
  IMAGE_COPY_UNSUPPORTED_MESSAGE
} from "../utils/publicImageClipboard";
import { normalizeOptionalProductDescription } from "../utils/publicProductPresentation";
import { formatWarrantyNote } from "../utils/warrantyNote";

const PUBLIC_IMAGE_LIST_TIMEOUT_MS = 20000;

function formatPublicPrice(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "Liên hệ giá";
  return `${new Intl.NumberFormat("vi-VN").format(amount)}đ`;
}

export function SearchResultCard({ product, autoExpand = false, eagerImage = false }) {
  const [expanded, setExpanded] = useState(autoExpand);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [images, setImages] = useState([]);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [imageError, setImageError] = useState("");
  const [shareFeedback, setShareFeedback] = useState("");
  const [isSharingImages, setIsSharingImages] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [copyingImageKeys, setCopyingImageKeys] = useState(() => new Set());
  const [imageCopyFeedback, setImageCopyFeedback] = useState({});
  const copyingImageKeysRef = useRef(new Set());
  const copyGenerationRef = useRef(0);
  const sortedNoteGroups = useMemo(
    () => [...(product.noteGroups || [])].sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0)),
    [product.noteGroups]
  );
  const hasNotes = sortedNoteGroups.length > 0;
  const totalQuantity = Number(product.totalQuantity || 0);
  const isInStock = totalQuantity > 0;
  const condition = product.condition === "2nd" || product.condition === "new" ? product.condition : null;
  const specSummary = normalizeOptionalProductDescription(product.specSummary);

  useEffect(() => {
    setExpanded(autoExpand);
    setImages([]);
    setIsGalleryOpen(false);
    setSelectedImageIndex(null);
    setShareFeedback("");
    setIsSharingImages(false);
    copyGenerationRef.current += 1;
    copyingImageKeysRef.current.clear();
    setCopyingImageKeys(new Set());
    setImageCopyFeedback({});
  }, [autoExpand, product.productId]);

  useEffect(() => () => {
    copyGenerationRef.current += 1;
  }, []);

  useEffect(() => {
    if (selectedImageIndex === null) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") setSelectedImageIndex(null);
      if (event.key === "ArrowLeft") {
        setSelectedImageIndex((current) => (current - 1 + images.length) % images.length);
      }
      if (event.key === "ArrowRight") {
        setSelectedImageIndex((current) => (current + 1) % images.length);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [images.length, selectedImageIndex]);

  async function handleCopyName(event) {
    event.stopPropagation();
    const text = product.name || "";
    if (!text) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopyFeedback("Đã copy tên sản phẩm");
      window.setTimeout(() => setCopyFeedback(""), 1800);
    } catch {
      setCopyFeedback("Không thể copy");
      window.setTimeout(() => setCopyFeedback(""), 1800);
    }
  }

  async function handleToggleGallery(event) {
    event.stopPropagation();
    const nextOpen = !isGalleryOpen;
    setIsGalleryOpen(nextOpen);
    if (!nextOpen || images.length > 0 || isLoadingImages) return;

    setIsLoadingImages(true);
    setImageError("");
    try {
      setImages(await listPublicProductImages(product.productId, { timeoutMs: PUBLIC_IMAGE_LIST_TIMEOUT_MS }));
    } catch (error) {
      setImageError(error?.message || "Không thể tải ảnh sản phẩm.");
    } finally {
      setIsLoadingImages(false);
    }
  }

  async function handleShareImages(event) {
    event.stopPropagation();
    if (isSharingImages || images.length === 0) return;

    if (!supportsPublicImageFileSharing()) {
      setShareFeedback(IMAGE_SHARE_UNSUPPORTED_MESSAGE);
      return;
    }

    setIsSharingImages(true);
    setShareFeedback("Đang chuẩn bị...");
    try {
      const shareResult = await sharePublicProductImages(product, images);
      if (shareResult === "unsupported") {
        setShareFeedback(IMAGE_SHARE_UNSUPPORTED_MESSAGE);
        return;
      }
      setShareFeedback("");
    } catch (error) {
      setShareFeedback(IMAGE_SHARE_ERROR_MESSAGE);
    } finally {
      setIsSharingImages(false);
    }
  }

  async function handleCopyImage(event, image, index) {
    event.stopPropagation();
    const imageKey = String(image?.id ?? index);
    if (copyingImageKeysRef.current.has(imageKey)) return;

    const generation = copyGenerationRef.current;
    copyingImageKeysRef.current.add(imageKey);
    setCopyingImageKeys((current) => new Set(current).add(imageKey));
    setImageCopyFeedback((current) => ({ ...current, [imageKey]: "" }));

    try {
      const result = await copyPublicImageToClipboard(resolveApiAssetUrl(image.download_url));
      if (generation !== copyGenerationRef.current) return;
      setImageCopyFeedback((current) => ({
        ...current,
        [imageKey]: result === "copied" ? "Đã copy ảnh" : IMAGE_COPY_UNSUPPORTED_MESSAGE
      }));
    } catch {
      if (generation !== copyGenerationRef.current) return;
      setImageCopyFeedback((current) => ({ ...current, [imageKey]: IMAGE_COPY_ERROR_MESSAGE }));
    } finally {
      copyingImageKeysRef.current.delete(imageKey);
      if (generation === copyGenerationRef.current) {
        setCopyingImageKeys((current) => {
          const next = new Set(current);
          next.delete(imageKey);
          return next;
        });
      }
    }
  }

  const selectedImage = selectedImageIndex === null ? null : images[selectedImageIndex];

  return (
    <>
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-sky-200 hover:shadow-md">
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap sm:justify-between sm:gap-4">
          {product.primaryImage && (
            <img
              src={resolveApiAssetUrl(product.primaryImage.thumbnail_url)}
              alt={product.name}
              loading={eagerImage ? "eager" : "lazy"}
              decoding="async"
              width="80"
              height="80"
              className="h-20 w-20 shrink-0 rounded-xl border border-slate-200 bg-slate-50 object-contain"
            />
          )}
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="min-w-0 flex-1 text-left"
            aria-expanded={expanded}
          >
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold leading-snug text-slate-950">{product.name}</h3>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                  isInStock ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {isInStock ? "Còn hàng" : "Hết hàng"}
              </span>
              {condition && (
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold text-white ${condition === "2nd" ? "bg-orange-500" : "bg-blue-600"}`}>
                  {condition}
                </span>
              )}
            </div>
            {(product.categoryName || specSummary) && (
              <div className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
                {product.categoryName && (
                  <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {product.categoryName}
                  </span>
                )}
                {specSummary && (
                  <span className="min-w-0 basis-full break-words text-sm font-medium leading-5 text-slate-600 sm:basis-auto sm:flex-1 sm:text-center">
                    {specSummary}
                  </span>
                )}
              </div>
            )}
            <p className="mt-2 text-base font-extrabold text-blue-700">{formatPublicPrice(product.salePrice)}</p>
          </button>

          <div className="flex w-full shrink-0 items-center justify-between rounded-xl bg-sky-50 px-3 py-2 text-left sm:block sm:w-auto sm:rounded-2xl sm:px-4 sm:py-3 sm:text-center">
            <p className="text-xl font-extrabold leading-none text-sky-700 sm:text-3xl">{totalQuantity}</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 sm:mt-1">Tổng tồn</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyName}
            className="min-h-10 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Copy tên
          </button>
          {product.imageCount > 0 && (
            <button
              type="button"
              onClick={handleToggleGallery}
              className="min-h-10 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-100"
            >
              {isGalleryOpen ? "Ẩn ảnh" : `Xem ảnh (${product.imageCount})`}
            </button>
          )}
          {copyFeedback && <span className="text-sm font-medium text-emerald-700">{copyFeedback}</span>}
        </div>

        {isGalleryOpen && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            {isLoadingImages && <p className="text-sm text-slate-500">Đang tải ảnh...</p>}
            {imageError && <p className="text-sm text-red-600">{imageError}</p>}
            {!isLoadingImages && !imageError && (
              <>
                {images.length > 0 && (
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleShareImages}
                      disabled={isSharingImages}
                      className="min-h-9 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-70"
                    >
                      {isSharingImages ? "Đang chuẩn bị..." : "Chia sẻ ảnh"}
                    </button>
                    {shareFeedback && (
                      <span className="text-xs font-medium text-slate-600">{shareFeedback}</span>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {images.map((image, index) => {
                    const imageKey = String(image?.id ?? index);
                    const isCopyingImage = copyingImageKeys.has(imageKey);
                    const copyStatus = imageCopyFeedback[imageKey] || "";
                    const didCopyImage = copyStatus === "Đã copy ảnh";

                    return (
                    <div key={image.id} className="min-w-0">
                      <button
                        type="button"
                        onClick={() => setSelectedImageIndex(index)}
                        className="group block w-full"
                        aria-label={`Xem lớn ảnh ${index + 1} của ${product.name}`}
                      >
                        <img
                          src={resolveApiAssetUrl(image.thumbnail_url)}
                          alt={`${product.name} ${image.sort_order}`}
                          loading="lazy"
                          decoding="async"
                          width="160"
                          height="160"
                          className="aspect-square w-full rounded-lg border border-slate-200 bg-slate-50 object-contain group-hover:border-sky-400"
                        />
                      </button>
                      <div className="mt-1 grid min-w-0 grid-cols-2 gap-1">
                        <a
                          href={resolveApiAssetUrl(image.download_url)}
                          className="inline-flex min-h-10 min-w-0 items-center justify-center rounded-md border border-sky-200 px-1 text-center text-[10px] font-semibold leading-tight text-sky-700 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 sm:text-xs"
                        >
                          Tải ảnh
                        </a>
                        <button
                          type="button"
                          onClick={(event) => handleCopyImage(event, image, index)}
                          disabled={isCopyingImage}
                          aria-label={`Copy ảnh ${index + 1}`}
                          aria-busy={isCopyingImage}
                          className="inline-flex min-h-10 min-w-0 items-center justify-center rounded-md border border-slate-200 px-1 text-center text-[10px] font-semibold leading-tight text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-wait disabled:opacity-70 sm:text-xs"
                        >
                          {isCopyingImage ? "Đang copy..." : didCopyImage ? "Đã copy ảnh" : "Copy ảnh"}
                        </button>
                      </div>
                      {copyStatus && !didCopyImage && (
                        <p className="mt-1 break-words text-[10px] leading-4 text-slate-600" role="status">
                          {copyStatus}
                        </p>
                      )}
                      {didCopyImage && <span className="sr-only" role="status">Đã copy ảnh</span>}
                    </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex min-h-11 w-full items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:px-5"
        aria-label={expanded ? "Thu gọn nhóm bảo hành / ghi chú" : "Mở nhóm bảo hành / ghi chú"}
      >
        <span>Nhóm bảo hành / ghi chú</span>
        <span className="text-lg leading-none text-slate-500">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 bg-white p-4 sm:p-5">
          {hasNotes ? (
            <ul className="space-y-2">
              {sortedNoteGroups.map((group) => (
                <li
                  key={`${product.productId}-${group.note ?? "empty"}`}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm"
                >
                  <span className="break-words font-semibold text-slate-800">
                    {formatWarrantyNote(group.label || group.note)}
                  </span>
                  <span className="shrink-0 font-bold text-sky-700">còn {Number(group.quantity || 0)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
              Chưa có tồn kho theo nhóm bảo hành / ghi chú.
            </p>
          )}
        </div>
      )}
    </article>

    {selectedImage && (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-3 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-label={`Gallery ảnh ${product.name}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) setSelectedImageIndex(null);
        }}
      >
        <div className="relative flex max-h-full w-full max-w-5xl flex-col rounded-xl bg-white p-3 shadow-2xl sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-semibold text-slate-800">
              {product.name} · Ảnh {selectedImageIndex + 1}/{images.length}
            </p>
            <button
              type="button"
              onClick={() => setSelectedImageIndex(null)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-2xl text-slate-500 hover:bg-slate-100"
              aria-label="Đóng gallery ảnh"
            >
              ×
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
            <img
              src={resolveApiAssetUrl(selectedImage.download_url)}
              alt={`${product.name} ${selectedImageIndex + 1}`}
              decoding="async"
              className="max-h-[70vh] max-w-full object-contain"
            />
          </div>
          <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedImageIndex((selectedImageIndex - 1 + images.length) % images.length)}
              className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← Trước
            </button>
            <a
              href={resolveApiAssetUrl(selectedImage.download_url)}
              className="justify-self-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
            >
              Tải ảnh
            </a>
            <button
              type="button"
              onClick={() => setSelectedImageIndex((selectedImageIndex + 1) % images.length)}
              className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Sau →
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
