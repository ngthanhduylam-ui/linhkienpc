import { useEffect, useMemo, useRef, useState } from "react";
import { createSupplier, listSuppliers } from "../services/inventoryOperations.service";
import {
  RECENT_SUPPLIERS_KEY,
  filterRecentItemsByAvailable,
  mergeRecentFirst,
  readRecentItems,
  saveRecentItem
} from "../utils/recentItems";

export function SupplierSelector({ selectedSupplier, onSelect }) {
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [recentSuppliers, setRecentSuppliers] = useState(() => readRecentItems(RECENT_SUPPLIERS_KEY));
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: "", phone: "", address: "" });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const displaySuppliers = useMemo(() => {
    if (debouncedKeyword) return suppliers;
    return mergeRecentFirst(filterRecentItemsByAvailable(recentSuppliers, suppliers), suppliers);
  }, [debouncedKeyword, recentSuppliers, suppliers]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword.trim()), 250);
    return () => clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    if (!isOpen) return undefined;

    let active = true;

    async function loadSuppliers() {
      setIsLoading(true);
      setError("");
      try {
        const items = await listSuppliers(debouncedKeyword);
        if (!active) return;
        setSuppliers(items);
        setActiveIndex(0);
      } catch (err) {
        if (active) setError(err?.message || "Không thể tải danh sách nhà cung cấp.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadSuppliers();
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

  function handleSelect(supplier) {
    onSelect(supplier);
    setRecentSuppliers(saveRecentItem(RECENT_SUPPLIERS_KEY, supplier, 10));
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
      setActiveIndex((prev) => Math.min(prev + 1, Math.max(0, displaySuppliers.length - 1)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(0, prev - 1));
      return;
    }

    if (event.key === "Enter" && displaySuppliers[activeIndex]) {
      event.preventDefault();
      handleSelect(displaySuppliers[activeIndex]);
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
    }
  }

  function openCreateForm() {
    setIsOpen(false);
    setShowCreateForm(true);
    setError("");
    setInfo("");
    setNewSupplier((prev) => ({ ...prev, name: prev.name || keyword.trim() }));
  }

  function cancelCreateForm() {
    setShowCreateForm(false);
    setNewSupplier({ name: "", phone: "", address: "" });
    setError("");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function handleCreateSupplier() {
    setError("");
    setInfo("");

    const name = newSupplier.name.trim();
    if (!name) {
      setError("Vui lòng nhập tên nhà cung cấp.");
      return;
    }

    setIsCreating(true);
    try {
      const created = await createSupplier({
        name,
        phone: newSupplier.phone.trim() || undefined,
        address: newSupplier.address.trim() || undefined
      });

      onSelect(created);
      setRecentSuppliers(saveRecentItem(RECENT_SUPPLIERS_KEY, created, 10));
      setSuppliers((prev) => [created, ...prev.filter((item) => Number(item.id) !== Number(created.id))]);
      setKeyword("");
      setNewSupplier({ name: "", phone: "", address: "" });
      setShowCreateForm(false);
      setIsOpen(false);
      setInfo(`Đã chọn nhà cung cấp ${created.name}.`);
    } catch (err) {
      setError(err?.message || "Không thể lưu nhà cung cấp.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div ref={wrapperRef} className="space-y-3">
      {!selectedSupplier && (
        <div className="relative">
          <input
            ref={inputRef}
            className="h-11 w-full rounded-md border border-slate-300 bg-white px-4 pr-10 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            placeholder="Tìm theo tên, SĐT nhà cung cấp"
            value={keyword}
            onFocus={() => {
              setIsOpen(true);
              setShowCreateForm(false);
            }}
            onChange={(event) => {
              setKeyword(event.target.value);
              setIsOpen(true);
              setShowCreateForm(false);
              setInfo("");
            }}
            onKeyDown={handleInputKeyDown}
          />
          <button
            type="button"
            aria-label="Mở danh sách nhà cung cấp"
            onClick={() => {
              setIsOpen((current) => !current);
              setShowCreateForm(false);
              window.setTimeout(() => inputRef.current?.focus(), 0);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700"
          >
            ▾
          </button>

          {isOpen && !showCreateForm && (
            <div className="absolute left-0 right-0 z-30 mt-1 max-h-80 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-xl">
              <button
                type="button"
                onClick={openCreateForm}
                className="sticky top-0 z-10 flex w-full items-center gap-2 border-b border-slate-100 bg-blue-50 px-3 py-2.5 text-left text-sm font-semibold text-brand-700 hover:bg-blue-100"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-brand-500 text-base leading-none">+</span>
                <span>Thêm mới nhà cung cấp</span>
              </button>

              {!debouncedKeyword && displaySuppliers.length > 0 && (
                <p className="bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">Gần đây</p>
              )}

              {isLoading && displaySuppliers.length === 0 && (
                <p className="px-3 py-2 text-sm text-slate-500">Đang tải nhà cung cấp...</p>
              )}

              {!isLoading && displaySuppliers.length === 0 && (
                <p className="px-3 py-2 text-sm text-slate-500">Không tìm thấy nhà cung cấp</p>
              )}

              {displaySuppliers.map((supplier, index) => (
                <button
                  key={supplier.id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => handleSelect(supplier)}
                  className={`w-full border-b border-slate-100 px-3 py-2.5 text-left last:border-b-0 ${
                    index === activeIndex ? "bg-blue-50" : "hover:bg-blue-50"
                  }`}
                >
                  <p className="truncate text-sm font-semibold text-slate-900">{supplier.name}</p>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    {supplier.phone && <span>{supplier.phone}</span>}
                    {supplier.address && <span className="truncate">{supplier.address}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedSupplier ? (
        <div className="rounded-md border border-brand-200 bg-blue-50/40 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-slate-900">{selectedSupplier.name}</p>
              {selectedSupplier.phone && <p className="mt-0.5 text-sm text-slate-700">{selectedSupplier.phone}</p>}
              {selectedSupplier.address && <p className="mt-0.5 text-xs text-slate-500">{selectedSupplier.address}</p>}
            </div>
            <button
              type="button"
              onClick={() => {
                onSelect(null);
                setKeyword("");
                setIsOpen(true);
                setShowCreateForm(false);
                window.setTimeout(() => inputRef.current?.focus(), 0);
              }}
              className="shrink-0 text-xs font-semibold text-brand-700 hover:text-brand-900"
            >
              Đổi
            </button>
          </div>
        </div>
      ) : (
        <div className="flex min-h-24 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
          Chưa có thông tin nhà cung cấp
        </div>
      )}

      {showCreateForm && (
        <div className="space-y-2 rounded-md border border-slate-200 bg-white p-3">
          <p className="text-sm font-semibold text-slate-900">Thêm mới nhà cung cấp</p>
          <input
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Tên nhà cung cấp *"
            value={newSupplier.name}
            onChange={(event) => setNewSupplier((prev) => ({ ...prev, name: event.target.value }))}
          />
          <input
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Số điện thoại"
            value={newSupplier.phone}
            onChange={(event) => setNewSupplier((prev) => ({ ...prev, phone: event.target.value }))}
          />
          <input
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Địa chỉ"
            value={newSupplier.address}
            onChange={(event) => setNewSupplier((prev) => ({ ...prev, address: event.target.value }))}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={cancelCreateForm}
              className="h-9 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={isCreating}
              onClick={handleCreateSupplier}
              className="h-9 rounded-md bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreating ? "Đang lưu..." : "Lưu nhà cung cấp"}
            </button>
          </div>
        </div>
      )}

      {info && <p className="text-sm text-green-700">{info}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
