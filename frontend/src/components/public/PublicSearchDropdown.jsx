import { useEffect, useState } from "react";
import { resolveApiAssetUrl } from "../../api/apiClient";
import { listPublicProductImages } from "../../services/publicSearch.service";

export const PUBLIC_SEARCH_LISTBOX_ID = "public-live-search-results";

function formatPublicPrice(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "Liên hệ giá";
  return `${new Intl.NumberFormat("vi-VN").format(amount)}đ`;
}

function getThumbnailUrl(image) {
  return image?.thumbnail_url || image?.thumbnailUrl || "";
}

function ProductThumbnailPlaceholder() {
  return (
    <span
      aria-hidden="true"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-[#0b63f6] sm:h-12 sm:w-12 lg:h-14 lg:w-14"
    >
      <svg viewBox="0 0 32 32" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="5" y="6" width="22" height="16" rx="3" />
        <path d="M10 27h12m-9-5v5m6-5v5M9 11h7m-7 5h11" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function ProductThumbnail({ product }) {
  const initialThumbnailUrl = getThumbnailUrl(product?.primaryImage);
  const [thumbnailUrl, setThumbnailUrl] = useState(initialThumbnailUrl);
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let isCurrent = true;

    setHasImageError(false);
    setThumbnailUrl(initialThumbnailUrl);

    if (!initialThumbnailUrl && Number(product?.imageCount || 0) > 0) {
      listPublicProductImages(product.sku, { signal: controller.signal, timeoutMs: 12000 })
        .then((images) => {
          if (!isCurrent) return;
          const fallbackUrl = images.map(getThumbnailUrl).find(Boolean) || "";
          setThumbnailUrl(fallbackUrl);
        })
        .catch((error) => {
          if (isCurrent && error?.name !== "AbortError") setThumbnailUrl("");
        });
    }

    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [initialThumbnailUrl, product?.imageCount, product?.sku]);

  if (!thumbnailUrl || hasImageError) return <ProductThumbnailPlaceholder />;

  return (
    <img
      src={resolveApiAssetUrl(thumbnailUrl)}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      width="56"
      height="56"
      onError={(event) => {
        event.currentTarget.onerror = null;
        setHasImageError(true);
      }}
      className="h-11 w-11 shrink-0 rounded-xl border border-slate-200 bg-slate-50 object-contain p-1 sm:h-12 sm:w-12 lg:h-14 lg:w-14"
    />
  );
}

export function PublicSearchDropdown({
  activeIndex,
  errorMessage,
  hasHiddenOutOfStockMatches,
  isLoading,
  onActiveIndexChange,
  onSelectProduct,
  onViewAll,
  products,
  query,
  totalMatches
}) {
  const safeProducts = Array.isArray(products) ? products : [];
  const showViewAll = totalMatches > safeProducts.length;

  return (
    <div
      className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-full overflow-hidden rounded-2xl border border-[#bfd4ee] bg-white shadow-[0_16px_36px_rgba(15,47,95,0.16)]"
      aria-label={`Gợi ý tìm kiếm cho ${query}`}
    >
      {isLoading && safeProducts.length === 0 && (
        <p className="px-4 py-5 text-center text-sm font-medium text-slate-500">Đang tìm sản phẩm...</p>
      )}

      {!isLoading && errorMessage && (
        <p className="px-4 py-5 text-center text-sm font-medium text-slate-600">{errorMessage}</p>
      )}

      {!isLoading && !errorMessage && safeProducts.length === 0 && (
        <p className="px-4 py-5 text-center text-sm font-bold text-slate-700">
          {hasHiddenOutOfStockMatches ? "Sản phẩm hiện hết hàng" : "Không tìm thấy sản phẩm"}
        </p>
      )}

      {safeProducts.length > 0 && (
        <div id={PUBLIC_SEARCH_LISTBOX_ID} role="listbox" aria-label="Sản phẩm phù hợp">
          {safeProducts.map((product, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                id={`${PUBLIC_SEARCH_LISTBOX_ID}-option-${index}`}
                key={product.sku}
                type="button"
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => onActiveIndexChange(index)}
                onFocus={() => onActiveIndexChange(index)}
                onClick={() => onSelectProduct(product)}
                className={`flex min-h-16 w-full items-center gap-3 border-b border-slate-100 px-3 py-1.5 text-left last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0b63f6] sm:min-h-[4.125rem] sm:gap-3.5 sm:px-4 lg:min-h-[4.25rem] ${
                  isActive ? "bg-blue-50" : "bg-white hover:bg-slate-50"
                }`}
              >
                <ProductThumbnail product={product} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold leading-5 text-[#0f2f5f] sm:text-[15px] lg:text-base">
                    {product.name}
                  </span>
                  <span className="mt-1 flex min-w-0 items-center justify-between gap-2.5 sm:gap-3">
                    <span className="truncate text-[13px] font-extrabold leading-4 text-[#0b4fb3] sm:text-sm lg:text-[15px]">
                      {formatPublicPrice(product.salePrice)}
                    </span>
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[13px] font-bold leading-4 text-emerald-800 ring-1 ring-inset ring-emerald-300 sm:text-sm">
                      Tồn: {product.totalQuantity}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {showViewAll && (
        <button
          type="button"
          onClick={onViewAll}
          className="flex min-h-11 w-full items-center justify-center bg-[#f3f8ff] px-4 text-sm font-extrabold text-[#0b63f6] hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0b63f6]"
        >
          Xem tất cả {totalMatches} sản phẩm phù hợp
        </button>
      )}
    </div>
  );
}
