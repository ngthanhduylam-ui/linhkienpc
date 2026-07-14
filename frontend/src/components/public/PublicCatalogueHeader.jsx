import { Link } from "react-router-dom";
import ptcLogoUrl from "../../assets/ptc-logo.png";
import { PUBLIC_SEARCH_LISTBOX_ID, PublicSearchDropdown } from "./PublicSearchDropdown";

export function PublicCatalogueHeader({
  activeSearchIndex,
  inputRef,
  isDropdownOpen,
  isLoading,
  liveSearchError,
  liveSearchHiddenOutOfStock,
  liveSearchLoading,
  liveSearchProducts,
  liveSearchTotal,
  onClear,
  onDismissDropdown,
  onDropdownActiveIndexChange,
  onDropdownSelect,
  onDropdownViewAll,
  onInputBlur,
  onInputChange,
  onInputFocus,
  onInputKeyDown,
  onSubmit,
  searchFormRef,
  searchInput
}) {
  const hasKeyword = Boolean(searchInput.trim());

  return (
    <header className="border-b border-[#d9e6f5] bg-white shadow-[0_2px_10px_rgba(15,47,95,0.06)]">
      <div
        className="mx-auto flex w-[min(calc(100%_-_clamp(2rem,3vw,6rem)),clamp(80rem,86vw,131.25rem))] flex-wrap items-center gap-2 pb-2.5 sm:gap-4 lg:grid lg:grid-cols-[minmax(0,auto)_minmax(0,1fr)_auto] lg:gap-[clamp(0.75rem,1.1vw,1.5rem)] lg:pb-[clamp(0.625rem,0.7vw,0.875rem)]"
        style={{ paddingTop: "max(0.625rem, env(safe-area-inset-top))" }}
      >
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3 lg:max-w-[clamp(16.5rem,16vw,20rem)] lg:gap-[clamp(0.75rem,0.8vw,1rem)]">
          <img
            src={ptcLogoUrl}
            alt="Logo Vi Tính Phước Tài"
            className="h-11 w-11 shrink-0 rounded-lg border border-[#d9e6f5] bg-white object-contain p-0.5 sm:h-[clamp(3rem,3vw,3.5rem)] sm:w-[clamp(3rem,3vw,3.5rem)]"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold tracking-wide text-[#0f2f5f] sm:text-[clamp(1.125rem,1.05vw,1.25rem)]">
              VI TÍNH PHƯỚC TÀI
            </p>
            <p className="truncate text-[10px] font-medium text-slate-500 sm:text-[clamp(0.75rem,0.7vw,0.875rem)]">Uy tín tạo nên thương hiệu</p>
          </div>
        </div>

        <form
          ref={searchFormRef}
          className="relative order-3 flex w-full min-w-0 lg:order-none lg:max-w-[57.5rem] lg:justify-self-center"
          onSubmit={(event) => {
            event.preventDefault();
            onDismissDropdown();
            onSubmit(searchInput);
          }}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              onDismissDropdown(event.relatedTarget);
            }
          }}
        >
          <label className="sr-only" htmlFor="public-product-search">
            Tìm sản phẩm
          </label>
          <div className="relative min-w-0 flex-1">
            <input
              id="public-product-search"
              ref={inputRef}
              className="h-11 w-full rounded-l-xl border border-r-0 border-[#8ab8fb] bg-white px-3 pr-10 text-sm font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-transparent focus:border-[#0b63f6] focus:ring-2 focus:ring-inset focus:ring-blue-100 sm:px-[clamp(1rem,1vw,1.25rem)] sm:text-base sm:placeholder:text-slate-400 lg:h-[clamp(2.75rem,2.5vw,3rem)]"
              placeholder="Nhập tên sản phẩm, SKU hoặc ghi chú bảo hành..."
              value={searchInput}
              onChange={(event) => onInputChange(event.target.value)}
              onBlur={() => onInputBlur(searchInput)}
              onFocus={onInputFocus}
              onKeyDown={onInputKeyDown}
              role="combobox"
              aria-autocomplete="list"
              aria-controls={isDropdownOpen ? PUBLIC_SEARCH_LISTBOX_ID : undefined}
              aria-expanded={isDropdownOpen}
              aria-activedescendant={
                isDropdownOpen && activeSearchIndex >= 0
                  ? `${PUBLIC_SEARCH_LISTBOX_ID}-option-${activeSearchIndex}`
                  : undefined
              }
            />
            {!searchInput && (
              <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 sm:hidden">
                Tìm sản phẩm, SKU...
              </span>
            )}
            {hasKeyword && (
              <button
                type="button"
                aria-label="Xóa tìm kiếm"
                onClick={onClear}
                className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-lg text-slate-400 hover:bg-blue-50 hover:text-[#0b63f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b63f6]"
              >
                ×
              </button>
            )}
          </div>
          <button
            type="submit"
            className="h-11 shrink-0 rounded-r-xl bg-[#0b63f6] px-3 text-sm font-extrabold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b63f6] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#0b63f6] disabled:opacity-60 sm:min-w-[clamp(7rem,7vw,9rem)] sm:px-[clamp(1.25rem,1.4vw,1.75rem)] lg:h-[clamp(2.75rem,2.5vw,3rem)] lg:text-[clamp(0.875rem,0.8vw,1rem)]"
            disabled={!hasKeyword || isLoading}
          >
            {isLoading ? "Đang tìm..." : "Tìm kiếm"}
          </button>

          {isDropdownOpen && (
            <PublicSearchDropdown
              activeIndex={activeSearchIndex}
              errorMessage={liveSearchError}
              hasHiddenOutOfStockMatches={liveSearchHiddenOutOfStock}
              isLoading={liveSearchLoading}
              onActiveIndexChange={onDropdownActiveIndexChange}
              onSelectProduct={onDropdownSelect}
              onViewAll={onDropdownViewAll}
              products={liveSearchProducts}
              query={searchInput.trim()}
              totalMatches={liveSearchTotal}
            />
          )}
        </form>

        <Link
          to="/admin/login"
          className="ml-auto inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-xl border border-[#8ab8fb] bg-white px-2.5 text-[11px] font-bold text-[#0b63f6] hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b63f6] focus-visible:ring-offset-2 sm:px-[clamp(1rem,1.2vw,1.5rem)] sm:text-[clamp(0.875rem,0.8vw,1rem)] lg:ml-0 lg:h-[clamp(2.75rem,2.5vw,3rem)]"
        >
          Đăng nhập quản trị
        </Link>
      </div>
    </header>
  );
}
