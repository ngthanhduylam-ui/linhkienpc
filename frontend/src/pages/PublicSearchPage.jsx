import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { SearchResultCard } from "../components/SearchResultCard";
import { searchPublicProducts } from "../services/publicSearch.service";

export function PublicSearchPage() {
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(keyword.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    const currentRequestId = requestIdRef.current + 1;
    requestIdRef.current = currentRequestId;

    let isCancelled = false;

    async function runSearch() {
      setIsLoading(true);
      setError("");
      try {
        const data = await searchPublicProducts(debouncedKeyword);
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

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-end px-4 sm:px-6">
          <Link
            to="/admin/login"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Đăng nhập
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-center text-3xl font-bold tracking-tight text-brand-900">LINHKIENPC</h1>
          <p className="mt-2 text-center text-sm text-slate-600">Tra cứu tồn kho theo SKU, tên sản phẩm và lô bảo hành.</p>

          <form
            className="mt-6"
            onSubmit={(event) => {
              event.preventDefault();
              setDebouncedKeyword(keyword.trim());
            }}
          >
            <label className="mb-2 block text-sm font-medium text-slate-700">Tìm kiếm</label>
            <input
              className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none ring-brand-500 placeholder:text-slate-400 focus:ring-2"
              placeholder="Tìm kiếm: 12400f, intel, 07.26, cpu.intel..."
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  setDebouncedKeyword(keyword.trim());
                }
              }}
            />
          </form>
        </section>

        <section className="mt-8 sm:mt-10">
          {isLoading && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((skeleton) => (
                <div key={skeleton} className="animate-pulse rounded-xl border border-slate-200 bg-white p-5">
                  <div className="h-5 w-2/3 rounded bg-slate-200" />
                  <div className="mt-3 h-4 w-1/2 rounded bg-slate-200" />
                  <div className="mt-4 h-4 w-1/3 rounded bg-slate-200" />
                  <div className="mt-4 space-y-2">
                    <div className="h-8 rounded bg-slate-100" />
                    <div className="h-8 rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!isLoading && !error && results.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
              Không tìm thấy sản phẩm.
            </div>
          )}

          {!isLoading && !error && results.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((item) => (
                <SearchResultCard key={item.id} product={item} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
