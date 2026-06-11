import { useEffect, useMemo, useRef, useState } from "react";
import { createCustomer, listCustomers } from "../services/inventoryOperations.service";
import {
  RECENT_CUSTOMERS_KEY,
  filterRecentItemsByAvailable,
  mergeRecentFirst,
  readRecentItems,
  saveRecentItem
} from "../utils/recentItems";

function isActiveItem(item) {
  return item?.is_active !== false;
}

export function CustomerSelector({ selectedCustomer, onSelect, variant = "default", disabled = false }) {
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const isPosVariant = variant === "pos";
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [customers, setCustomers] = useState([]);
  const [recentCustomers, setRecentCustomers] = useState(() => readRecentItems(RECENT_CUSTOMERS_KEY));
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", address: "" });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const activeCustomers = useMemo(() => customers.filter(isActiveItem), [customers]);

  const displayCustomers = useMemo(() => {
    if (debouncedKeyword) return activeCustomers;
    return mergeRecentFirst(filterRecentItemsByAvailable(recentCustomers, activeCustomers), activeCustomers);
  }, [activeCustomers, debouncedKeyword, recentCustomers]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword.trim()), 250);
    return () => clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    if (!isOpen) return undefined;

    let active = true;

    async function loadCustomers() {
      setIsLoading(true);
      setError("");
      try {
        const items = await listCustomers(debouncedKeyword);
        if (!active) return;
        setCustomers(items.filter(isActiveItem));
        setActiveIndex(0);
      } catch (err) {
        if (active) setError(err?.message || "Không thể tải danh sách khách hàng.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadCustomers();
    return () => {
      active = false;
    };
  }, [debouncedKeyword, isOpen]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!wrapperRef.current || wrapperRef.current.contains(event.target)) return;
      setIsOpen(false);
      setShowCreateForm(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(customer) {
    if (disabled) return;
    if (!isActiveItem(customer)) return;
    onSelect(customer);
    setRecentCustomers(saveRecentItem(RECENT_CUSTOMERS_KEY, customer, 10));
    setKeyword("");
    setIsOpen(false);
    setShowCreateForm(false);
    setInfo("");
    setError("");
  }

  function handleInputKeyDown(event) {
    if (!isOpen || showCreateForm) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, Math.max(0, displayCustomers.length - 1)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(0, prev - 1));
      return;
    }

    if (event.key === "Enter" && displayCustomers[activeIndex]) {
      event.preventDefault();
      handleSelect(displayCustomers[activeIndex]);
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
    }
  }

  function openCreateForm() {
    if (disabled) return;
    setIsOpen(false);
    setShowCreateForm(true);
    setError("");
    setInfo("");
    setNewCustomer((prev) => ({
      ...prev,
      name: prev.name || keyword.trim()
    }));
  }

  function cancelCreateForm() {
    setShowCreateForm(false);
    setNewCustomer({ name: "", phone: "", address: "" });
    setError("");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function handleCreateCustomer() {
    if (disabled) return;
    setError("");
    setInfo("");

    const name = newCustomer.name.trim();
    if (!name) {
      setError("Vui lòng nhập tên khách hàng.");
      return;
    }

    setIsCreating(true);
    try {
      const created = await createCustomer({
        name,
        phone: newCustomer.phone.trim() || undefined,
        address: newCustomer.address.trim() || undefined
      });

      onSelect(created);
      setRecentCustomers(saveRecentItem(RECENT_CUSTOMERS_KEY, created, 10));
      setCustomers((prev) => [created, ...prev.filter((item) => Number(item.id) !== Number(created.id))]);
      setKeyword("");
      setNewCustomer({ name: "", phone: "", address: "" });
      setShowCreateForm(false);
      setIsOpen(false);
      setInfo(`Đã chọn khách hàng ${created.name}.`);
    } catch (err) {
      setError(err?.message || "Không thể lưu khách hàng.");
    } finally {
      setIsCreating(false);
    }
  }

  const rootClassName = isPosVariant
    ? "relative"
    : "mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3";
  const inputClassName = isPosVariant
    ? "mt-1 h-8 w-full rounded border border-slate-300 bg-white px-2.5 pr-8 text-sm outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
    : "mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";
  const dropdownClassName = isPosVariant
    ? "absolute left-0 right-0 z-40 mt-1 max-h-56 overflow-y-auto rounded border border-slate-300 bg-white shadow-xl"
    : "absolute left-0 right-0 z-20 mt-1 max-h-72 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg";
  const customerRowClassName = (index) =>
    `w-full border-b border-slate-100 text-left last:border-b-0 ${
      isPosVariant ? "px-2.5 py-1.5" : "px-3 py-2"
    } ${index === activeIndex ? "bg-brand-50" : "hover:bg-brand-50"}`;
  const createButtonClassName = isPosVariant
    ? "sticky bottom-0 w-full border-t border-slate-200 bg-slate-50 px-2.5 py-2 text-left text-xs font-semibold text-brand-700 hover:bg-brand-50 hover:text-brand-900"
    : "sticky bottom-0 w-full border-t border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm font-medium text-brand-700 hover:bg-brand-50 hover:text-brand-900";
  const selectedCardClassName = isPosVariant
    ? "mt-2 rounded-md border border-slate-200 bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-100"
    : "mt-3 rounded-md border border-brand-200 bg-white px-3 py-2.5";

  return (
    <div ref={wrapperRef} className={rootClassName}>
      <div>
        <label className="block text-sm font-semibold text-slate-700">Khách hàng</label>
        {!isPosVariant && (
          <p className="mt-1 text-xs text-slate-500">Không bắt buộc, dùng để dễ tra cứu lại giao dịch.</p>
        )}
      </div>

      {!selectedCustomer && (
        <div className="relative">
          <input
            ref={inputRef}
            className={inputClassName}
            placeholder={isPosVariant ? "Tìm khách hàng" : "Chọn khách hàng"}
            value={keyword}
            disabled={disabled}
            onFocus={() => {
              if (disabled) return;
              setIsOpen(true);
              setShowCreateForm(false);
            }}
            onClick={() => {
              if (disabled) return;
              setIsOpen(true);
              setShowCreateForm(false);
            }}
            onChange={(event) => {
              if (disabled) return;
              setKeyword(event.target.value);
              setIsOpen(true);
              setShowCreateForm(false);
              setInfo("");
            }}
            onKeyDown={handleInputKeyDown}
          />
          <button
            type="button"
            aria-label="Mở danh sách khách hàng"
            onClick={() => {
              if (disabled) return;
              setIsOpen((current) => !current);
              setShowCreateForm(false);
              window.setTimeout(() => inputRef.current?.focus(), 0);
            }}
            disabled={disabled}
            className={`absolute right-2.5 text-xs text-slate-400 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 ${
              isPosVariant ? "top-[1.15rem]" : "top-[1.1rem]"
            }`}
          >
            ▾
          </button>

          {isOpen && !showCreateForm && (
            <div className={dropdownClassName}>
              {!debouncedKeyword && displayCustomers.length > 0 && (
                <p className="border-b border-slate-100 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase text-slate-500">
                  Gần đây
                </p>
              )}

              {isLoading && displayCustomers.length === 0 && (
                <p className="px-2.5 py-2 text-sm text-slate-500">Đang tải khách hàng...</p>
              )}

              {!isLoading && displayCustomers.length === 0 && (
                <p className="px-2.5 py-2 text-sm text-slate-500">Không tìm thấy khách hàng</p>
              )}

              {displayCustomers.map((customer, index) => (
                <button
                  key={customer.id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => handleSelect(customer)}
                  className={customerRowClassName(index)}
                >
                  {isPosVariant ? (
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{customer.name}</p>
                      {customer.phone && <p className="mt-0.5 truncate text-[11px] text-slate-500">{customer.phone}</p>}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{customer.name}</p>
                        {customer.phone && <span className="shrink-0 text-xs font-medium text-slate-600">{customer.phone}</span>}
                      </div>
                      <div className="mt-0.5 flex min-w-0 gap-x-3 text-xs text-slate-500">
                        {customer.address && <span className="truncate">{customer.address}</span>}
                      </div>
                    </>
                  )}
                </button>
              ))}

              <button
                type="button"
                onClick={openCreateForm}
                className={createButtonClassName}
              >
                + Thêm khách hàng mới
              </button>
            </div>
          )}
        </div>
      )}

      {selectedCustomer && (
        <div className={selectedCardClassName}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className={isPosVariant ? "truncate text-base font-bold leading-tight text-slate-950" : "text-sm font-semibold text-slate-900"}>{selectedCustomer.name}</p>
              {selectedCustomer.phone && <p className={isPosVariant ? "mt-1 truncate text-xs font-medium text-slate-500" : "mt-0.5 truncate text-xs text-slate-500"}>{selectedCustomer.phone}</p>}
              {!isPosVariant && !selectedCustomer.phone && selectedCustomer.address && (
                <p className="mt-0.5 truncate text-xs text-slate-600">{selectedCustomer.address}</p>
              )}
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                onSelect(null);
                setKeyword("");
                setIsOpen(true);
                setShowCreateForm(false);
                window.setTimeout(() => inputRef.current?.focus(), 0);
              }}
              className={isPosVariant
                ? "shrink-0 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                : "shrink-0 text-xs font-semibold text-brand-700 hover:text-brand-900 disabled:cursor-not-allowed disabled:opacity-50"
              }
            >
              Đổi
            </button>
          </div>
        </div>
      )}

      {showCreateForm && (
        <div className="mt-3 space-y-2 rounded-md border border-slate-200 bg-white p-3">
          <input
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
            placeholder="Tên khách hàng *"
            value={newCustomer.name}
            disabled={disabled}
            onChange={(event) => setNewCustomer((prev) => ({ ...prev, name: event.target.value }))}
          />
          <input
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
            placeholder="Số điện thoại"
            value={newCustomer.phone}
            disabled={disabled}
            onChange={(event) => setNewCustomer((prev) => ({ ...prev, phone: event.target.value }))}
          />
          {!isPosVariant && (
            <input
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
              placeholder="Địa chỉ"
              value={newCustomer.address}
              disabled={disabled}
              onChange={(event) => setNewCustomer((prev) => ({ ...prev, address: event.target.value }))}
            />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={cancelCreateForm}
              className="h-9 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={disabled || isCreating}
              onClick={handleCreateCustomer}
              className="h-9 rounded-md bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreating ? "Đang lưu..." : "Lưu khách hàng"}
            </button>
          </div>
        </div>
      )}

      {info && <p className="mt-3 text-sm text-green-700">{info}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
