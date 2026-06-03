import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { SearchResultCard } from "../components/SearchResultCard";
import { searchPublicProducts } from "../services/publicSearch.service";

const SEARCH_HISTORY_KEY = "public_search_history";
const MAX_HISTORY_ITEMS = 10;

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
    let isCancelled = false;

    async function runSearch() {
      setIsLoading(true);
      setError("");
      try {
        const data = await searchPublicProducts(searchKeyword);
        if (!isCancelled && requestIdRef.current === currentRequestId) {
          setResults(data);
        }
      } catch (err) {
        if (!isCancelled && requestIdRef.current === currentRequestId) {
          setResults([]);
          setError(err?.message || "Không thể tải dữ liệu tồn kho.");
        }
      } finally {
        if (!isCancelled && requestIdRef.current === currentRequestId) {
          setIsLoading(false);
        }
      }
    }

    runSearch();
    return () => {
      isCancelled = true;
    };
  }, [debouncedKeyword]);

  function rememberKeyword(value = searchInput) {
    setHistory((currentHistory) => addKeywordToHistory(value, currentHistory));
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="bg-transparent">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-end px-4 sm:h-16 sm:px-6">
          <Link
            to="/admin/login"
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Đăng nhập
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-8 pt-4 sm:px-6 sm:pb-12 sm:pt-8">
        <section className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <h1 className="text-center text-3xl font-extrabold tracking-tight text-brand-900 sm:text-4xl">VI TÍNH PHƯỚC TÀI</h1>
          <p className="mx-auto mt-3 max-w-md text-center text-sm leading-6 text-slate-600 sm:text-base">
            Tra cứu tồn kho và thông tin bảo hành nhanh trên điện thoại.
          </p>

          <form
            className="mt-6"
            onSubmit={(event) => {
              event.preventDefault();
              const nextKeyword = searchInput.trim();
              setDebouncedKeyword(nextKeyword);
              rememberKeyword(nextKeyword);
            }}
          >
            <label className="mb-2 block text-sm font-semibold text-slate-800">Tìm kiếm sản phẩm</label>
            <div className="relative">
              <input
                ref={inputRef}
                className="h-16 w-full rounded-2xl border border-slate-300 bg-white px-4 pr-14 text-lg font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
                placeholder="Nhập SKU, tên hoặc bảo hành"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onBlur={() => rememberKeyword(searchInput)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    const nextKeyword = searchInput.trim();
                    setDebouncedKeyword(nextKeyword);
                    rememberKeyword(nextKeyword);
                  }
                }}
              />

              {searchInput.trim() && (
                <button
                  type="button"
                  aria-label="Xóa tìm kiếm"
                  onClick={handleClearSearch}
                  className="absolute right-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  ×
                </button>
              )}
            </div>
            {!trimmedKeyword && (
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Nhập SKU, tên sản phẩm hoặc ghi chú bảo hành để tra cứu.
              </p>
            )}
          </form>

          {!trimmedKeyword && history.length > 0 && (
            <div className="mt-5">
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
                    <button type="button" onClick={() => handleHistoryClick(item)} className="py-2 hover:text-brand-800">
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
            </div>
          )}
        </section>

        {hasSearched && (
          <section className="mt-5 sm:mt-8">
            {isLoading && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((skeleton) => (
                  <div key={skeleton} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="h-6 w-2/3 rounded bg-slate-200" />
                    <div className="mt-3 h-4 w-1/2 rounded bg-slate-200" />
                    <div className="mt-4 h-12 rounded bg-slate-100" />
                  </div>
                ))}
              </div>
            )}

            {!isLoading && error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            {!isLoading && !error && results.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center text-sm font-medium text-slate-500">
                Không tìm thấy sản phẩm phù hợp.
              </div>
            )}

            {!isLoading && !error && results.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((item) => (
                  <SearchResultCard key={item.id || item.sku} product={item} autoExpand={results.length === 1} />
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
