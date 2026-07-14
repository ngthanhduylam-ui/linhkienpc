import { useEffect, useRef, useState } from "react";
import { SearchResultCard } from "../components/SearchResultCard";
import { PublicAvailableProductsSection } from "../components/public/PublicAvailableProductsSection";
import { PublicCatalogueHeader } from "../components/public/PublicCatalogueHeader";
import { PublicCatalogueHero } from "../components/public/PublicCatalogueHero";
import { PublicCategoryNav } from "../components/public/PublicCategoryNav";
import { PublicCategoryResultsSection } from "../components/public/PublicCategoryResultsSection";
import {
  listAvailableCatalogueProducts,
  listPublicCategoryProducts,
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
const LIVE_SEARCH_DEBOUNCE_MS = 250;
const LIVE_SEARCH_LIMIT = 7;
const LIVE_SEARCH_ERROR_MESSAGE = "Không thể tải gợi ý lúc này. Vui lòng thử tìm kiếm đầy đủ.";
const PUBLIC_VIEW_STATE_KEY = "public_catalogue_view";
const PUBLIC_VIEW_MODES = new Set(["home", "category", "search", "detail"]);
const CATEGORY_PAGE_SIZE = 24;

function isMeaningfulLiveQuery(value) {
  return String(value || "").trim().replace(/\s+/g, "").length >= 2;
}

function readPublicViewState(state = window.history.state) {
  const value = state?.[PUBLIC_VIEW_STATE_KEY];
  if (!value || !PUBLIC_VIEW_MODES.has(value.view)) return null;

  if (value.view === "category") {
    const categoryId = Number(value.category_id);
    const categoryName = typeof value.category_name === "string" ? value.category_name.trim() : "";
    if (!Number.isInteger(categoryId) || categoryId < 1 || !categoryName) return null;
    return { view: "category", query: "", category: { id: categoryId, name: categoryName } };
  }

  const query = typeof value.query === "string" ? value.query.trim() : "";
  if (value.view !== "home" && !query) return null;
  return { view: value.view, query, category: null };
}

function writePublicViewState(method, viewState) {
  const category = viewState?.category;
  const state = {
    ...(window.history.state || {}),
    [PUBLIC_VIEW_STATE_KEY]: {
      view: viewState.view,
      query: String(viewState.query || "").trim(),
      category_id: category ? Number(category.id) : null,
      category_name: category?.name || ""
    }
  };
  window.history[method](state, "");
}

function dedupePublicProducts(products) {
  const usedKeys = new Set();
  return (Array.isArray(products) ? products : []).filter((product) => {
    const productId = Number(product?.productId);
    const normalizedSku = String(product?.sku || "").trim().toLowerCase();
    const key = Number.isInteger(productId) && productId > 0 ? `id:${productId}` : normalizedSku ? `sku:${normalizedSku}` : "";
    if (!key || usedKeys.has(key) || Number(product?.totalQuantity || 0) <= 0) return false;
    usedKeys.add(key);
    return true;
  });
}

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
  const initialViewStateRef = useRef(readPublicViewState() || { view: "home", query: "", category: null });
  const initialViewState = initialViewStateRef.current;
  const [searchInput, setSearchInput] = useState(initialViewState.query);
  const [submittedKeyword, setSubmittedKeyword] = useState(
    initialViewState.view === "home" ? "" : initialViewState.query
  );
  const [viewMode, setViewMode] = useState(initialViewState.view);
  const [selectedCategory, setSelectedCategory] = useState(initialViewState.category);
  const [categoryProducts, setCategoryProducts] = useState([]);
  const [categoryTotal, setCategoryTotal] = useState(0);
  const [categoryPage, setCategoryPage] = useState(1);
  const [categoryError, setCategoryError] = useState("");
  const [isCategoryLoading, setIsCategoryLoading] = useState(false);
  const [isCategoryLoadingMore, setIsCategoryLoadingMore] = useState(false);
  const [categoryRetryCount, setCategoryRetryCount] = useState(0);
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
  const [liveSearchKeyword, setLiveSearchKeyword] = useState("");
  const [liveSearchProducts, setLiveSearchProducts] = useState([]);
  const [liveSearchTotal, setLiveSearchTotal] = useState(0);
  const [liveSearchHiddenOutOfStock, setLiveSearchHiddenOutOfStock] = useState(false);
  const [liveSearchLoading, setLiveSearchLoading] = useState(false);
  const [liveSearchError, setLiveSearchError] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const inputRef = useRef(null);
  const searchFormRef = useRef(null);
  const searchInputRef = useRef(searchInput);
  const isSearchFocusedRef = useRef(false);
  const viewModeRef = useRef(initialViewState.view);
  const selectedCategoryRef = useRef(initialViewState.category);
  const previousCategoryRef = useRef(initialViewState.category);
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef(null);
  const categoryRequestIdRef = useRef(0);
  const categoryAbortControllerRef = useRef(null);
  const submittedKeywordRef = useRef(submittedKeyword);
  const liveRequestIdRef = useRef(0);
  const liveAbortControllerRef = useRef(null);
  const liveResolvedKeywordRef = useRef("");
  const isLoadingRef = useRef(false);
  const isCategoryLoadingRef = useRef(false);
  const hiddenAtRef = useRef(0);
  const wasPendingWhenHiddenRef = useRef(false);
  const shouldRecoverAfterOnlineRef = useRef(false);
  const resumeSearchKeyRef = useRef("");
  const resumeRevalidationPendingRef = useRef(false);
  const resultsKeywordRef = useRef("");

  const hasSearched = (viewMode === "search" || viewMode === "detail") && submittedKeyword.trim().length > 0;
  const hasSelectedCategory = viewMode === "category" && Boolean(selectedCategory?.id);

  useEffect(() => {
    submittedKeywordRef.current = submittedKeyword;
  }, [submittedKeyword]);

  useEffect(() => {
    searchInputRef.current = searchInput;
  }, [searchInput]);

  useEffect(() => {
    isSearchFocusedRef.current = isSearchFocused;
  }, [isSearchFocused]);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    selectedCategoryRef.current = selectedCategory;
  }, [selectedCategory]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    isCategoryLoadingRef.current = isCategoryLoading || isCategoryLoadingMore;
  }, [isCategoryLoading, isCategoryLoadingMore]);

  useEffect(() => {
    if (!readPublicViewState()) {
      writePublicViewState("replaceState", initialViewState);
    }

    function handlePopState(event) {
      const nextView = readPublicViewState(event.state);
      if (!nextView) return;
      restorePublicView(nextView);
    }

    function handleOutsidePointerDown(event) {
      if (!searchFormRef.current?.contains(event.target)) {
        closeLiveDropdown({ abort: true });
      }
    }

    window.addEventListener("popstate", handlePopState);
    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
    };
  }, []);

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
    if (viewMode !== "category" || !selectedCategory?.id) return undefined;

    const currentRequestId = categoryRequestIdRef.current + 1;
    categoryRequestIdRef.current = currentRequestId;
    const abortController = new AbortController();
    categoryAbortControllerRef.current?.abort();
    categoryAbortControllerRef.current = abortController;
    const isFirstPage = categoryPage === 1;

    if (isFirstPage) {
      setIsCategoryLoading(true);
    } else {
      setIsCategoryLoadingMore(true);
    }
    setCategoryError("");

    async function loadCategoryProducts() {
      try {
        const result = await listPublicCategoryProducts(selectedCategory.id, {
          page: categoryPage,
          limit: CATEGORY_PAGE_SIZE,
          signal: abortController.signal,
          timeoutMs: PUBLIC_SEARCH_TIMEOUT_MS
        });
        if (abortController.signal.aborted || categoryRequestIdRef.current !== currentRequestId) return;

        setCategoryProducts((currentProducts) => {
          const candidates = isFirstPage ? result.products : [...currentProducts, ...result.products];
          return dedupePublicProducts(candidates);
        });
        setCategoryTotal(result.totalMatches);
      } catch {
        if (!abortController.signal.aborted && categoryRequestIdRef.current === currentRequestId) {
          setCategoryError("Không thể tải danh mục lúc này.");
        }
      } finally {
        if (categoryAbortControllerRef.current === abortController) {
          categoryAbortControllerRef.current = null;
        }
        if (!abortController.signal.aborted && categoryRequestIdRef.current === currentRequestId) {
          setIsCategoryLoading(false);
          setIsCategoryLoadingMore(false);
          resumeRevalidationPendingRef.current = false;
        }
      }
    }

    loadCategoryProducts();
    return () => {
      abortController.abort();
      if (categoryAbortControllerRef.current === abortController) {
        categoryAbortControllerRef.current = null;
      }
    };
  }, [categoryPage, categoryRetryCount, selectedCategory?.id, viewMode]);

  useEffect(() => {
    const nextKeyword = searchInput.trim();
    if (!isSearchFocused || !isMeaningfulLiveQuery(nextKeyword)) {
      setLiveSearchKeyword("");
      setIsDropdownOpen(false);
      setActiveSearchIndex(-1);
      return undefined;
    }

    const timer = setTimeout(() => {
      setLiveSearchKeyword(nextKeyword);
    }, LIVE_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [isSearchFocused, searchInput]);

  useEffect(() => {
    const searchKeyword = liveSearchKeyword.trim();
    if (!isMeaningfulLiveQuery(searchKeyword)) return undefined;

    const currentRequestId = liveRequestIdRef.current + 1;
    liveRequestIdRef.current = currentRequestId;
    const abortController = new AbortController();
    liveAbortControllerRef.current?.abort();
    liveAbortControllerRef.current = abortController;
    setLiveSearchLoading(true);
    setLiveSearchError("");
    setActiveSearchIndex(-1);
    if (isSearchFocusedRef.current && searchInputRef.current.trim() === searchKeyword) {
      setIsDropdownOpen(true);
    }

    async function runLiveSearch() {
      try {
        const searchResult = await searchPublicProducts(searchKeyword, {
          limit: LIVE_SEARCH_LIMIT,
          signal: abortController.signal,
          timeoutMs: PUBLIC_SEARCH_TIMEOUT_MS
        });
        if (
          abortController.signal.aborted ||
          liveRequestIdRef.current !== currentRequestId ||
          searchInputRef.current.trim() !== searchKeyword
        ) {
          return;
        }

        const uniqueProducts = dedupePublicProducts(searchResult.products).slice(0, LIVE_SEARCH_LIMIT);
        liveResolvedKeywordRef.current = searchKeyword;
        setLiveSearchProducts(uniqueProducts);
        setLiveSearchTotal(Math.max(searchResult.totalMatches, uniqueProducts.length));
        setLiveSearchHiddenOutOfStock(searchResult.hasHiddenOutOfStockMatches);
        if (isSearchFocusedRef.current) setIsDropdownOpen(true);
      } catch {
        if (!abortController.signal.aborted && liveRequestIdRef.current === currentRequestId) {
          setLiveSearchProducts([]);
          setLiveSearchTotal(0);
          setLiveSearchHiddenOutOfStock(false);
          setLiveSearchError(LIVE_SEARCH_ERROR_MESSAGE);
          if (isSearchFocusedRef.current) setIsDropdownOpen(true);
        }
      } finally {
        if (liveAbortControllerRef.current === abortController) {
          liveAbortControllerRef.current = null;
        }
        if (!abortController.signal.aborted && liveRequestIdRef.current === currentRequestId) {
          setLiveSearchLoading(false);
        }
      }
    }

    runLiveSearch();
    return () => {
      abortController.abort();
      if (liveAbortControllerRef.current === abortController) {
        liveAbortControllerRef.current = null;
      }
    };
  }, [liveSearchKeyword]);

  useEffect(() => {
    const searchKeyword = submittedKeyword.trim();

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
  }, [submittedKeyword, retryCount]);

  useEffect(() => {
    function recoverCurrentView() {
      if (viewModeRef.current === "category" && selectedCategoryRef.current?.id) {
        if (resumeRevalidationPendingRef.current) return;
        resumeRevalidationPendingRef.current = true;
        categoryRequestIdRef.current += 1;
        categoryAbortControllerRef.current?.abort();
        categoryAbortControllerRef.current = null;
        setCategoryPage(1);
        setCategoryRetryCount((current) => current + 1);
        return;
      }

      const searchKeyword = submittedKeywordRef.current.trim();
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
        wasPendingWhenHiddenRef.current =
          Boolean(abortControllerRef.current) ||
          Boolean(categoryAbortControllerRef.current) ||
          isLoadingRef.current ||
          isCategoryLoadingRef.current;
        resumeSearchKeyRef.current = "";
        resumeRevalidationPendingRef.current = false;
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        categoryRequestIdRef.current += 1;
        categoryAbortControllerRef.current?.abort();
        categoryAbortControllerRef.current = null;
        liveRequestIdRef.current += 1;
        liveAbortControllerRef.current?.abort();
        liveAbortControllerRef.current = null;
        setIsDropdownOpen(false);
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
        recoverCurrentView();
      }
    }

    function handleOffline() {
      shouldRecoverAfterOnlineRef.current = true;
      if (document.visibilityState === "hidden") {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        categoryRequestIdRef.current += 1;
        categoryAbortControllerRef.current?.abort();
        categoryAbortControllerRef.current = null;
        liveRequestIdRef.current += 1;
        liveAbortControllerRef.current?.abort();
        liveAbortControllerRef.current = null;
        setIsDropdownOpen(false);
        requestIdRef.current += 1;
      }
    }

    function handleOnline() {
      shouldRecoverAfterOnlineRef.current = true;
      if (document.visibilityState === "visible") {
        recoverCurrentView();
      }
    }

    function handlePageShow(event) {
      if (event.persisted) {
        recoverCurrentView();
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

  function closeLiveDropdown({ abort = false } = {}) {
    setIsDropdownOpen(false);
    setActiveSearchIndex(-1);
    if (!abort) return;

    liveRequestIdRef.current += 1;
    liveAbortControllerRef.current?.abort();
    liveAbortControllerRef.current = null;
    liveResolvedKeywordRef.current = "";
    setLiveSearchKeyword("");
    setLiveSearchProducts([]);
    setLiveSearchTotal(0);
    setLiveSearchHiddenOutOfStock(false);
    setLiveSearchLoading(false);
    setLiveSearchError("");
  }

  function getCurrentViewState() {
    if (viewMode === "category" && selectedCategory?.id) {
      return { view: "category", query: "", category: selectedCategory };
    }
    return {
      view: viewMode,
      query: viewMode === "home" ? "" : submittedKeyword.trim(),
      category: null
    };
  }

  function isSameViewState(left, right) {
    return (
      left.view === right.view &&
      left.query === right.query &&
      Number(left.category?.id || 0) === Number(right.category?.id || 0)
    );
  }

  function restorePublicView(nextView) {
    closeLiveDropdown({ abort: true });
    categoryRequestIdRef.current += 1;
    categoryAbortControllerRef.current?.abort();
    categoryAbortControllerRef.current = null;
    isSearchFocusedRef.current = false;
    setIsSearchFocused(false);
    setViewMode(nextView.view);
    setSearchInput(nextView.view === "search" || nextView.view === "detail" ? nextView.query : "");
    searchInputRef.current = nextView.view === "search" || nextView.view === "detail" ? nextView.query : "";
    setSubmittedKeyword(nextView.view === "search" || nextView.view === "detail" ? nextView.query : "");
    setSelectedCategory(nextView.category || null);

    if (nextView.category) {
      previousCategoryRef.current = nextView.category;
      setCategoryProducts([]);
      setCategoryTotal(0);
      setCategoryError("");
      setCategoryPage(1);
    } else if (nextView.view === "home") {
      previousCategoryRef.current = null;
    }
  }

  function applyPublicView(nextView, { retryIfCurrent = false } = {}) {
    const currentView = getCurrentViewState();
    const isCurrentTarget = isSameViewState(currentView, nextView);

    if (!isCurrentTarget) {
      writePublicViewState("replaceState", currentView);
      writePublicViewState("pushState", nextView);
    }

    closeLiveDropdown({ abort: true });
    categoryRequestIdRef.current += 1;
    categoryAbortControllerRef.current?.abort();
    categoryAbortControllerRef.current = null;
    isSearchFocusedRef.current = false;
    setIsSearchFocused(false);
    inputRef.current?.blur();

    const nextQuery = nextView.view === "search" || nextView.view === "detail" ? nextView.query : "";
    searchInputRef.current = nextQuery;
    setSearchInput(nextQuery);
    setViewMode(nextView.view);
    setSubmittedKeyword(nextQuery);
    setSelectedCategory(nextView.category || null);

    if (nextView.category) {
      previousCategoryRef.current = nextView.category;
      setCategoryProducts([]);
      setCategoryTotal(0);
      setCategoryError("");
      setCategoryPage(1);
    } else if (nextView.view === "home") {
      previousCategoryRef.current = null;
    }

    if (isCurrentTarget && retryIfCurrent && nextView.view === "category") {
      setCategoryRetryCount((current) => current + 1);
    }
    if (isCurrentTarget && retryIfCurrent && (nextView.view === "search" || nextView.view === "detail")) {
      setRetryCount((current) => current + 1);
    }
  }

  function submitSearch(value = searchInput) {
    const nextKeyword = value.trim();
    if (!nextKeyword) {
      handleClearSearch();
      return;
    }

    rememberKeyword(nextKeyword);
    applyPublicView({ view: "search", query: nextKeyword, category: null }, { retryIfCurrent: true });
  }

  function handleRetrySearch() {
    setRetryCount((current) => current + 1);
  }

  function handleClearSearch() {
    rememberKeyword(searchInput);
    const previousCategory = previousCategoryRef.current;
    applyPublicView(
      previousCategory
        ? { view: "category", query: "", category: previousCategory }
        : { view: "home", query: "", category: null }
    );
    resultsKeywordRef.current = "";
    setResults([]);
    setHasHiddenOutOfStockMatches(false);
    setError("");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleHistoryClick(value) {
    const nextKeyword = value.trim();
    rememberKeyword(nextKeyword);
    applyPublicView({ view: "search", query: nextKeyword, category: null }, { retryIfCurrent: true });
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
    const exactSku = String(product?.sku || "").trim();
    if (!exactSku) return;
    rememberKeyword(exactSku);
    applyPublicView({ view: "detail", query: exactSku, category: null }, { retryIfCurrent: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSelectCategory(category) {
    if (!category) {
      previousCategoryRef.current = null;
      applyPublicView({ view: "home", query: "", category: null });
      return;
    }

    const nextCategory = { id: Number(category.id), name: String(category.name || "").trim() };
    if (!Number.isInteger(nextCategory.id) || nextCategory.id < 1 || !nextCategory.name) return;
    applyPublicView({ view: "category", query: "", category: nextCategory }, { retryIfCurrent: true });
  }

  function handleLoadMoreCategoryProducts() {
    if (isCategoryLoading || isCategoryLoadingMore || categoryProducts.length >= categoryTotal) return;
    setCategoryPage((current) => current + 1);
  }

  function handleRetryCategoryProducts() {
    setCategoryRetryCount((current) => current + 1);
  }

  function handleSearchInputChange(value) {
    searchInputRef.current = value;
    setSearchInput(value);
    closeLiveDropdown({ abort: true });
  }

  function handleSearchInputFocus() {
    isSearchFocusedRef.current = true;
    setIsSearchFocused(true);
    const currentKeyword = searchInputRef.current.trim();
    if (isMeaningfulLiveQuery(currentKeyword) && liveResolvedKeywordRef.current === currentKeyword) {
      setIsDropdownOpen(true);
    }
  }

  function handleDismissDropdown(nextFocusedElement) {
    isSearchFocusedRef.current = nextFocusedElement === inputRef.current;
    setIsSearchFocused(isSearchFocusedRef.current);
    closeLiveDropdown({ abort: true });
  }

  function handleSearchInputKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeLiveDropdown({ abort: true });
      return;
    }

    if (event.key === "ArrowDown" && isDropdownOpen && liveSearchProducts.length > 0) {
      event.preventDefault();
      setActiveSearchIndex((current) => (current + 1) % liveSearchProducts.length);
      return;
    }

    if (event.key === "ArrowUp" && isDropdownOpen && liveSearchProducts.length > 0) {
      event.preventDefault();
      setActiveSearchIndex((current) => (current <= 0 ? liveSearchProducts.length - 1 : current - 1));
      return;
    }

    if (event.key !== "Enter") return;

    event.preventDefault();
    if (isDropdownOpen && activeSearchIndex >= 0 && liveSearchProducts[activeSearchIndex]) {
      handleCatalogueProductDetails(liveSearchProducts[activeSearchIndex]);
      return;
    }

    submitSearch(event.currentTarget.value);
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
        activeSearchIndex={activeSearchIndex}
        inputRef={inputRef}
        isDropdownOpen={isDropdownOpen}
        isLoading={isLoading}
        liveSearchError={liveSearchError}
        liveSearchHiddenOutOfStock={liveSearchHiddenOutOfStock}
        liveSearchLoading={liveSearchLoading}
        liveSearchProducts={liveSearchProducts}
        liveSearchTotal={liveSearchTotal}
        onClear={handleClearSearch}
        onDismissDropdown={handleDismissDropdown}
        onDropdownActiveIndexChange={setActiveSearchIndex}
        onDropdownSelect={handleCatalogueProductDetails}
        onDropdownViewAll={() => submitSearch(searchInput)}
        onInputBlur={rememberKeyword}
        onInputChange={handleSearchInputChange}
        onInputFocus={handleSearchInputFocus}
        onInputKeyDown={handleSearchInputKeyDown}
        onSubmit={submitSearch}
        searchFormRef={searchFormRef}
        searchInput={searchInput}
      />
      <PublicCategoryNav
        categories={categories}
        onSelectCategory={handleSelectCategory}
        selectedCategoryId={viewMode === "search" ? null : selectedCategory?.id ?? null}
      />

      <main className="mx-auto w-[min(calc(100%_-_clamp(2rem,3vw,6rem)),clamp(80rem,86vw,131.25rem))] pb-10 pt-[clamp(1rem,1.3vw,1.75rem)] sm:pb-14">
        {viewMode === "home" && <PublicCatalogueHero />}

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

        {viewMode === "home" && (
          <PublicAvailableProductsSection
            isLoading={isCatalogueLoading}
            onViewDetails={handleCatalogueProductDetails}
            sections={catalogueSections}
          />
        )}

        {hasSelectedCategory && (
          <PublicCategoryResultsSection
            category={selectedCategory}
            error={categoryError}
            hasMore={categoryProducts.length < categoryTotal}
            isLoading={isCategoryLoading}
            isLoadingMore={isCategoryLoadingMore}
            onLoadMore={handleLoadMoreCategoryProducts}
            onRetry={handleRetryCategoryProducts}
            onViewDetails={handleCatalogueProductDetails}
            products={categoryProducts}
            total={categoryTotal}
          />
        )}

        {viewMode === "home" && history.length > 0 && (
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

        {viewMode === "home" && (
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
