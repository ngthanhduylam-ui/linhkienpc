export function SearchResultCard({ product }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">{product.name}</h3>
      <p className="mt-1 text-sm text-slate-600">SKU: {product.sku}</p>
      <p className="mt-3 text-sm font-medium text-slate-800">Tổng tồn: {product.totalQuantity}</p>

      <div className="mt-4">
        <p className="mb-2 text-sm font-medium text-slate-800">Lô bảo hành</p>
        {product.batches.length > 0 ? (
          <ul className="space-y-2">
            {product.batches.map((batch) => (
              <li
                key={`${product.sku}-${batch.batchCode}`}
                className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700"
              >
                <span>{batch.batchCode}</span>
                <span className="font-medium">{batch.quantity}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">Chưa có lô bảo hành hoạt động.</p>
        )}
      </div>
    </article>
  );
}
