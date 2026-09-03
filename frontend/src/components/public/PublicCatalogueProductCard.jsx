import { useEffect, useRef, useState } from "react";
import { resolveApiAssetUrl } from "../../api/apiClient";
import { listPublicProductImages } from "../../services/publicSearch.service";
import {
  IMAGE_SHARE_ERROR_MESSAGE,
  IMAGE_SHARE_UNSUPPORTED_MESSAGE,
  sharePublicProductImages,
  supportsPublicImageFileSharing
} from "../../utils/publicImageShare";
import { formatPublicSellingPrice } from "../../utils/publicProductPresentation";

const PUBLIC_IMAGE_LIST_TIMEOUT_MS = 20000;
function getProductCondition(condition) {
  if (condition === "2nd") return { label: "2nd", className: "bg-orange-500 text-white" };
  if (condition === "new") return { label: "new", className: "bg-[#0b63f6] text-white" };
  return null;
}

function getThumbnailUrl(image) {
  return image?.thumbnail_url || image?.thumbnailUrl || "";
}

function getResponseThumbnailUrl(product) {
  return getThumbnailUrl(product?.primaryImage) || getThumbnailUrl(product?.images?.[0]);
}

function getPlaceholderCategory(product) {
  const categoryName = String(product?.categoryName || "").trim();
  return categoryName || "Linh kiện PC";
}

