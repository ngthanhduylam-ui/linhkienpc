import { useEffect, useRef, useState } from "react";
import { SearchResultCard } from "../components/SearchResultCard";
import { PublicAdvertisingCarousel } from "../components/public/PublicAdvertisingCarousel";
import { PublicAvailableProductsSection } from "../components/public/PublicAvailableProductsSection";
import { PublicCatalogueHeader } from "../components/public/PublicCatalogueHeader";
import { PublicCatalogueFooter } from "../components/public/PublicCatalogueFooter";
import { PublicCategoryNav } from "../components/public/PublicCategoryNav";
import { PublicCategoryResultsSection } from "../components/public/PublicCategoryResultsSection";
import { PublicFloatingContactWidget } from "../components/public/PublicFloatingContactWidget";
import { PublicProductGrid, PublicProductGridSkeleton } from "../components/public/PublicProductGrid";
import { PublicRecentStockUpdatesSection } from "../components/public/PublicRecentStockUpdatesSection";
import { PublicResultViewSwitcher } from "../components/public/PublicResultViewSwitcher";
import { PublicSearchResultsTable } from "../components/public/PublicSearchResultsTable";
import {
  getPublicProductById,
  listPublicCatalogueSuggestions,
  listPublicCategoryProducts,
  listPublicCategories,
  listPublicRecentStockUpdates,
  searchPublicProducts
} from "../services/publicSearch.service";
import {
  changePublicResultViewMode,
  loadPublicResultViewMode
} from "../utils/publicSearchResultsView";
import {
  dedupePublicProducts,
  getPublicSearchLoadMoreCount,
  mergePublicSearchPages,
  PUBLIC_SEARCH_PAGE_SIZE
} from "../utils/publicSearchPagination";

const SEARCH_HISTORY_KEY = "public_search_history";
const IOS_INSTALL_DISMISSED_KEY = "public_ios_install_dismissed_at";
const MAX_HISTORY_ITEMS = 10;
const MAX_VISIBLE_HISTORY_ITEMS = 7;
const PUBLIC_SEARCH_TIMEOUT_MS = 20000;
const PUBLIC_SEARCH_RESUME_AFTER_MS = 25000;
const IOS_INSTALL_DISMISS_MS = 14 * 24 * 60 * 60 * 1000;
const PUBLIC_SEARCH_ERROR_MESSAGE = "Mạng đang chậm, vui lòng thử lại.";
const LIVE_SEARCH_DEBOUNCE_MS = 250;
const LIVE_SEARCH_LIMIT = 7;
const LIVE_SEARCH_ERROR_MESSAGE = "Không thể tải gợi ý lúc này. Vui lòng thử tìm kiếm đầy đủ.";
const PUBLIC_VIEW_STATE_KEY = "public_catalogue_view";
const PUBLIC_VIEW_MODES = new Set(["home", "category", "search", "detail"]);
const CATEGORY_PAGE_SIZE = 24;
const PUBLIC_SUGGESTION_LIMIT = 6;
const MAX_STORED_SUGGESTION_IDS = 24;
const PREVIOUS_SUGGESTION_IDS_KEY = "publicCataloguePreviousSuggestionIds";
const PUBLIC_PRODUCT_DETAIL_PREFIX = "__catalogue_product_";

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
    const input = typeof value.input === "string" ? value.input : "";
    return { view: "category", query: "", input, category: { id: categoryId, name: categoryName } };
  }

  const query = typeof value.query === "string" ? value.query.trim() : "";
  if (value.view !== "home" && !query) return null;
  const input = typeof value.input === "string" ? value.input : value.view === "home" ? "" : query;
  const resultProductId = Number(value.result_product_id);
  return {
    view: value.view,
    query,
    input,
    category: null,
    resultProductId:
      value.view === "search" && Number.isSafeInteger(resultProductId) && resultProductId > 0
        ? resultProductId
        : null
  };
}

