import { useEffect, useMemo, useRef, useState } from "react";
import { createSupplier, listSuppliers } from "../services/inventoryOperations.service";
import { RECENT_SUPPLIERS_KEY, mergeRecentFirst, readRecentItems, saveRecentItem } from "../utils/recentItems";

export function SupplierSelector({ selectedSupplier, onSelect }) {
  const wrapperRef = useRef(null);
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [recentSuppliers, setRecentSuppliers] = useState(() => readRecentItems(RECENT_SUPPLIERS_KEY));
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: "", phone: "", address: "" });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const displaySuppliers = useMemo(() => {
    if (debouncedKeyword) return suppliers;
    return mergeRecentFirst(recentSuppliers, suppliers);
  }, [debouncedKeyword, recentSuppliers, suppliers]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword.trim()), 300);
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
    <div ref={wrapperRef} className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">Nhà cung cấp</label>
        <p className="mt-1 text-xs text-slate-500">Không bắt buộc, dùng để theo dõi nguồn nhập hàng.</p>
      </div>

      {!selectedSupplier && (
        <div className="relative">
          <input
            className="mt-3 h-10 w-full rounded-md border border-slate-300 bg-white px-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Chọn nhà cung cấp"
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
          />
          <button
            type="button"
            aria-label="Mở danh sách nhà cung cấp"
            onClick={() => {
              setIsOpen((current) => !current);
              setShowCreateForm(false);
            }}
            className="absolute right-3 top-[1.38rem] text-xs text-slate-400 hover:text-slate-700"
          >
            ▾
          </button>

          {isOpen && !showCreateForm && (
            <div className="absolute left-0 right-0 z-20 mt-2 max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
              {isLoading && displaySuppliers.length === 0 && (
                <p className="px-3 py-3 text-sm text-slate-500">Đang tải nhà cung cấp...</p>
              )}
              {!isLoading && displaySuppliers.length === 0 && (
                <p className="px-3 py-3 text-sm text-slate-500">Không tìm thấy nhà cung cấp</p>
              )}
              {displaySuppliers.map((supplier) => (
                  <button
                    key={supplier.id}
                    type="button"
                    onClick={() => handleSelect(supplier)}
                    className="w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-brand-50"
                  >
                    <p className="text-sm font-semibold text-slate-900">{supplier.name}</p>
                    {supplier.phone && <p className="mt-1 text-xs text-slate-600">{supplier.phone}</p>}
                    {supplier.address && <p className="mt-1 text-xs text-slate-500">{supplier.address}</p>}
                  </button>
                ))}
              <button
                type="button"
                onClick={openCreateForm}
                className="sticky bottom-0 w-full border-t border-slate-200 bg-slate-50 px-3 py-3 text-left text-sm font-medium text-brand-700 hover:bg-brand-50 hover:text-brand-900"
              >
                + Thêm nhà cung cấp mới
              </button>
            </div>
          )}
        </div>
      )}

      {selectedSupplier && (
        <div className="mt-3 rounded-md border border-brand-200 bg-white px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{selectedSupplier.name}</p>
              {selectedSupplier.phone && <p className="mt-1 text-sm text-slate-700">{selectedSupplier.phone}</p>}
              {selectedSupplier.address && <p className="mt-1 text-xs text-slate-500">{selectedSupplier.address}</p>}
            </div>
            <button
              type="button"
              onClick={() => {
                onSelect(null);
                setKeyword("");
                setIsOpen(true);
                setShowCreateForm(false);
              }}
              className="text-xs font-medium text-brand-700 hover:text-brand-900"
            >
              Đổi
            </button>
          </div>
        </div>
      )}

      {showCreateForm && (
        <div className="mt-3 space-y-3 rounded-md border border-slate-200 bg-white p-3">
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
              className="h-10 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={isCreating}
              onClick={handleCreateSupplier}
              className="h-10 rounded-md bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreating ? "Đang lưu..." : "Lưu nhà cung cấp"}
            </button>
          </div>
        </div>
      )}

      {info && <p className="mt-3 text-sm text-green-700">{info}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
