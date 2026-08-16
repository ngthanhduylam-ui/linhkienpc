import { derivePublicSearchTableRow, PUBLIC_SEARCH_TABLE_COLUMNS } from "../../utils/publicSearchResultsView";

function WarrantyLines({ lines, compact = false }) {
  if (!lines.length) return null;

  return (
    <div className={compact ? "space-y-0.5" : "space-y-1"}>
      {lines.map((line, index) => (
        <div key={`${line.label}-${index}`} className="flex min-w-0 items-start justify-between gap-2">
          <span className="min-w-0 [overflow-wrap:anywhere]">{line.label}</span>
          {line.quantity > 0 && <span className="shrink-0 font-semibold text-slate-700">×{line.quantity}</span>}
        </div>
      ))}
    </div>
  );
}

export function PublicSearchResultsTable({ products }) {
  const rows = (Array.isArray(products) ? products : []).map(derivePublicSearchTableRow);

  return (
    <div className="mx-auto w-full max-w-[100rem]">
      <div className="hidden overflow-hidden border border-slate-300 bg-white min-[900px]:block">
        <table className="w-full table-fixed border-collapse text-sm text-slate-800">
          <colgroup>
            <col className="w-[58%]" />
            <col className="w-[23%]" />
            <col className="w-[7%]" />
            <col className="w-[12%]" />
          </colgroup>
          <thead className="bg-slate-100 text-slate-800">
            <tr>
              {PUBLIC_SEARCH_TABLE_COLUMNS.map((column, index) => (
                <th
                  key={column}
                  scope="col"
                  className={`border-b border-r border-slate-300 px-3 py-2.5 text-sm font-bold last:border-r-0 ${
                    index === 0 || index === 1 ? "text-left" : "text-center"
                  }`}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.productId || `${row.name}-${index}`} className="odd:bg-white even:bg-slate-50/70">
                <td className="border-b border-r border-slate-200 px-3 py-2.5 align-top last:border-r-0">
                  <p className="whitespace-normal font-semibold leading-5 text-slate-950 [overflow-wrap:anywhere]">{row.name}</p>
                  {row.specSummary && (
                    <p className="mt-1 whitespace-pre-wrap text-[13px] leading-5 text-slate-600 [overflow-wrap:anywhere]">
                      {row.specSummary}
                    </p>
                  )}
                </td>
                <td className="border-b border-r border-slate-200 px-3 py-2.5 align-top text-[13px] leading-5 last:border-r-0">
                  <WarrantyLines lines={row.warrantyLines} />
                </td>
                <td className="border-b border-r border-slate-200 px-2 py-2.5 text-center align-top text-base font-bold text-slate-900 last:border-r-0">
                  {row.totalQuantity}
                </td>
                <td className="border-b border-slate-200 px-3 py-2.5 text-right align-top font-bold text-brand-700">
                  <span className="whitespace-nowrap">{row.price}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-y border-slate-300 bg-white min-[900px]:hidden" role="list" aria-label="Kết quả tra cứu dạng bảng">
        {rows.map((row, index) => (
          <article
            key={row.productId || `${row.name}-${index}`}
            className="min-w-0 border-b border-slate-200 px-3 py-3 last:border-b-0"
            role="listitem"
          >
            <p className="whitespace-normal text-sm font-bold leading-5 text-slate-950 [overflow-wrap:anywhere]">{row.name}</p>
            {row.specSummary && (
              <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600 [overflow-wrap:anywhere]">{row.specSummary}</p>
            )}
            {row.warrantyLines.length > 0 && (
              <div className="mt-2 border-t border-slate-100 pt-2 text-xs leading-5 text-slate-700">
                <span className="mb-0.5 block font-semibold text-slate-500">Bảo hành / ghi chú</span>
                <WarrantyLines lines={row.warrantyLines} compact />
              </div>
            )}
            <div className="mt-2 grid grid-cols-2 gap-3 border-t border-slate-100 pt-2 text-sm">
              <p><span className="font-semibold text-slate-500">SL:</span> <strong className="text-slate-900">{row.totalQuantity}</strong></p>
              <p className="text-right"><span className="font-semibold text-slate-500">Giá:</span> <strong className="whitespace-nowrap text-brand-700">{row.price}</strong></p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
