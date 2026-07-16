import { Link } from "react-router-dom";
import ptcLogoUrl from "../../assets/ptc-logo.png";
import { PUBLIC_SEARCH_LISTBOX_ID, PublicSearchDropdown } from "./PublicSearchDropdown";

function SearchIcon({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m16.5 16.5 4 4" strokeLinecap="round" />
    </svg>
  );
}

export function PublicCatalogueHeader({
  activeSearchIndex,
  dropdownMode,
  inputRef,
  isDropdownOpen,
  isLoading,
  liveSearchError,
  liveSearchHiddenOutOfStock,
  liveSearchLoading,
  liveSearchProducts,
  liveSearchTotal,
  onClear,
  onClearRecentSearches,
  onDismissDropdown,
  onDropdownActiveIndexChange,
  onDropdownSelect,
  onDropdownViewAll,
  onInputChange,
  onInputFocus,
  onInputKeyDown,
  onRemoveRecentSearch,
  onSelectRecentSearch,
  onSubmit,
  recentSearches,
  searchFormRef,
  searchInput
}) {
  const hasKeyword = Boolean(searchInput.trim());

  return (
    <header className="border-b border-[#dbe8f7] bg-white">
      <div
        className="mx-auto grid w-[min(calc(100%_-_clamp(1.5rem,2vw,3rem)),clamp(80rem,96vw,154rem))] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 pb-3.5 pt-3.5 sm:gap-x-5 sm:pb-[1.125rem] sm:pt-[1.125rem] lg:grid-cols-[minmax(17rem,auto)_minmax(0,1fr)_auto] lg:gap-[clamp(1rem,1.5vw,2.25rem)] min-[1920px]:pb-5 min-[2200px]:grid-cols-[minmax(22rem,0.7fr)_minmax(0,1.55fr)_auto]"
        style={{ paddingTop: "max(clamp(1rem, 1.2vw, 1.5rem), env(safe-area-inset-top))" }}
      >
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-white sm:h-14 sm:w-14 lg:h-[3.75rem] lg:w-[3.75rem] min-[2200px]:h-16 min-[2200px]:w-16">
            <img
              src={ptcLogoUrl}
              alt="Logo VI TÍNH PHƯỚC TÀI"
              className="h-full w-full object-contain"
              onError={(event) => {
                event.currentTarget.hidden = true;
                event.currentTarget.nextElementSibling.hidden = false;
              }}
            />
            <svg
              hidden
              viewBox="0 0 48 48"
              aria-hidden="true"
              className="h-7 w-7 text-[#0b63f6]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <rect x="9" y="10" width="30" height="23" rx="4" />
              <path d="M16 39h16M19 33v6m10-6v6M14 17h8m-8 6h14" strokeLinecap="round" />
              <circle cx="33" cy="18" r="2" fill="currentColor" stroke="none" />
            </svg>
          </div>
          <div className="min-w-0 [font-family:Inter,'Segoe_UI',Arial,sans-serif]">
            <p className="whitespace-nowrap text-[15px] font-extrabold leading-[1.25] tracking-[0.015em] text-[#0755c7] sm:text-xl xl:text-[clamp(1.5rem,1.4vw,1.9rem)] min-[2200px]:text-[2rem]">
              PHƯỚC TÀI COMPUTER
            </p>
            <p className="mt-0.5 whitespace-nowrap text-[10px] font-medium leading-normal text-[#637b9f] sm:text-xs xl:text-sm min-[2200px]:text-[0.9375rem]">
              Uy tín tạo nên thương hiệu
            </p>
          </div>
        </div>

        <form
          ref={searchFormRef}
          className="relative order-3 col-span-2 flex w-full min-w-0 lg:order-none lg:col-span-1 lg:max-w-[72rem] lg:justify-self-center min-[2200px]:max-w-[82rem]"
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
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7890b2] sm:left-5">
              <SearchIcon className="h-5 w-5 sm:h-6 sm:w-6" />
            </span>
            <input
              id="public-product-search"
              ref={inputRef}
              className="h-12 w-full rounded-l-xl border border-r-0 border-[#77aaf5] bg-white pl-11 pr-10 text-sm font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-[#0b63f6] focus:ring-2 focus:ring-inset focus:ring-blue-100 sm:h-14 sm:pl-14 sm:text-base min-[1920px]:h-16 min-[1920px]:text-[1.0625rem]"
              placeholder="Tìm sản phẩm, nhập mã hoặc tên model..."
              value={searchInput}
              onChange={(event) => onInputChange(event.target.value)}
              onClick={onInputFocus}
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
            className="inline-flex h-12 min-w-[6.75rem] shrink-0 items-center justify-center gap-2 rounded-r-xl bg-[#0b63f6] px-4 text-sm font-extrabold text-white shadow-[0_6px_16px_rgba(11,99,246,0.22)] hover:bg-[#0755d8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b63f6] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:h-14 sm:min-w-[9rem] sm:text-base min-[1920px]:h-16 min-[1920px]:min-w-[10.5rem] min-[1920px]:text-[1.0625rem]"
            disabled={!hasKeyword || isLoading}
          >
            <SearchIcon className="h-5 w-5" />
            <span>{isLoading ? "Đang tìm..." : "Tìm kiếm"}</span>
          </button>

          {isDropdownOpen && (
            <PublicSearchDropdown
              activeIndex={activeSearchIndex}
              errorMessage={liveSearchError}
              hasHiddenOutOfStockMatches={liveSearchHiddenOutOfStock}
              isLoading={liveSearchLoading}
              mode={dropdownMode}
              onActiveIndexChange={onDropdownActiveIndexChange}
              onClearRecentSearches={onClearRecentSearches}
              onRemoveRecentSearch={onRemoveRecentSearch}
              onSelectRecentSearch={onSelectRecentSearch}
              onSelectProduct={onDropdownSelect}
              onViewAll={onDropdownViewAll}
              products={liveSearchProducts}
              query={searchInput.trim()}
              recentSearches={recentSearches}
              totalMatches={liveSearchTotal}
            />
          )}
        </form>

        <Link
          to="/admin/login"
          aria-label="Đăng nhập quản trị"
          title="Đăng nhập quản trị"
          className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-blue-100 bg-[#f7faff] px-2.5 text-[11px] font-bold text-[#0b4fb3] hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b63f6] sm:h-11 sm:px-3 sm:text-xs"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <path d="m10 17 5-5-5-5M15 12H3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="hidden sm:inline">Quản trị</span>
        </Link>
      </div>
    </header>
  );
}
