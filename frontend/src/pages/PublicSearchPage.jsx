import { useEffect, useRef, useState } from "react";
import { SearchResultCard } from "../components/SearchResultCard";
import { PublicAvailableProductsSection } from "../components/public/PublicAvailableProductsSection";
import { PublicCatalogueHeader } from "../components/public/PublicCatalogueHeader";
import { PublicCatalogueHero } from "../components/public/PublicCatalogueHero";
import { PublicCategoryNav } from "../components/public/PublicCategoryNav";
import {
  listAvailableCatalogueProducts,
  listPublicCategories,
  searchPublicProducts
} from "../services/publicSearch.service";

const SEARCH_HISTORY_KEY = "public_search_history";
const IOS_INSTALL_DISMISSED_KEY = "public_ios_install_dismissed_at";
const MAX_HISTORY_ITEMS = 10;
const PUBLIC_SEARCH_TIMEOUT_MS = 20000;
const PUBLIC_SEARCH_RESUME_AFTER_MS = 25000;
const IOS_INSTALL_DISMISS_MS = 14 * 24 * 60 * 60 * 1000;
const PUBLIC_SEARCH_ERROR_MESSAGE = "Mạng đang chậm, vui lòng thử lại.";
const EMPTY_CATALOGUE_SECTIONS = Object.freeze({ newest: [], secondhand: [], new: [] });

function isTechnicalCatalogueSearch(value) {
  return /^__catalogue_/i.test(String(value || "").trim());
}

function sanitizeSearchHistory(items) {
  return items
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item && !isTechnicalCatalogueSearch(item))
    .slice(0, MAX_HISTORY_ITEMS);
}

function loadSearchHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || "[]");
    const sanitized = Array.isArray(parsed) ? sanitizeSearchHistory(parsed) : [];
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(sanitized));
    return sanitized;
  } catch {
    return [];
  }
}

function saveSearchHistory(items) {
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(sanitizeSearchHistory(items)));
  } catch {
    // Search remains usable when storage is unavailable.
  }
}

function addKeywordToHistory(searchInput, currentHistory) {
  const trimmed = searchInput.trim();
  if (!trimmed || isTechnicalCatalogueSearch(trimmed)) return sanitizeSearchHistory(currentHistory);

  const nextHistory = sanitizeSearchHistory([
    trimmed,
    ...currentHistory.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())
  ]);
  saveSearchHistory(nextHistory);
  return nextHistory;
}

function isStandaloneDisplayMode() {
  return Boolean(
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator?.standalone === true
  );
}

function isIOSSafariInstallContext() {
  const userAgent = window.navigator?.userAgent || "";
  const platform = window.navigator?.platform || "";
  const isIOSDevice = /iPad|iPhone|iPod/i.test(userAgent) || (platform === "MacIntel" && window.navigator?.maxTouchPoints > 1);
  const isSafariCompatible =
    /Version\/[\d.]+.*Safari/i.test(userAgent) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|GSA/i.test(userAgent);
  return isIOSDevice && isSafariCompatible && !isStandaloneDisplayMode();
}

function shouldShowIOSInstallGuide() {
  if (!isIOSSafariInstallContext()) return false;

  try {
    const dismissedAt = Number(localStorage.getItem(IOS_INSTALL_DISMISSED_KEY) || 0);
    return !dismissedAt || Date.now() - dismissedAt >= IOS_INSTALL_DISMISS_MS;
  } catch {
    return true;
  }
}

