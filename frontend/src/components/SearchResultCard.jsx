import { useEffect, useMemo, useState } from "react";
import { resolveApiAssetUrl } from "../api/apiClient";
import { listPublicProductImages } from "../services/publicSearch.service";
import { formatWarrantyNote } from "../utils/warrantyNote";

export function SearchResultCard({ product, autoExpand = false }) {
  const [expanded, setExpanded] = useState(autoExpand);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [images, setImages] = useState([]);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [imageError, setImageError] = useState("");
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const sortedNoteGroups = useMemo(
    () => [...(product.noteGroups || [])].sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0)),
    [product.noteGroups]
  );
  const hasNotes = sortedNoteGroups.length > 0;
  const totalQuantity = Number(product.totalQuantity || 0);
  const isInStock = totalQuantity > 0;

  useEffect(() => {
    setExpanded(autoExpand);
    setImages([]);
    setIsGalleryOpen(false);
    setSelectedImageIndex(null);
  }, [autoExpand, product.sku]);

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
      setImages(await listPublicProductImages(product.sku));
    } catch (error) {
      setImageError(error?.message || "Không thể tải ảnh sản phẩm.");
    } finally {
      setIsLoadingImages(false);
    }
  }

  const selectedImage = selectedImageIndex === null ? null : images[selectedImageIndex];

  return (
    <>
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-sky-200 hover:shadow-md">
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          {product.primaryImage && (
            <img
              src={resolveApiAssetUrl(product.primaryImage.thumbnail_url)}
              alt={product.name}
              loading="lazy"
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
            </div>
            <p className="mt-2 break-all text-sm font-medium text-slate-500">{product.sku}</p>
            {product.categoryName && (
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{product.categoryName}</p>
            )}
          </button>

          <div className="shrink-0 rounded-2xl bg-sky-50 px-4 py-3 text-center">
            <p className="text-3xl font-extrabold leading-none text-sky-700">{totalQuantity}</p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Tổng tồn</p>
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
              <div className="grid grid-cols-3 gap-2">
                {images.map((image, index) => (
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
                        className="aspect-square w-full rounded-lg border border-slate-200 bg-slate-50 object-contain group-hover:border-sky-400"
                      />
                    </button>
                    <a
                      href={resolveApiAssetUrl(image.download_url)}
                      className="mt-1 block truncate text-center text-xs font-medium text-sky-700 hover:underline"
                    >
                      Tải ảnh
                    </a>
                  </div>
                ))}
              </div>
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
                  key={`${product.sku}-${group.note ?? "empty"}`}
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