function CategoryPlaceholder({ categoryName, status }) {
  const label = String(categoryName || "Sản phẩm").trim() || "Sản phẩm";

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#f3f8ff] to-white px-2 text-center">
      {status === "loading" ? (
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-blue-100 border-t-[#0b63f6]" aria-hidden="true" />
      ) : (
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-[#0b63f6]" aria-hidden="true">
          <svg viewBox="0 0 48 48" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="9" y="10" width="30" height="23" rx="4" />
            <path d="M16 39h16M19 33v6m10-6v6M14 17h8m-8 6h14" strokeLinecap="round" />
            <circle cx="33" cy="18" r="2" fill="currentColor" stroke="none" />
          </svg>
        </span>
      )}
      <span className="line-clamp-2 text-[11px] font-bold leading-4 text-[#0f2f5f] sm:text-xs">
        {status === "loading" ? "Đang tải ảnh..." : label}
      </span>
    </div>
  );
}

export function PublicCatalogueProductCard({ product, onViewDetails }) {
  const [isSharing, setIsSharing] = useState(false);
  const [shareFeedback, setShareFeedback] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState(() => getResponseThumbnailUrl(product));
  const [imageStatus, setImageStatus] = useState(() =>
    getResponseThumbnailUrl(product) ? "ready" : Number(product.imageCount || 0) > 0 ? "loading" : "missing"
  );
  const attemptedThumbnailUrlsRef = useRef(new Set());
  const thumbnailRequestIdRef = useRef(0);
  const condition = getProductCondition(product.condition);

  async function loadFallbackThumbnail() {
    const requestId = thumbnailRequestIdRef.current + 1;
    thumbnailRequestIdRef.current = requestId;
    setImageStatus("loading");

    try {
      const images = await listPublicProductImages(product.productId, { timeoutMs: PUBLIC_IMAGE_LIST_TIMEOUT_MS });
      if (thumbnailRequestIdRef.current !== requestId) return;

      const fallbackUrl = images
        .map(getThumbnailUrl)
        .find((url) => url && !attemptedThumbnailUrlsRef.current.has(url));

      if (fallbackUrl) {
        setThumbnailUrl(fallbackUrl);
        setImageStatus("ready");
      } else {
        setThumbnailUrl("");
        setImageStatus(images.length === 0 ? "missing" : "error");
      }
    } catch {
      if (thumbnailRequestIdRef.current === requestId) {
        setThumbnailUrl("");
        setImageStatus("error");
      }
    }
  }

  useEffect(() => {
    const responseThumbnailUrl = getResponseThumbnailUrl(product);
    attemptedThumbnailUrlsRef.current = new Set();
    thumbnailRequestIdRef.current += 1;

    if (responseThumbnailUrl) {
      setThumbnailUrl(responseThumbnailUrl);
      setImageStatus("ready");
    } else if (Number(product.imageCount || 0) > 0) {
      setThumbnailUrl("");
      loadFallbackThumbnail();
    } else {
      setThumbnailUrl("");
      setImageStatus("missing");
    }

    return () => {
      thumbnailRequestIdRef.current += 1;
    };
  }, [product.productId, product.imageCount, product.primaryImage]);

  function handleThumbnailError() {
    if (thumbnailUrl) attemptedThumbnailUrlsRef.current.add(thumbnailUrl);
    setThumbnailUrl("");
    loadFallbackThumbnail();
  }

  async function handleShareImages() {
    if (isSharing) return;
    if (!supportsPublicImageFileSharing()) {
      setShareFeedback(IMAGE_SHARE_UNSUPPORTED_MESSAGE);
      return;
    }

    setIsSharing(true);
    setShareFeedback("Đang chuẩn bị...");
    try {
      const images = await listPublicProductImages(product.productId, { timeoutMs: PUBLIC_IMAGE_LIST_TIMEOUT_MS });
      if (!images.length) {
        setShareFeedback("Sản phẩm chưa có ảnh để chia sẻ.");
        return;
      }

      const result = await sharePublicProductImages(product, images);
      setShareFeedback(result === "unsupported" ? IMAGE_SHARE_UNSUPPORTED_MESSAGE : "");
    } catch {
      setShareFeedback(IMAGE_SHARE_ERROR_MESSAGE);
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <article
      className="grid h-full min-w-0 grid-cols-[96px_minmax(0,1fr)] overflow-hidden rounded-xl border border-[#d6e4f5] bg-white shadow-[0_4px_14px_rgba(15,47,95,0.07)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_10px_24px_rgba(15,47,95,0.11)] sm:flex sm:flex-col"
    >
      <div
        className="relative min-h-[132px] overflow-hidden border-r border-[#e8f0fa] bg-slate-50 sm:h-28 sm:min-h-0 sm:border-b sm:border-r-0"
      >
        {thumbnailUrl && imageStatus === "ready" ? (
          <img
            src={resolveApiAssetUrl(thumbnailUrl)}
            alt={product.name}
            crossOrigin="anonymous"
            loading="lazy"
            decoding="async"
            width="320"
            height="240"
            onError={handleThumbnailError}
            className="h-full w-full object-contain p-1.5 sm:p-2"
          />
        ) : (
          <CategoryPlaceholder categoryName={getPlaceholderCategory(product)} status={imageStatus} />
        )}
        {condition && (
          <span className={`absolute left-2 top-2 rounded-md px-2 py-1 text-[10px] font-extrabold ${condition.className}`}>
            {condition.label}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-2">
        <h3
          className="line-clamp-2 min-h-8 text-[13px] font-extrabold leading-4 text-[#0f2f5f]"
          title={product.name}
        >
          {product.name}
        </h3>
        <p className="mt-0.5 text-xs font-black leading-4 text-[#0755c7] sm:text-[13px]">
          {formatPublicSellingPrice(product.salePrice)}
        </p>

        <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px] sm:text-xs">
          <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-bold leading-[18px] text-emerald-700">Còn hàng</span>
          <span className="font-semibold text-slate-600">Tồn: {product.totalQuantity}</span>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-1.5 pt-1.5">
          <button
            type="button"
            onClick={() => onViewDetails(product)}
            className="min-h-[30px] whitespace-nowrap rounded-lg border border-blue-200 bg-white px-1 text-[10px] font-bold text-[#0b63f6] shadow-[0_2px_5px_rgba(11,99,246,0.05)] hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b63f6] sm:text-[11px]"
          >
            Xem chi tiết
          </button>
          <button
            type="button"
            onClick={handleShareImages}
            disabled={isSharing}
            className="min-h-[30px] whitespace-nowrap rounded-lg border border-blue-200 bg-white px-1 text-[10px] font-bold text-[#0b63f6] shadow-[0_2px_5px_rgba(11,99,246,0.05)] hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b63f6] disabled:cursor-not-allowed disabled:opacity-60 sm:text-[11px]"
          >
            {isSharing ? "Đang chuẩn bị" : "Chia sẻ ảnh"}
          </button>
        </div>

        {shareFeedback && <p className="mt-2 text-[10px] leading-4 text-slate-600">{shareFeedback}</p>}
      </div>
    </article>
  );
}