function writePublicViewState(method, viewState) {
  const category = viewState?.category;
  const state = {
    ...(window.history.state || {}),
    [PUBLIC_VIEW_STATE_KEY]: {
      view: viewState.view,
      query: String(viewState.query || "").trim(),
      input: String(viewState.input || ""),
      result_product_id:
        Number.isSafeInteger(Number(viewState.resultProductId)) && Number(viewState.resultProductId) > 0
          ? Number(viewState.resultProductId)
          : null,
      category_id: category ? Number(category.id) : null,
      category_name: category?.name || ""
    }
  };
  window.history[method](state, "");
}

function sanitizeSuggestionIds(values) {
  const usedIds = new Set();
  return (Array.isArray(values) ? values : []).flatMap((value) => {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id < 1 || usedIds.has(id)) return [];
    usedIds.add(id);
    return [id];
  }).slice(0, MAX_STORED_SUGGESTION_IDS);
}

function readPreviousSuggestionIds() {
  try {
    return sanitizeSuggestionIds(JSON.parse(sessionStorage.getItem(PREVIOUS_SUGGESTION_IDS_KEY) || "[]"));
  } catch {
    return [];
  }
}

function savePreviousSuggestionIds(products) {
  try {
    const ids = sanitizeSuggestionIds((Array.isArray(products) ? products : []).map((product) => product?.productId));
    sessionStorage.setItem(PREVIOUS_SUGGESTION_IDS_KEY, JSON.stringify(ids));
  } catch {
    // Suggestions remain usable when storage is unavailable.
  }
}

function isTechnicalCatalogueSearch(value) {
  return /^__catalogue_/i.test(String(value || "").trim());
}

function createProductDetailQuery(productId) {
  return `${PUBLIC_PRODUCT_DETAIL_PREFIX}${productId}`;
}

function getProductIdFromDetailQuery(value) {
  const match = String(value || "").trim().match(/^__catalogue_product_(\d+)$/i);
  const productId = Number(match?.[1]);
  return Number.isSafeInteger(productId) && productId > 0 ? productId : null;
}

function sanitizeSearchHistory(items) {
  const usedQueries = new Set();
  return (Array.isArray(items) ? items : [])
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item && !isTechnicalCatalogueSearch(item))
    .filter((item) => {
      const normalized = item.toLocaleLowerCase("vi-VN");
      if (usedQueries.has(normalized)) return false;
      usedQueries.add(normalized);
      return true;
    })
    .slice(0, MAX_HISTORY_ITEMS);
}

function parseSearchHistoryValue(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? sanitizeSearchHistory(parsed) : [];
  } catch {
    return [];
  }
}

function loadSearchHistory() {
  try {
    const sanitized = parseSearchHistoryValue(window.localStorage.getItem(SEARCH_HISTORY_KEY));
    window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(sanitized));
    return sanitized;
  } catch {
    return [];
  }
}

function saveSearchHistory(items) {
  try {
    window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(sanitizeSearchHistory(items)));
  } catch {
    // Search remains usable when storage is unavailable.
  }
}

