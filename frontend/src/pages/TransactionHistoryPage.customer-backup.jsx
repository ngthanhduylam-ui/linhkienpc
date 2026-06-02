import { useEffect, useMemo, useState } from "react";
import { listStockTransactions } from "../services/inventoryOperations.service";

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN");
}

function mapTxnType(type) {
  if (type === "IN") return "Nhập kho";
  if (type === "OUT") return "Xuất kho";
  return type || "-";
}

export function TransactionHistoryPage() {
  const [skuInput, setSkuInput] = useState("");
  const [txnTypeInput, setTxnTypeInput] = useState("");
  const [filters, setFilters] = useState({
    sku: "",
    txn_type: ""
  });
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const totalPages = useMemo(() => {
    const pages = Math.ceil(total / limit);
    return pages > 0 ? pages : 1;
  }, [total, limit]);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setIsLoading(true);
      setError("");
      try {
        const result = await listStockTransactions({
          sku: filters.sku,
          txn_type: filters.txn_type,
          page,
          limit
        });

        if (!active) return;
        setItems(result.items);
        setTotal(Number(result.meta?.total || 0));
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Không thể tải lịch sử giao dịch.");
        setItems([]);
        setTotal(0);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [filters, page, limit]);

  function handleSearch(event) {
    event.preventDefault();
    setPage(1);
    setFilters({
      sku: skuInput.trim(),
      txn_type: txnTypeInput
    });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Lịch sử giao dịch kho</h2>
      <p className="mt-1 text-sm text-slate-600">Tìm theo SKU và loại giao dịch.</p>

      <form className="mt-5 grid gap-3 md:grid-cols-3" onSubmit={handleSearch}>
        <input
          className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="SKU"
          value={skuInput}
          onChange={(event) => setSkuInput(event.target.value)}
        />
        <select
          className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          value={txnTypeInput}
          onChange={(event) => setTxnTypeInput(event.target.value)}
        >
          <option value="">Tất cả loại</option>
          <option value="IN">Nhập kho</option>
          <option value="OUT">Xuất kho</option>
        </select>
        <button
          type="submit"
          className="h-11 rounded-md bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-900"
        >
          Tìm kiếm
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">Ngày giờ</th>
              <th className="px-3 py-2 font-medium">SKU</th>
              <th className="px-3 py-2 font-medium">Số lượng</th>
              <th className="px-3 py-2 font-medium">Loại</th>
              <th className="px-3 py-2 font-medium">Ghi chú</th>
              <th className="px-3 py-2 font-medium">Admin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr>
                <td className="px-3 py-4 text-slate-500" colSpan={6}>
                  Đang tải dữ liệu...
                </td>
              </tr>
            )}

            {!isLoading && items.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-slate-500" colSpan={6}>
                  Không có giao dịch phù hợp.
                </td>
              </tr>
            )}

            {!isLoading &&
              items.map((item) => (
                <tr key={item.id} className="bg-white">
                  <td className="px-3 py-2 text-slate-700">{formatDateTime(item.occurred_at)}</td>
                  <td className="px-3 py-2 text-slate-700">{item.product?.sku || "-"}</td>
                  <td className="px-3 py-2 text-slate-700">{item.quantity}</td>
                  <td className="px-3 py-2 text-slate-700">{mapTxnType(item.txn_type)}</td>
                  <td className="px-3 py-2 text-slate-700">{item.note || "-"}</td>
                  <td className="px-3 py-2 text-slate-700">{item.created_by_admin?.username || "-"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Tổng: <span className="font-medium">{total}</span>
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1 || isLoading}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Trước
          </button>
          <span className="text-sm text-slate-700">
            Trang {page} / {totalPages}
          </span>
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
    </section>
  );
}
