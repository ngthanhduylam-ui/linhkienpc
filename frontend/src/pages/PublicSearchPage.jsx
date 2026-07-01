import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { SearchResultCard } from "../components/SearchResultCard";
import { searchPublicProducts } from "../services/publicSearch.service";

const SEARCH_HISTORY_KEY = "public_search_history";
const MAX_HISTORY_ITEMS = 10;
const PUBLIC_SEARCH_TIMEOUT_MS = 20000;
const PUBLIC_SEARCH_ERROR_MESSAGE = "Mạng đang chậm, vui lòng thử lại.";

function loadSearchHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function saveSearchHistory(items) {
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS)));
}

function addKeywordToHistory(searchInput, currentHistory) {
  const trimmed = searchInput.trim();
  if (!trimmed) return currentHistory;

  const nextHistory = [trimmed, ...currentHistory.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(
    0,
    MAX_HISTORY_ITEMS
  );
  saveSearchHistory(nextHistory);
  return nextHistory;
}

export function PublicSearchPage() {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [results, setResults] = useState([]);
  const [history, setHistory] = useState(() => loadSearchHistory());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const inputRef = useRef(null);
  const requestIdRef = useRef(0);

  const trimmedKeyword = searchInput.trim();
  const hasSearched = debouncedKeyword.trim().length > 0;

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
      setResults([]);
      setError("");
      setIsLoading(false);
      return undefined;
    }

    const currentRequestId = requestIdRef.current + 1;
    requestIdRef.current = currentRequestId;
    const abortController = new AbortController();

    async function runSearch() {
      setIsLoading(true);
      setError("");
      try {
        const data = await searchPublicProducts(searchKeyword, {
          signal: abortController.signal,
          timeoutMs: PUBLIC_SEARCH_TIMEOUT_MS
        });
        if (!abortController.signal.aborted && requestIdRef.current === currentRequestId) {
          setResults(data);
        }
      } catch (err) {
        if (!abortController.signal.aborted && requestIdRef.current === currentRequestId) {
          setResults([]);
          setError(PUBLIC_SEARCH_ERROR_MESSAGE);
        }
      } finally {
        if (!abortController.signal.aborted && requestIdRef.current === currentRequestId) {
          setIsLoading(false);
        }
      }
    }

    runSearch();
    return () => {
      abortController.abort();
    };
  }, [debouncedKeyword, retryCount]);

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
    setResults([]);
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div>
            <p className="text-base font-extrabold tracking-wide text-sky-800 sm:text-lg">VI TÍNH PHƯỚC TÀI</p>
            <p className="text-xs font-medium text-slate-500 sm:text-sm">Tra cứu tồn kho linh kiện PC</p>
          </div>
          <Link
            to="/admin/login"
            className="shrink-0 rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-bold text-sky-700 shadow-sm hover:bg-sky-50"
          >
            Đăng nhập quản trị
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-6 sm:pb-14 sm:pt-10">
        <section className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-sky-700">
            Kiểm tra nhanh
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">
            Tra cứu tồn kho linh kiện PC
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            Nhập tên sản phẩm, SKU hoặc ghi chú bảo hành để kiểm tra số lượng còn trong kho.
          </p>

          <form
            className="mt-6 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
            onSubmit={(event) => {
              event.preventDefault();
              submitSearch(searchInput);
            }}
          >
            <label className="sr-only" htmlFor="public-product-search">
              Tìm sản phẩm
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <input
                  id="public-product-search"
                  ref={inputRef}
                  className="h-14 w-full rounded-2xl border border-slate-300 bg-white px-4 pr-12 text-base font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 sm:h-16 sm:text-lg"
                  placeholder="Tìm theo tên sản phẩm, SKU hoặc ghi chú bảo hành"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onBlur={() => rememberKeyword(searchInput)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      submitSearch(searchInput);
                    }
                  }}
                />

                {searchInput.trim() && (
                  <button
                    type="button"
                    aria-label="Xóa tìm kiếm"
                    onClick={handleClearSearch}
                    className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    ×
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="h-12 rounded-2xl bg-sky-600 px-6 text-sm font-extrabold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:h-16 sm:min-w-32 sm:text-base"
                disabled={!trimmedKeyword || isLoading}
              >
                {isLoading ? "Đang tìm..." : "Tìm kiếm"}
              </button>
            </div>
            <p className="mt-3 text-left text-xs leading-5 text-slate-500 sm:text-sm">
              Tìm theo tên sản phẩm, SKU hoặc ghi chú bảo hành. Ví dụ: 12400f, ddr4, b365...
            </p>
          </form>
        </section>

        {!trimmedKeyword && (
          <section className="mx-auto mt-5 max-w-3xl rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 sm:px-6">
            <h2 className="text-sm font-bold text-slate-800">Cách tra cứu</h2>
            <div className="mt-3 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
              <p className="rounded-xl bg-slate-50 px-4 py-3">Gõ tên sản phẩm hoặc model cần kiểm tra.</p>
              <p className="rounded-xl bg-slate-50 px-4 py-3">Dùng SKU nếu cần tìm chính xác hơn.</p>
              <p className="rounded-xl bg-slate-50 px-4 py-3">Xem tồn theo từng nhóm bảo hành / ghi chú.</p>
            </div>
          </section>
        )}

        {!trimmedKeyword && history.length > 0 && (
          <section className="mx-auto mt-5 max-w-3xl rounded-2xl border border-slate-200 bg-white px-4 py-5 shadow-sm sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-slate-800">Lịch sử tìm kiếm</h2>
              <button type="button" onClick={handleClearHistory} className="text-xs font-medium text-slate-500 hover:text-slate-800">
                Xóa lịch sử
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {history.map((item) => (
                <span
                  key={item}
                  className="inline-flex min-h-10 items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700"
                >
                  <button type="button" onClick={() => handleHistoryClick(item)} className="py-2 hover:text-sky-700">
                    {item}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveHistoryItem(item)}
                    className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                    aria-label={`Xóa ${item} khỏi lịch sử`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </section>
        )}

        {hasSearched && (
          <section className="mt-6 sm:mt-8">
            <div className="mx-auto mb-4 flex max-w-5xl items-center justify-between gap-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                Kết quả tra cứu {results.length > 0 ? `(${results.length})` : ""}
              </h2>
            </div>

            {isLoading && (
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
                <p className="text-base font-bold text-slate-800">Không tìm thấy sản phẩm phù hợp.</p>
                <p className="mt-2 text-sm text-slate-500">Thử tìm bằng SKU, tên model ngắn hơn hoặc ghi chú bảo hành.</p>
              </div>
            )}

            {!isLoading && !error && results.length > 0 && (
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