function addKeywordToHistory(searchInput, currentHistory) {
  const trimmed = searchInput.trim();
  if (!trimmed || isTechnicalCatalogueSearch(trimmed)) return sanitizeSearchHistory(currentHistory);

  return sanitizeSearchHistory([
    trimmed,
    ...currentHistory.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())
  ]);
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
  const initialViewStateRef = useRef(
    readPublicViewState() || { view: "home", query: "", input: "", category: null, resultProductId: null }
  );
  const initialViewState = initialViewStateRef.current;
  const [searchInput, setSearchInput] = useState(initialViewState.input);
  const [submittedKeyword, setSubmittedKeyword] = useState(
    initialViewState.view === "home" ? "" : initialViewState.query
  );
  const [viewMode, setViewMode] = useState(initialViewState.view);
  const [selectedSearchProductId, setSelectedSearchProductId] = useState(initialViewState.resultProductId || null);
  const [selectedCategory, setSelectedCategory] = useState(initialViewState.category);
  const [categoryProducts, setCategoryProducts] = useState([]);
  const [categoryTotal, setCategoryTotal] = useState(0);
  const [categoryPage, setCategoryPage] = useState(1);
  const [categoryError, setCategoryError] = useState("");
  const [isCategoryLoading, setIsCategoryLoading] = useState(false);
  const [isCategoryLoadingMore, setIsCategoryLoadingMore] = useState(false);
  const [categoryRetryCount, setCategoryRetryCount] = useState(0);
  const [results, setResults] = useState([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchPage, setSearchPage] = useState(1);
  const [isSearchLoadingMore, setIsSearchLoadingMore] = useState(false);
  const [searchLoadMoreError, setSearchLoadMoreError] = useState("");
  const [resultViewMode, setResultViewMode] = useState(() => loadPublicResultViewMode());
  const [categories, setCategories] = useState([]);
  const [recentStockUpdates, setRecentStockUpdates] = useState([]);
  const [isRecentStockLoading, setIsRecentStockLoading] = useState(true);
  const [suggestedProducts, setSuggestedProducts] = useState([]);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(true);
  const [suggestionError, setSuggestionError] = useState("");
  const [suggestionRetryCount, setSuggestionRetryCount] = useState(0);
  const [hasHiddenOutOfStockMatches, setHasHiddenOutOfStockMatches] = useState(false);
  const [history, setHistory] = useState(() => loadSearchHistory());
  const historyRef = useRef(history);
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
  const searchLoadMoreRequestIdRef = useRef(0);
  const searchLoadMoreAbortControllerRef = useRef(null);
  const isSearchLoadingMoreRef = useRef(false);
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
  const recentSearches = history.slice(0, MAX_VISIBLE_HISTORY_ITEMS);
  const dropdownMode = searchInput.trim() === "" ? "recent" : "products";
  const searchResultCount = viewMode === "search" ? searchTotal : results.length;
  const searchLoadMoreCount = getPublicSearchLoadMoreCount(
    results.length,
    searchTotal,
    PUBLIC_SEARCH_PAGE_SIZE
  );

  function handleResultViewModeChange(nextMode) {
    const currentResults = viewMode === "category" ? categoryProducts : results;
    const nextPresentation = changePublicResultViewMode({
      query: submittedKeywordRef.current,
      results: currentResults,
      viewMode: resultViewMode
    }, nextMode);
    setResultViewMode(nextPresentation.viewMode);
  }

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

    function handleSearchHistoryStorage(event) {
      if (event.key !== SEARCH_HISTORY_KEY) return;
      const nextHistory = parseSearchHistoryValue(event.newValue);
      historyRef.current = nextHistory;
      setHistory(nextHistory);
    }

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("storage", handleSearchHistoryStorage);
    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("storage", handleSearchHistoryStorage);
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
    const abortController = new AbortController();
    setIsRecentStockLoading(true);

    listPublicRecentStockUpdates({
      signal: abortController.signal,
      timeoutMs: PUBLIC_SEARCH_TIMEOUT_MS
    })
      .then((products) => {
        if (active) setRecentStockUpdates(products);
      })
      .catch(() => {
        if (active && !abortController.signal.aborted) setRecentStockUpdates([]);
      })
      .finally(() => {
        if (active && !abortController.signal.aborted) setIsRecentStockLoading(false);
      });

    return () => {
      active = false;
      abortController.abort();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const excludedIds = readPreviousSuggestionIds();
    setIsSuggestionsLoading(true);
    setSuggestionError("");

    listPublicCatalogueSuggestions(excludedIds, {
      limit: PUBLIC_SUGGESTION_LIMIT,
      forceRefresh: suggestionRetryCount > 0
    })
      .then((products) => {
        if (!active) return;
        const nextProducts = dedupePublicProducts(products).slice(0, PUBLIC_SUGGESTION_LIMIT);
        setSuggestedProducts(nextProducts);
        savePreviousSuggestionIds(nextProducts);
      })
      .catch(() => {
        if (active) setSuggestionError("Không thể tải gợi ý lúc này.");
      })
      .finally(() => {
        if (active) setIsSuggestionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [suggestionRetryCount]);

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
    if (!isSearchFocused) {
      setLiveSearchKeyword("");
      setIsDropdownOpen(false);
      setActiveSearchIndex(-1);
      return undefined;
    }

    if (!isMeaningfulLiveQuery(nextKeyword)) {
      setLiveSearchKeyword("");
      setIsDropdownOpen(nextKeyword.length === 0 && recentSearches.length > 0);
      setActiveSearchIndex(-1);
      return undefined;
    }

    const timer = setTimeout(() => {
      setLiveSearchKeyword(nextKeyword);
    }, LIVE_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [isSearchFocused, recentSearches.length, searchInput]);

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
      setSearchTotal(0);
      setSearchPage(1);
      isSearchLoadingMoreRef.current = false;
      setIsSearchLoadingMore(false);
      setSearchLoadMoreError("");
      setHasHiddenOutOfStockMatches(false);
      setError("");
      setIsLoading(false);
      return undefined;
    }

    const selectedProductId = Number(selectedSearchProductId);
    const exactSearchProductId =
      viewMode === "search" && Number.isSafeInteger(selectedProductId) && selectedProductId > 0
        ? selectedProductId
        : null;
    const detailProductId = getProductIdFromDetailQuery(searchKeyword);
    const requestedProductId = detailProductId || exactSearchProductId;
    const searchRequestKey = requestedProductId
      ? `${viewMode}:${searchKeyword}:product:${requestedProductId}`
      : `${viewMode}:${searchKeyword}`;
    const currentRequestId = requestIdRef.current + 1;
    requestIdRef.current = currentRequestId;
    const abortController = new AbortController();
    abortControllerRef.current?.abort();
    abortControllerRef.current = abortController;
    searchLoadMoreRequestIdRef.current += 1;
    searchLoadMoreAbortControllerRef.current?.abort();
    searchLoadMoreAbortControllerRef.current = null;
    isSearchLoadingMoreRef.current = false;
    setIsSearchLoadingMore(false);
    setSearchLoadMoreError("");

    async function runSearch() {
      setIsLoading(true);
      setError("");
      if (resultsKeywordRef.current !== searchRequestKey) {
        setResults([]);
        setSearchTotal(0);
        setSearchPage(1);
        setHasHiddenOutOfStockMatches(false);
      }
      try {
        const searchResult = await (requestedProductId ? getPublicProductById(requestedProductId, {
          signal: abortController.signal,
          timeoutMs: PUBLIC_SEARCH_TIMEOUT_MS
        }) : searchPublicProducts(searchKeyword, {
          page: 1,
          limit: PUBLIC_SEARCH_PAGE_SIZE,
          signal: abortController.signal,
          timeoutMs: PUBLIC_SEARCH_TIMEOUT_MS
        }));
        if (!abortController.signal.aborted && requestIdRef.current === currentRequestId) {
          resultsKeywordRef.current = searchRequestKey;
          const nextProducts = dedupePublicProducts(searchResult.products);
          setResults(nextProducts);
          setSearchTotal(Math.max(searchResult.totalMatches, nextProducts.length));
          setSearchPage(searchResult.page);
          setHasHiddenOutOfStockMatches(searchResult.hasHiddenOutOfStockMatches);
        }
      } catch (err) {
        if (!abortController.signal.aborted && requestIdRef.current === currentRequestId) {
          if (resultsKeywordRef.current !== searchRequestKey) {
            setResults([]);
            setSearchTotal(0);
            setSearchPage(1);
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
      searchLoadMoreRequestIdRef.current += 1;
      searchLoadMoreAbortControllerRef.current?.abort();
      searchLoadMoreAbortControllerRef.current = null;
      isSearchLoadingMoreRef.current = false;
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    };
  }, [retryCount, selectedSearchProductId, submittedKeyword, viewMode]);

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

  function persistRecentHistory(items) {
    const nextHistory = sanitizeSearchHistory(items);
    historyRef.current = nextHistory;
    saveSearchHistory(nextHistory);
    setHistory(nextHistory);
  }

  function recordRecentQuery(value) {
    persistRecentHistory(addKeywordToHistory(value, historyRef.current));
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
      return {
        view: "category",
        query: "",
        input: searchInputRef.current,
        category: selectedCategory,
        resultProductId: null
      };
    }
    return {
      view: viewMode,
      query: viewMode === "home" ? "" : submittedKeyword.trim(),
      input: searchInputRef.current,
      category: null,
      resultProductId: viewMode === "search" ? selectedSearchProductId : null
    };
  }

  function isSameViewState(left, right) {
    return (
      left.view === right.view &&
      left.query === right.query &&
      String(left.input || "") === String(right.input || "") &&
      Number(left.resultProductId || 0) === Number(right.resultProductId || 0) &&
      Number(left.category?.id || 0) === Number(right.category?.id || 0)
    );
  }

  function restorePublicView(nextView) {
    closeLiveDropdown({ abort: true });
    searchLoadMoreRequestIdRef.current += 1;
    searchLoadMoreAbortControllerRef.current?.abort();
    searchLoadMoreAbortControllerRef.current = null;
    isSearchLoadingMoreRef.current = false;
    setIsSearchLoadingMore(false);
    setSearchLoadMoreError("");
    resultsKeywordRef.current = "";
    setResults([]);
    setSearchTotal(0);
    setSearchPage(1);
    categoryRequestIdRef.current += 1;
    categoryAbortControllerRef.current?.abort();
    categoryAbortControllerRef.current = null;
    isSearchFocusedRef.current = false;
    setIsSearchFocused(false);
    setViewMode(nextView.view);
    setSelectedSearchProductId(nextView.view === "search" ? nextView.resultProductId || null : null);
    const nextInput = String(nextView.input || "");
    setSearchInput(nextInput);
    searchInputRef.current = nextInput;
    const nextQuery = nextView.view === "search" || nextView.view === "detail" ? nextView.query : "";
    submittedKeywordRef.current = nextQuery;
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
  }

  function applyPublicView(nextView, { retryIfCurrent = false } = {}) {
    const currentView = getCurrentViewState();
    const isCurrentTarget = isSameViewState(currentView, nextView);

    if (!isCurrentTarget) {
      writePublicViewState("replaceState", currentView);
      writePublicViewState("pushState", nextView);
      resultsKeywordRef.current = "";
      setResults([]);
      setSearchTotal(0);
      setSearchPage(1);
      setHasHiddenOutOfStockMatches(false);
      setError("");
    }

    closeLiveDropdown({ abort: true });
    searchLoadMoreRequestIdRef.current += 1;
    searchLoadMoreAbortControllerRef.current?.abort();
    searchLoadMoreAbortControllerRef.current = null;
    isSearchLoadingMoreRef.current = false;
    setIsSearchLoadingMore(false);
    setSearchLoadMoreError("");
    categoryRequestIdRef.current += 1;
    categoryAbortControllerRef.current?.abort();
    categoryAbortControllerRef.current = null;
    isSearchFocusedRef.current = false;
    setIsSearchFocused(false);
    inputRef.current?.blur();

    const nextQuery = nextView.view === "search" || nextView.view === "detail" ? nextView.query : "";
    const nextInput = String(nextView.input || "");
    submittedKeywordRef.current = nextQuery;
    searchInputRef.current = nextInput;
    setSearchInput(nextInput);
    setViewMode(nextView.view);
    setSelectedSearchProductId(nextView.view === "search" ? nextView.resultProductId || null : null);
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

  function runFullSearch(value = searchInput, { saveRecent = true } = {}) {
    const nextKeyword = value.trim();
    if (!nextKeyword) {
      handleClearSearch();
      return;
    }

    if (saveRecent) recordRecentQuery(nextKeyword);
    applyPublicView(
      { view: "search", query: nextKeyword, input: nextKeyword, category: null, resultProductId: null },
      { retryIfCurrent: true }
    );
  }

  function handleRetrySearch() {
    setRetryCount((current) => current + 1);
  }

  function handleClearSearch() {
    const previousCategory = previousCategoryRef.current;
    applyPublicView(
      previousCategory
        ? { view: "category", query: "", input: "", category: previousCategory, resultProductId: null }
        : { view: "home", query: "", input: "", category: null, resultProductId: null }
    );
    resultsKeywordRef.current = "";
    setResults([]);
    setHasHiddenOutOfStockMatches(false);
    setError("");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleHistoryClick(value) {
    const nextKeyword = value.trim();
    if (!nextKeyword) return;
    closeLiveDropdown({ abort: true });
    searchInputRef.current = nextKeyword;
    setSearchInput(nextKeyword);
    runFullSearch(nextKeyword);
  }

  function handleRemoveHistoryItem(value) {
    const normalizedValue = value.toLocaleLowerCase("vi-VN");
    const nextHistory = historyRef.current.filter(
      (item) => item.toLocaleLowerCase("vi-VN") !== normalizedValue
    );
    persistRecentHistory(nextHistory);
    setActiveSearchIndex(-1);
    if (nextHistory.length === 0) closeLiveDropdown();
    else setIsDropdownOpen(true);
  }

  function handleClearHistory() {
    persistRecentHistory([]);
    closeLiveDropdown({ abort: true });
  }

  function handleCatalogueProductDetails(product) {
    const productId = Number(product?.productId);
    if (!Number.isSafeInteger(productId) || productId < 1) return;
    applyPublicView(
      { view: "detail", query: createProductDetailQuery(productId), input: searchInputRef.current, category: null },
      { retryIfCurrent: true }
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleLiveProductSelect(product) {
    const productId = Number(product?.productId);
    if (!Number.isSafeInteger(productId) || productId < 1) return;
    const typedQuery = searchInputRef.current.trim();
    if (!typedQuery) return;

    recordRecentQuery(typedQuery);
    applyPublicView(
      {
        view: "search",
        query: typedQuery,
        input: searchInputRef.current,
        category: null,
        resultProductId: productId
      },
      { retryIfCurrent: true }
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSelectCategory(category) {
    if (!category) {
      previousCategoryRef.current = null;
      applyPublicView({ view: "home", query: "", input: "", category: null, resultProductId: null });
      return;
    }

    const nextCategory = { id: Number(category.id), name: String(category.name || "").trim() };
    if (!Number.isInteger(nextCategory.id) || nextCategory.id < 1 || !nextCategory.name) return;
    applyPublicView(
      { view: "category", query: "", input: "", category: nextCategory, resultProductId: null },
      { retryIfCurrent: true }
    );
  }

  function handleLoadMoreCategoryProducts() {
    if (isCategoryLoading || isCategoryLoadingMore || categoryProducts.length >= categoryTotal) return;
    setCategoryPage((current) => current + 1);
  }

  async function handleLoadMoreSearchResults() {
    const searchKeyword = submittedKeywordRef.current.trim();
    const searchRequestKey = `search:${searchKeyword}`;
    if (
      viewModeRef.current !== "search" ||
      !searchKeyword ||
      selectedSearchProductId ||
      isLoadingRef.current ||
      isSearchLoadingMoreRef.current ||
      results.length >= searchTotal
    ) {
      return;
    }

    const nextPage = searchPage + 1;
    const currentRequestId = searchLoadMoreRequestIdRef.current + 1;
    searchLoadMoreRequestIdRef.current = currentRequestId;
    const abortController = new AbortController();
    searchLoadMoreAbortControllerRef.current?.abort();
    searchLoadMoreAbortControllerRef.current = abortController;
    isSearchLoadingMoreRef.current = true;
    setIsSearchLoadingMore(true);
    setSearchLoadMoreError("");

    try {
      const searchResult = await searchPublicProducts(searchKeyword, {
        page: nextPage,
        limit: PUBLIC_SEARCH_PAGE_SIZE,
        signal: abortController.signal,
        timeoutMs: PUBLIC_SEARCH_TIMEOUT_MS
      });
      if (
        abortController.signal.aborted ||
        searchLoadMoreRequestIdRef.current !== currentRequestId ||
        submittedKeywordRef.current.trim() !== searchKeyword ||
        viewModeRef.current !== "search" ||
        resultsKeywordRef.current !== searchRequestKey
      ) {
        return;
      }

      setResults((currentProducts) => mergePublicSearchPages(currentProducts, searchResult.products));
      setSearchTotal((currentTotal) => Math.max(searchResult.totalMatches, currentTotal));
      setSearchPage(searchResult.page);
    } catch {
      if (!abortController.signal.aborted && searchLoadMoreRequestIdRef.current === currentRequestId) {
        setSearchLoadMoreError("Không thể tải thêm sản phẩm lúc này. Vui lòng thử lại.");
      }
    } finally {
      if (searchLoadMoreAbortControllerRef.current === abortController) {
        searchLoadMoreAbortControllerRef.current = null;
      }
      if (!abortController.signal.aborted && searchLoadMoreRequestIdRef.current === currentRequestId) {
        isSearchLoadingMoreRef.current = false;
        setIsSearchLoadingMore(false);
      }
    }
  }

  function handleRetryCategoryProducts() {
    setCategoryRetryCount((current) => current + 1);
  }

  function handleRetrySuggestions() {
    setSuggestionRetryCount((current) => current + 1);
  }

  function handleSearchInputChange(value) {
    searchInputRef.current = value;
    setSearchInput(value);
    closeLiveDropdown({ abort: true });
    if (!value.trim() && isSearchFocusedRef.current && history.length > 0) {
      setIsDropdownOpen(true);
    }
  }

  function handleSearchInputFocus() {
    isSearchFocusedRef.current = true;
    setIsSearchFocused(true);
    const currentKeyword = searchInputRef.current.trim();
    if (!currentKeyword && history.length > 0) {
      setActiveSearchIndex(-1);
      setIsDropdownOpen(true);
      return;
    }
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
    const isRecentDropdown = isDropdownOpen && searchInputRef.current.trim() === "" && recentSearches.length > 0;
    const optionCount = isRecentDropdown ? recentSearches.length : liveSearchProducts.length;

    if (event.key === "Escape") {
      event.preventDefault();
      closeLiveDropdown({ abort: true });
      return;
    }

    if (event.key === "ArrowDown" && isDropdownOpen && optionCount > 0) {
      event.preventDefault();
      setActiveSearchIndex((current) => (current + 1) % optionCount);
      return;
    }

    if (event.key === "ArrowUp" && isDropdownOpen && optionCount > 0) {
      event.preventDefault();
      setActiveSearchIndex((current) => (current <= 0 ? optionCount - 1 : current - 1));
      return;
    }

    if (event.key !== "Enter") return;

    event.preventDefault();
    if (isRecentDropdown && activeSearchIndex >= 0 && recentSearches[activeSearchIndex]) {
      handleHistoryClick(recentSearches[activeSearchIndex]);
      return;
    }
    if (isDropdownOpen && activeSearchIndex >= 0 && liveSearchProducts[activeSearchIndex]) {
      handleLiveProductSelect(liveSearchProducts[activeSearchIndex]);
      return;
    }

    if (!event.currentTarget.value.trim()) return;
    runFullSearch(event.currentTarget.value);
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
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <PublicAdvertisingCarousel />
      <PublicCatalogueHeader
        activeSearchIndex={activeSearchIndex}
        dropdownMode={dropdownMode}
        inputRef={inputRef}
        isDropdownOpen={isDropdownOpen}
        isLoading={isLoading}
        liveSearchError={liveSearchError}
        liveSearchHiddenOutOfStock={liveSearchHiddenOutOfStock}
        liveSearchLoading={liveSearchLoading}
        liveSearchProducts={liveSearchProducts}
        liveSearchTotal={liveSearchTotal}
        onClear={handleClearSearch}
        onClearRecentSearches={handleClearHistory}
        onDismissDropdown={handleDismissDropdown}
        onDropdownActiveIndexChange={setActiveSearchIndex}
        onDropdownSelect={handleLiveProductSelect}
        onDropdownViewAll={() => runFullSearch(searchInput, { saveRecent: false })}
        onInputChange={handleSearchInputChange}
        onInputFocus={handleSearchInputFocus}
        onInputKeyDown={handleSearchInputKeyDown}
        onRemoveRecentSearch={handleRemoveHistoryItem}
        onSelectRecentSearch={handleHistoryClick}
        onSubmit={runFullSearch}
        recentSearches={recentSearches}
        searchFormRef={searchFormRef}
        searchInput={searchInput}
      />
      <PublicCategoryNav
        categories={categories}
        onSelectCategory={handleSelectCategory}
        selectedCategoryId={viewMode === "search" ? null : selectedCategory?.id ?? null}
      />

      <main className="mx-auto w-[min(calc(100%_-_clamp(1.5rem,2vw,3rem)),clamp(80rem,96vw,154rem))] flex-[1_0_auto] pb-8 pt-[clamp(0.875rem,1.1vw,1.5rem)] sm:pb-10">
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
          <>
            <PublicRecentStockUpdatesSection
              isLoading={isRecentStockLoading}
              onViewDetails={handleCatalogueProductDetails}
              products={recentStockUpdates}
            />
            <PublicAvailableProductsSection
              isSuggestionsLoading={isSuggestionsLoading}
              onRetrySuggestions={handleRetrySuggestions}
              onViewDetails={handleCatalogueProductDetails}
              suggestionError={suggestionError}
              suggestions={suggestedProducts}
            />
          </>
        )}

        {hasSelectedCategory && (
          <PublicCategoryResultsSection
            category={selectedCategory}
            error={categoryError}
            hasMore={categoryProducts.length < categoryTotal}
            isLoading={isCategoryLoading}
            isLoadingMore={isCategoryLoadingMore}
            onLoadMore={handleLoadMoreCategoryProducts}
            onResultViewModeChange={handleResultViewModeChange}
            onRetry={handleRetryCategoryProducts}
            onViewDetails={handleCatalogueProductDetails}
            products={categoryProducts}
            resultViewMode={resultViewMode}
            total={categoryTotal}
          />
        )}

        {hasSearched && (
          <section className="mx-auto mt-6 w-full max-w-[100rem] sm:mt-8">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                Kết quả tra cứu {searchResultCount > 0 ? `(${searchResultCount})` : ""}
              </h2>
              {viewMode === "search" && (
                <PublicResultViewSwitcher value={resultViewMode} onChange={handleResultViewModeChange} />
              )}
            </div>

            {isLoading && results.length === 0 && viewMode === "search" && (
              <PublicProductGridSkeleton />
            )}

            {isLoading && results.length === 0 && viewMode === "detail" && (
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
                      Bạn thử kiểm tra lại từ khóa, mã sản phẩm hoặc tên sản phẩm.
                    </p>
                  </>
                )}
              </div>
            )}

            {!error && results.length > 0 && viewMode === "search" && resultViewMode === "card" && (
              <PublicProductGrid onViewDetails={handleCatalogueProductDetails} products={results} />
            )}

            {!error && results.length > 0 && viewMode === "search" && resultViewMode === "table" && (
              <PublicSearchResultsTable products={results} />
            )}

            {!error && viewMode === "search" && results.length > 0 && searchLoadMoreError && (
              <p className="mt-4 text-center text-sm font-medium text-red-700">{searchLoadMoreError}</p>
            )}

            {!error && viewMode === "search" && results.length > 0 && searchLoadMoreCount > 0 && (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={handleLoadMoreSearchResults}
                  disabled={isSearchLoadingMore}
                  className="min-h-11 rounded-xl border border-blue-200 bg-white px-5 text-sm font-extrabold text-[#0b63f6] hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b63f6] disabled:cursor-wait disabled:opacity-60"
                >
                  {isSearchLoadingMore ? "Đang tải..." : <>Xem thêm {searchLoadMoreCount} sản phẩm</>}
                </button>
              </div>
            )}

            {!error && results.length > 0 && viewMode === "detail" && (
              <div className="mx-auto max-w-5xl">
                {results.map((item, index) => (
                  <SearchResultCard
                    key={item.productId || item.id}
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
      <PublicFloatingContactWidget />
      <PublicCatalogueFooter />
    </div>
  );
}