export function PublicSearchPage() {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [results, setResults] = useState([]);
  const [categories, setCategories] = useState([]);
  const [catalogueSections, setCatalogueSections] = useState(EMPTY_CATALOGUE_SECTIONS);
  const [isCatalogueLoading, setIsCatalogueLoading] = useState(true);
  const [hasHiddenOutOfStockMatches, setHasHiddenOutOfStockMatches] = useState(false);
  const [history, setHistory] = useState(() => loadSearchHistory());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [showIOSInstallGuide, setShowIOSInstallGuide] = useState(() => shouldShowIOSInstallGuide());
  const inputRef = useRef(null);
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef(null);
  const debouncedKeywordRef = useRef("");
  const isLoadingRef = useRef(false);
  const hiddenAtRef = useRef(0);
  const wasPendingWhenHiddenRef = useRef(false);
  const shouldRecoverAfterOnlineRef = useRef(false);
  const resumeSearchKeyRef = useRef("");
  const resumeRevalidationPendingRef = useRef(false);
  const resultsKeywordRef = useRef("");

  const trimmedKeyword = searchInput.trim();
  const hasSearched = debouncedKeyword.trim().length > 0;

  useEffect(() => {
    debouncedKeywordRef.current = debouncedKeyword;
  }, [debouncedKeyword]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    let active = true;
    listPublicCategories()
      .then((items) => {
        if (active) setCategories(items);
      })
      .catch(() => {
        if (active) setCategories([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    listAvailableCatalogueProducts()
      .then((items) => {
        if (active) setCatalogueSections(items);
      })
      .catch(() => {
        if (active) setCatalogueSections(EMPTY_CATALOGUE_SECTIONS);
      })
      .finally(() => {
        if (active) setIsCatalogueLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const searchKeyword = debouncedKeyword.trim();

    if (!searchKeyword) {
      requestIdRef.current += 1;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      resumeRevalidationPendingRef.current = false;
      resultsKeywordRef.current = "";
      setResults([]);
      setHasHiddenOutOfStockMatches(false);
      setError("");
      setIsLoading(false);
      return undefined;
    }

    const currentRequestId = requestIdRef.current + 1;
    requestIdRef.current = currentRequestId;
    const abortController = new AbortController();
    abortControllerRef.current?.abort();
    abortControllerRef.current = abortController;

    async function runSearch() {
      setIsLoading(true);
      setError("");
      if (resultsKeywordRef.current !== searchKeyword) {
        setResults([]);
        setHasHiddenOutOfStockMatches(false);
      }
      try {
        const searchResult = await searchPublicProducts(searchKeyword, {
          signal: abortController.signal,
          timeoutMs: PUBLIC_SEARCH_TIMEOUT_MS
        });
        if (!abortController.signal.aborted && requestIdRef.current === currentRequestId) {
          resultsKeywordRef.current = searchKeyword;
          setResults(searchResult.products);
          setHasHiddenOutOfStockMatches(searchResult.hasHiddenOutOfStockMatches);
        }
      } catch (err) {
        if (!abortController.signal.aborted && requestIdRef.current === currentRequestId) {
          if (resultsKeywordRef.current !== searchKeyword) {
            setResults([]);
            setHasHiddenOutOfStockMatches(false);
          }
          setError(PUBLIC_SEARCH_ERROR_MESSAGE);
        }
      } finally {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
        if (requestIdRef.current === currentRequestId) {
          resumeRevalidationPendingRef.current = false;
        }
        if (!abortController.signal.aborted && requestIdRef.current === currentRequestId) {
          setIsLoading(false);
        }
      }
    }

    runSearch();
    return () => {
      abortController.abort();
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    };
  }, [debouncedKeyword, retryCount]);

  useEffect(() => {
    function recoverCurrentSearch() {
      const searchKeyword = debouncedKeywordRef.current.trim();
      if (!searchKeyword) return;
      if (resumeRevalidationPendingRef.current) return;

      const resumeKey = `${searchKeyword}:${requestIdRef.current}`;
      if (resumeSearchKeyRef.current === resumeKey) return;
      resumeSearchKeyRef.current = resumeKey;
      resumeRevalidationPendingRef.current = true;
      setRetryCount((current) => current + 1);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        wasPendingWhenHiddenRef.current = Boolean(abortControllerRef.current) || isLoadingRef.current;
        resumeSearchKeyRef.current = "";
        resumeRevalidationPendingRef.current = false;
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        requestIdRef.current += 1;
        return;
      }

      if (document.visibilityState !== "visible") return;

      const hiddenDuration = hiddenAtRef.current ? Date.now() - hiddenAtRef.current : 0;
      const shouldRecover =
        wasPendingWhenHiddenRef.current ||
        isLoadingRef.current ||
        shouldRecoverAfterOnlineRef.current ||
        hiddenDuration >= PUBLIC_SEARCH_RESUME_AFTER_MS;

      wasPendingWhenHiddenRef.current = false;
      shouldRecoverAfterOnlineRef.current = false;

      if (shouldRecover) {
        recoverCurrentSearch();
      }
    }

    function handleOffline() {
      shouldRecoverAfterOnlineRef.current = true;
      if (document.visibilityState === "hidden") {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        requestIdRef.current += 1;
      }
    }

    function handleOnline() {
      shouldRecoverAfterOnlineRef.current = true;
      if (document.visibilityState === "visible") {
        recoverCurrentSearch();
      }
    }

    function handlePageShow(event) {
      if (event.persisted) {
        recoverCurrentSearch();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  function rememberKeyword(value = searchInput) {
    setHistory((currentHistory) => addKeywordToHistory(value, currentHistory));
  }

  function submitSearch(value = searchInput) {
    const nextKeyword = value.trim();
    setDebouncedKeyword(nextKeyword);
    rememberKeyword(nextKeyword);
  }

  function handleRetrySearch() {
    setRetryCount((current) => current + 1);
  }

  function handleClearSearch() {
    rememberKeyword(searchInput);
    setSearchInput("");
    setDebouncedKeyword("");
    resultsKeywordRef.current = "";
    setResults([]);
    setHasHiddenOutOfStockMatches(false);
    setError("");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleHistoryClick(value) {
    const nextKeyword = value.trim();
    setHistory((currentHistory) => addKeywordToHistory(nextKeyword, currentHistory));
    setSearchInput(nextKeyword);
    setDebouncedKeyword(nextKeyword);
    inputRef.current?.focus();
  }

  function handleRemoveHistoryItem(value) {
    setHistory((currentHistory) => {
      const nextHistory = currentHistory.filter((item) => item !== value);
      saveSearchHistory(nextHistory);
      return nextHistory;
    });
  }

  function handleClearHistory() {
    saveSearchHistory([]);
    setHistory([]);
  }

  function handleCatalogueProductDetails(product) {
    setSearchInput(product.sku);
    submitSearch(product.sku);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleDismissIOSInstallGuide() {
    try {
      localStorage.setItem(IOS_INSTALL_DISMISSED_KEY, String(Date.now()));
    } catch {
      // Ignore storage failures; dismiss for the current session.
    }
    setShowIOSInstallGuide(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <PublicCatalogueHeader
        inputRef={inputRef}
        isLoading={isLoading}
        onClear={handleClearSearch}
        onInputBlur={rememberKeyword}
        onInputChange={setSearchInput}
        onSubmit={submitSearch}
        searchInput={searchInput}
      />
      <PublicCategoryNav categories={categories} />

      <main className="mx-auto w-[min(calc(100%_-_clamp(2rem,3vw,6rem)),clamp(80rem,86vw,131.25rem))] pb-10 pt-[clamp(1rem,1.3vw,1.75rem)] sm:pb-14">
        {!trimmedKeyword && <PublicCatalogueHero />}

        {showIOSInstallGuide && (
          <section className="mx-auto mt-4 max-w-3xl rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-sky-800">Cài ứng dụng trên iPhone</p>
                <p className="mt-1 text-sm leading-5 text-sky-700">
                  Nhấn Chia sẻ, sau đó chọn “Thêm vào Màn hình chính”.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDismissIOSInstallGuide}
                className="shrink-0 rounded-full px-2 py-1 text-sm font-bold text-sky-700 hover:bg-sky-100"
                aria-label="Ẩn hướng dẫn cài ứng dụng trên iPhone"
              >
                ×
              </button>
            </div>
          </section>
        )}

        {!trimmedKeyword && (
          <PublicAvailableProductsSection
            isLoading={isCatalogueLoading}
            onViewDetails={handleCatalogueProductDetails}
            sections={catalogueSections}
          />
        )}

        {!trimmedKeyword && history.length > 0 && (
          <section className="mt-5 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-600">Lịch sử tìm kiếm</h2>
              <button type="button" onClick={handleClearHistory} className="text-xs font-medium text-slate-500 hover:text-slate-800">
                Xóa lịch sử
              </button>
            </div>
            <div className="mt-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex w-max gap-2 pb-0.5">
                {history.map((item) => (
                  <span
                    key={item}
                    className="inline-flex min-h-8 items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600"
                  >
                    <button type="button" onClick={() => handleHistoryClick(item)} className="py-1.5 hover:text-[#0b63f6]">
                      {item}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveHistoryItem(item)}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                      aria-label={`Xóa ${item} khỏi lịch sử`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}

        {!trimmedKeyword && (
          <footer className="mt-5 rounded-xl border border-blue-100 bg-[#f3f8ff] px-4 py-3 text-[#0f2f5f]">
            <div className="grid gap-2 text-xs font-semibold sm:grid-cols-3 sm:gap-4">
              {[
                "Kiểm tra kỹ trước khi bán",
                "Bảo hành được ghi rõ theo từng sản phẩm",
                "Hỗ trợ tra cứu nhanh"
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-[#0b63f6]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </footer>
        )}

        {hasSearched && (
          <section className="mt-6 sm:mt-8">
            <div className="mx-auto mb-4 flex max-w-5xl items-center justify-between gap-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                Kết quả tra cứu {results.length > 0 ? `(${results.length})` : ""}
              </h2>
            </div>

            {isLoading && results.length === 0 && (
              <div className="mx-auto grid max-w-5xl gap-3 md:grid-cols-2">
                {[1, 2, 3, 4].map((skeleton) => (
                  <div key={skeleton} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="h-6 w-2/3 rounded bg-slate-200" />
                    <div className="mt-3 h-4 w-1/2 rounded bg-slate-200" />
                    <div className="mt-4 h-12 rounded bg-slate-100" />
                  </div>
                ))}
              </div>
            )}

            {!isLoading && error && (
              <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm font-medium text-red-700">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={handleRetrySearch}
                  className="mt-3 rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
                >
                  Thử lại
                </button>
              </div>
            )}

            {!isLoading && !error && results.length === 0 && (
              <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white px-4 py-12 text-center shadow-sm">
                {hasHiddenOutOfStockMatches ? (
                  <>
                    <p className="text-base font-bold text-slate-800">Sản phẩm hiện hết hàng</p>
                    <p className="mt-2 text-sm text-slate-500">
                      Shop hiện chưa còn tồn cho từ khóa này. Vui lòng liên hệ để kiểm tra thêm.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-base font-bold text-slate-800">Không tìm thấy sản phẩm</p>
                    <p className="mt-2 text-sm text-slate-500">
                      Bạn thử kiểm tra lại từ khóa, mã SKU hoặc tên sản phẩm.
                    </p>
                  </>
                )}
              </div>
            )}

            {!error && results.length > 0 && (
              <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2">
                {results.map((item, index) => (
                  <SearchResultCard
                    key={item.id || item.sku}
                    product={item}
                    autoExpand={results.length === 1}
                    eagerImage={index === 0}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
