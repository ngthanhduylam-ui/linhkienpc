import { useEffect, useMemo, useState } from "react";
import {
  listActiveProducts,
  listBatchesByProduct,
  stockInRequest
} from "../services/inventoryOperations.service";

export function StockInPage() {
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [productId, setProductId] = useState("");
  const [batchCode, setBatchCode] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedProduct = useMemo(
    () => products.find((product) => String(product.id) === String(productId)) || null,
    [products, productId]
  );
  const selectedBatch = useMemo(
    () => batches.find((batch) => batch.batch_code === batchCode) || null,
    [batches, batchCode]
  );

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      setIsLoading(true);
      setError("");
      try {
        const items = await listActiveProducts();
        if (active) setProducts(items);
      } catch (err) {
        if (active) setError(err?.message || "Khong the tai danh sach SKU.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadProducts();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadBatches() {
      if (!productId) {
        setBatches([]);
        setBatchCode("");
        return;
      }

      setIsLoadingBatches(true);
      setError("");
      try {
        const items = await listBatchesByProduct(productId);
        if (!active) return;
        setBatches(items);
        setBatchCode((prev) => (items.some((item) => item.batch_code === prev) ? prev : ""));
      } catch (err) {
        if (active) {
          setBatches([]);
          setBatchCode("");
          setError(err?.message || "Khong the tai lo bao hanh.");
        }
      } finally {
        if (active) setIsLoadingBatches(false);
      }
    }

    loadBatches();
    return () => {
      active = false;
    };
  }, [productId]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedProduct) {
      setError("Vui long chon SKU.");
      return;
    }
    if (!batchCode) {
      setError("Vui long chon lo bao hanh.");
      return;
    }

    const numericQuantity = Number(quantity);
    if (!Number.isInteger(numericQuantity) || numericQuantity <= 0) {
      setError("So luong phai la so nguyen duong.");
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedBatchCode = batchCode;
      const result = await stockInRequest({
        sku: selectedProduct.sku,
        batch_code: selectedBatchCode,
        quantity: numericQuantity,
        note: note.trim() || undefined
      });
      setSuccess(
        `Nhap kho thanh cong: ${result?.resolved?.sku || selectedProduct.sku} - ${result?.resolved?.batch_code || selectedBatchCode}.`
      );
      setQuantity("");
      setNote("");

      const refreshedBatches = await listBatchesByProduct(productId);
      setBatches(refreshedBatches);
      setBatchCode((prev) =>
        refreshedBatches.some((batch) => batch.batch_code === prev) ? prev : ""
      );
    } catch (err) {
      setError(err?.message || "Nhap kho that bai.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Nhap kho</h2>
      <p className="mt-1 text-sm text-slate-600">Cap nhat ton kho theo SKU va lo bao hanh.</p>

      {isLoading && <p className="mt-4 text-sm text-slate-500">Dang tai du lieu...</p>}
      {!isLoading && (
        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Chon SKU</label>
            <select
              className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
            >
              <option value="">-- Chon SKU --</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.sku} - {product.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Chon lo bao hanh</label>
            <select
              className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-100"
              value={batchCode}
              onChange={(event) => setBatchCode(event.target.value)}
              disabled={!productId || isLoadingBatches}
            >
              <option value="">{isLoadingBatches ? "Dang tai lo..." : "-- Chon lo bao hanh --"}</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.batch_code}>
                  {batch.batch_code} (Ton: {batch.quantity})
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Ton hien tai: <span className="font-semibold">{Number(selectedBatch?.quantity || 0)}</span>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">So luong</label>
            <input
              type="number"
              min={1}
              step={1}
              className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder="Nhap so luong"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Ghi chu</label>
            <textarea
              rows={3}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Nhap ghi chu (khong bat buoc)"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-700">{success}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-11 rounded-md bg-brand-700 px-5 text-sm font-medium text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Dang xu ly..." : "Xac nhan nhap kho"}
          </button>
        </form>
      )}
    </section>
  );
}
