import { useEffect, useRef, useState } from "react";
import { resolveApiAssetUrl } from "../../api/apiClient";
import { listPublicProductImages } from "../../services/publicSearch.service";
import {
  IMAGE_SHARE_ERROR_MESSAGE,
  IMAGE_SHARE_UNSUPPORTED_MESSAGE,
  sharePublicProductImages,
  supportsPublicImageFileSharing
} from "../../utils/publicImageShare";

const PUBLIC_IMAGE_LIST_TIMEOUT_MS = 20000;

function getProductCondition(sku) {
  const firstToken = String(sku || "").trim().toLowerCase().split(/[.\s_-]+/)[0];
  if (firstToken === "2nd") return { label: "2nd", className: "bg-orange-500 text-white" };
  if (firstToken === "new") return { label: "new", className: "bg-[#0b63f6] text-white" };
  return null;
}

function getThumbnailUrl(image) {
  return image?.thumbnail_url || image?.thumbnailUrl || "";
}

function getResponseThumbnailUrl(product) {
  return getThumbnailUrl(product?.primaryImage) || getThumbnailUrl(product?.images?.[0]);
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
  const condition = getProductCondition(product.sku);

  async function loadFallbackThumbnail() {
    const requestId = thumbnailRequestIdRef.current + 1;
    thumbnailRequestIdRef.current = requestId;
    setImageStatus("loading");

    try {
      const images = await listPublicProductImages(product.sku, { timeoutMs: PUBLIC_IMAGE_LIST_TIMEOUT_MS });
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
  }, [product.sku, product.imageCount, product.primaryImage]);

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
      const images = await listPublicProductImages(product.sku, { timeoutMs: PUBLIC_IMAGE_LIST_TIMEOUT_MS });
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
    <article className="grid h-full min-w-0 grid-cols-[104px_minmax(0,1fr)] overflow-hidden rounded-2xl border border-[#d9e6f5] bg-white shadow-[0_3px_12px_rgba(15,47,95,0.06)] sm:flex sm:flex-col">
      <div className="relative min-h-40 overflow-hidden border-r border-[#e8f0fa] bg-slate-50 sm:aspect-[4/3] sm:min-h-0 sm:border-b sm:border-r-0">
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
            className="h-full w-full object-contain p-2"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-2 text-center text-xs font-medium text-slate-400">
            {imageStatus === "loading" ? "Đang tải ảnh..." : imageStatus === "error" ? "Không tải được ảnh" : "Chưa có ảnh"}
          </div>
        )}
        {condition && (
          <span className={`absolute left-2 top-2 rounded-md px-2 py-1 text-[10px] font-extrabold ${condition.className}`}>
            {condition.label}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-3">
        <h3 className="line-clamp-2 text-sm font-bold leading-5 text-[#0f2f5f] sm:min-h-10" title={product.name}>
          {product.name}
        </h3>
        <p className="mt-1 truncate text-[11px] font-medium text-slate-500" title={product.sku}>
          SKU: {product.sku}
        </p>

        <div className="mt-3 flex items-center justify-between gap-2 text-[11px]">
          <span className="rounded-md bg-emerald-50 px-2 py-1 font-bold text-emerald-700">Còn hàng</span>
          <span className="font-semibold text-slate-600">Tồn: {product.totalQuantity}</span>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
          <button
            type="button"
            onClick={() => onViewDetails(product)}
            className="min-h-10 whitespace-nowrap rounded-lg border border-blue-200 bg-white px-2 text-xs font-bold text-[#0b63f6] hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b63f6]"
          >
            Xem chi tiết
          </button>
          <button
            type="button"
            onClick={handleShareImages}
            disabled={isSharing}
            className="min-h-10 whitespace-nowrap rounded-lg border border-blue-200 bg-white px-2 text-xs font-bold text-[#0b63f6] hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b63f6] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSharing ? "Đang chuẩn bị" : "Chia sẻ ảnh"}
          </button>
        </div>

        {shareFeedback && <p className="mt-2 text-[10px] leading-4 text-slate-600">{shareFeedback}</p>}
      </div>
    </article>
  );
}
