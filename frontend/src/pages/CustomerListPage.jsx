import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  activateCustomerRequest,
  createCustomer,
  deactivateCustomerRequest,
  listCustomersPage,
  updateCustomerRequest
} from "../services/inventoryOperations.service";

const STATUS_OPTIONS = [
  { value: "active", label: "Đang giao dịch" },
  { value: "inactive", label: "Ngừng giao dịch" },
  { value: "all", label: "Tất cả" }
];

const EMPTY_CUSTOMER = { name: "", phone: "", address: "" };

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN");
}

function getIsActiveFilter(status) {
  if (status === "active") return true;
  if (status === "inactive") return false;
  return undefined;
}

function getShortAddress(address) {
  if (!address) return "-";
  return address.length > 48 ? `${address.slice(0, 48)}...` : address;
}

function StatusBadge({ isActive }) {
  return (
    <span
      className={
        isActive
          ? "inline-flex rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700"
          : "inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
      }
    >
      {isActive ? "Đang giao dịch" : "Ngừng giao dịch"}
    </span>
  );
}

function TextField({ label, value, onChange, placeholder, required = false, textarea = false }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {textarea ? (
        <textarea
          className="mt-1.5 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}

function FormCard({ title, children }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-3">
        <h4 className="text-base font-semibold text-slate-900">{title}</h4>
      </div>
      <div className="space-y-4 px-5 py-4">{children}</div>
    </section>
  );
}

function CustomerFormModal({ title, submitLabel, form, setForm, isSubmitting, isActive, showStatus = false, onCancel, onSubmit }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 px-4 py-5">
      <div className="mx-auto max-w-3xl rounded-md border border-slate-200 bg-slate-100 shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="h-9 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting}
              className="h-9 rounded-md bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-60"
            >
              {isSubmitting ? "Đang lưu..." : submitLabel}
            </button>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="space-y-4">
            <FormCard title="Thông tin chung">
              <TextField
                label="Tên khách hàng"
                required
                value={form.name}
                onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
                placeholder="Nhập tên khách hàng"
              />
              <div className={showStatus ? "grid gap-4 md:grid-cols-2" : ""}>
                <TextField
                  label="Số điện thoại"
                  value={form.phone}
                  onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))}
                  placeholder="Nhập số điện thoại"
                />
                {showStatus && (
                  <div className="rounded-md bg-slate-50 px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trạng thái</p>
                    <div className="mt-1"><StatusBadge isActive={isActive} /></div>
                  </div>
                )}
              </div>
            </FormCard>

            <FormCard title="Địa chỉ">
              <TextField
                label="Địa chỉ cụ thể"
                value={form.address}
                onChange={(value) => setForm((prev) => ({ ...prev, address: value }))}
                placeholder="Nhập địa chỉ khách hàng"
              />
            </FormCard>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CustomerListPage() {
  const navigate = useNavigate();
  const [keywordInput, setKeywordInput] = useState("");
  const keywordInputRef = useRef(null);
  const [filters, setFilters] = useState({ keyword: "", status: "active" });
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState(EMPTY_CUSTOMER);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editCustomer, setEditCustomer] = useState(EMPTY_CUSTOMER);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  async function loadCustomers(active = true) {
    setIsLoading(true);
    setError("");
    try {
      const result = await listCustomersPage({
        keyword: filters.keyword,
        page,
        limit,
        is_active: getIsActiveFilter(filters.status)
      });
      if (!active) return;
      setItems(result.items || []);
      setTotal(Number(result.meta?.total || 0));
    } catch (err) {
      if (!active) return;
      setError(err?.message || "Không thể tải danh sách khách hàng.");
      setItems([]);
      setTotal(0);
    } finally {
      if (active) setIsLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    loadCustomers(active);
    return () => {
      active = false;
    };
  }, [filters, page, limit]);

  function handleSearch(event) {
    event.preventDefault();
    setPage(1);
    setFilters((prev) => ({ ...prev, keyword: keywordInput.trim() }));
  }

  function handleStatusChange(event) {
    setPage(1);
    setFilters((prev) => ({ ...prev, status: event.target.value }));
  }

  function handleClearSearch() {
    setKeywordInput("");
    setPage(1);
    setFilters((prev) => ({ ...prev, keyword: "" }));
    window.setTimeout(() => keywordInputRef.current?.focus(), 0);
  }

  function closeModal() {
    setIsModalOpen(false);
    setNewCustomer(EMPTY_CUSTOMER);
    setError("");
  }

  function openEditModal(customer) {
    setError("");
    setSuccess("");
    setEditingCustomer(customer);
    setEditCustomer({
      name: customer.name || "",
      phone: customer.phone || "",
      address: customer.address || ""
    });
  }

  function closeEditModal() {
    setEditingCustomer(null);
    setEditCustomer(EMPTY_CUSTOMER);
    setError("");
  }

  async function handleCreateCustomer() {
    setError("");
    setSuccess("");
    const name = newCustomer.name.trim();
    if (!name) {
      setError("Vui lòng nhập tên khách hàng.");
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createCustomer({
        name,
        phone: newCustomer.phone.trim() || undefined,
        address: newCustomer.address.trim() || undefined
      });
      setSuccess(`Đã tạo khách hàng ${created.name}.`);
      setIsModalOpen(false);
      setNewCustomer(EMPTY_CUSTOMER);
      setPage(1);
      setFilters({ keyword: "", status: "active" });
      setKeywordInput("");
      await loadCustomers(true);
    } catch (err) {
      setError(err?.message || "Tạo khách hàng thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateCustomer() {
    if (!editingCustomer) return;

    setError("");
    setSuccess("");
    const name = editCustomer.name.trim();
    if (!name) {
      setError("Vui lòng nhập tên khách hàng.");
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await updateCustomerRequest(editingCustomer.id, {
        name,
        phone: editCustomer.phone.trim() || undefined,
        address: editCustomer.address.trim() || undefined
      });
      setSuccess(`Đã cập nhật khách hàng ${updated.name}.`);
      closeEditModal();
      await loadCustomers(true);
    } catch (err) {
      setError(err?.message || "Cập nhật khách hàng thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeactivateCustomer(customer) {
    const confirmed = window.confirm(`Ngừng giao dịch với khách hàng "${customer.name}"?`);
    if (!confirmed) return;

    setError("");
    setSuccess("");
    setIsSubmitting(true);
    try {
      await deactivateCustomerRequest(customer.id);
      setSuccess(`Đã ngừng giao dịch với khách hàng ${customer.name}.`);
      await loadCustomers(true);
    } catch (err) {
      setError(err?.message || "Ngừng giao dịch khách hàng thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleActivateCustomer(customer) {
    const confirmed = window.confirm(`Khôi phục giao dịch với khách hàng "${customer.name}"?`);
    if (!confirmed) return;

    setError("");
    setSuccess("");
    setIsSubmitting(true);
    try {
      await activateCustomerRequest(customer.id);
      setSuccess(`Đã khôi phục khách hàng ${customer.name}.`);
      await loadCustomers(true);
    } catch (err) {
      setError(err?.message || "Khôi phục khách hàng thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Khách hàng</h2>
          <p className="mt-1 text-sm text-slate-600">Quản lý thông tin khách hàng và lịch sử giao dịch kho.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError("");
            setSuccess("");
            setIsModalOpen(true);
          }}
          className="h-10 rounded-md bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-900"
        >
          + Thêm khách hàng
        </button>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto]" onSubmit={handleSearch}>
          <div className="relative">
            <input
              ref={keywordInputRef}
              className="h-10 w-full rounded-md border border-slate-300 px-3 pr-10 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              placeholder="Tìm theo tên, SĐT khách hàng"
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
            />
            {keywordInput && (
              <button
                type="button"
                aria-label="Xóa tìm kiếm"
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            )}
          </div>

          <select
            className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            value={filters.status}
            onChange={handleStatusChange}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <button
            type="submit"
            className="h-10 rounded-md bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-900"
          >
            Tìm kiếm
          </button>
        </form>

        {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {success && <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>}

        <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
          <div
            className="hidden grid-cols-[minmax(240px,1.3fr)_150px_minmax(260px,1fr)_140px_190px] gap-3 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid"
          >
            <span>Tên khách hàng</span>
            <span>SĐT</span>
            <span>Địa chỉ</span>
            <span>Trạng thái</span>
            <span className="text-right">Thao tác</span>
          </div>

          {isLoading && <p className="px-4 py-5 text-sm text-slate-500">Đang tải dữ liệu...</p>}

          {!isLoading && items.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium text-slate-700">Không có khách hàng phù hợp.</p>
              <p className="mt-1 text-xs text-slate-500">Thử đổi từ khóa hoặc trạng thái.</p>
            </div>
          )}

          {!isLoading && items.map((customer) => (
            <div
              key={customer.id}
              onClick={() => navigate(`/admin/customers/${customer.id}`)}
              className="cursor-pointer border-t border-slate-100 px-4 py-3 text-sm hover:bg-blue-50/50 md:grid md:grid-cols-[minmax(240px,1.3fr)_150px_minmax(260px,1fr)_140px_190px] md:items-center md:gap-3"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">{customer.name}</p>
                <p className="mt-0.5 text-xs text-slate-500 md:hidden">{customer.phone || "-"}</p>
              </div>
              <p className="hidden text-slate-700 md:block">{customer.phone || "-"}</p>
              <p className="mt-1 truncate text-slate-600 md:mt-0" title={customer.address || ""}>{getShortAddress(customer.address)}</p>
              <div className="mt-2 md:mt-0"><StatusBadge isActive={customer.is_active} /></div>
              <div className="mt-3 md:mt-0 md:text-right">
                <div className="flex flex-wrap justify-start gap-2 md:justify-end">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openEditModal(customer);
                    }}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Sửa
                  </button>
                  {customer.is_active ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDeactivateCustomer(customer);
                      }}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Ngừng
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleActivateCustomer(customer);
                      }}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Khôi phục
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">Tổng: <span className="font-medium">{total}</span></p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1 || isLoading}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Trước
            </button>
            <span className="text-sm text-slate-700">Trang {page} / {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((prev) => (prev < totalPages ? prev + 1 : prev))}
              disabled={page >= totalPages || isLoading}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Sau
            </button>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <CustomerFormModal
          title="Thêm khách hàng"
          submitLabel="Lưu"
          form={newCustomer}
          setForm={setNewCustomer}
          isSubmitting={isSubmitting}
          isActive
          showStatus={false}
          onCancel={closeModal}
          onSubmit={handleCreateCustomer}
        />
      )}

      {editingCustomer && (
        <CustomerFormModal
          title="Sửa khách hàng"
          submitLabel="Lưu thay đổi"
          form={editCustomer}
          setForm={setEditCustomer}
          isSubmitting={isSubmitting}
          isActive={editingCustomer.is_active}
          showStatus
          onCancel={closeEditModal}
          onSubmit={handleUpdateCustomer}
        />
      )}
    </section>
  );
}
