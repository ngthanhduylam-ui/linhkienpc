import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getProductInventoryRequest,
  listActiveCategories,
  listActiveProducts,
  stockInRequest,
  stockOutRequest
} from "../services/inventoryOperations.service";

function stripDiacritics(value) {
return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Quản lý kho</h2>
        <p className="mt-1 text-sm text-slate-600">Tìm sản phẩm, sau đó nhập hoặc xuất kho ngay trên cùng một màn hình.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-12">
        <section className="space-y-5 lg:col-span-7">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Tìm sản phẩm</h3>
            <label className="mt-4 mb-1 block text-sm font-medium text-slate-700">
              Tìm sản phẩm theo tên hoặc SKU
            </label>
            <input
              className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Nhập tên sản phẩm hoặc SKU"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
                setSelectedProductId("");
                setSuccess("");
              }}
            />

            {isLoading && <p className="mt-3 text-sm text-slate-500">Đang tải dữ liệu sản phẩm...</p>}

            {!isLoading && filteredProducts.length > 0 && (
              <div className="mt-4 space-y-2">
                {filteredProducts.map((item) => {
                  const isSelected = String(item.id) === String(selectedProductId);
                  const cardClassName = `w-full rounded-lg border p-3 text-left transition ${
                    isSelected
                      ? "border-brand-600 bg-brand-50"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedProductId(String(item.id));
                        setSearchInput(item.sku);
                        setDebouncedSearch(item.sku);
                        setSuccess("");
                      }}
                      className={cardClassName}
                    >
                      <p className="text-lg font-semibold text-slate-900">{item.name}</p>
                      <p className="mt-2 text-base font-bold text-brand-800">
                        {Number(item.total_quantity || 0)}{" "}
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          tồn hiện tại
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-slate-600">SKU: {item.sku}</p>
                      <p className="mt-1 text-xs text-slate-600">Danh mục: {getCategoryName(item, categories)}</p>
                    </button>
                  );
                })}
              </div>
            )}

            {showFirstProductEmptyState && (
              <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                <p className="text-sm text-slate-700">Chưa có sản phẩm nào. Vui lòng tạo sản phẩm ở mục Sản phẩm trước.</p>
                <Link
                  to="/admin/products"
                  className="mt-3 inline-flex rounded-md border border-brand-600 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
                >
                  Đi tới Sản phẩm
                </Link>
              </div>
            )}

            {showNoResultState && (
              <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                <p className="text-sm text-slate-700">Không tìm thấy sản phẩm. Vui lòng tạo sản phẩm ở mục Sản phẩm trước.</p>
                <Link
                  to="/admin/products"
                  className="mt-3 inline-flex rounded-md border border-brand-600 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
                >
                  Đi tới Sản phẩm
                </Link>
              </div>
            )}
          </div>
        </section>

        <aside className="lg:col-span-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
            <h3 className="text-base font-semibold text-slate-900">Thao tác tồn kho</h3>

            {!selectedProduct ? (
              <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                Chọn sản phẩm bên trái để nhập hoặc xuất kho.
              </p>
            ) : (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-2xl font-bold text-slate-900">{selectedProduct.name}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <p className="text-xs text-slate-600">SKU: {selectedProduct.sku}</p>
                  <p className="text-xs text-slate-600">Danh mục: {getCategoryName(selectedProduct, categories)}</p>
                </div>
                <div className="mt-4 rounded-md bg-white px-4 py-4 text-center">
                  <p className="text-5xl font-extrabold leading-none text-brand-800">{currentStock}</p>
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">TỒN HIỆN TẠI</p>
                </div>
              </div>
            )}

            <div className="mt-4 inline-flex w-full rounded-lg border border-slate-300 bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setActionType("IN")}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                  actionType === "IN" ? "bg-white text-brand-800 shadow-sm" : "text-slate-700 hover:text-slate-900"
                }`}
              >
                Nhập kho
              </button>
              <button
                type="button"
                onClick={() => setActionType("OUT")}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                  actionType === "OUT" ? "bg-white text-brand-800 shadow-sm" : "text-slate-700 hover:text-slate-900"
                }`}
              >
                Xuất kho
              </button>
            </div>

            {selectedProduct && actionType === "OUT" && (
              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-slate-700">Chọn bảo hành</label>
                {isLoadingWarrantyNotes ? (
                  <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                    Đang tải thông tin bảo hành...
                  </p>
                ) : warrantyNoteGroups.length > 0 ? (
                  <select
                    className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                    value={selectedWarrantyNote}
                    onChange={(event) => setSelectedWarrantyNote(event.target.value)}
                  >
                    <option value="">-- Chọn bảo hành --</option>
                    {warrantyNoteGroups.map((group) => (
                      <option key={group.note} value={group.note}>
                        {group.note} - còn {group.quantity}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                    Sản phẩm chưa có ghi chú bảo hành. Có thể xuất kho bằng ghi chú tự do.
                  </p>
                )}
              </div>
            )}

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {actionType === "IN" ? "Số lượng nhập *" : "Số lượng xuất *"}
              </label>
              <input
                type="number"
                min={1}
                max={actionType === "OUT" && selectedWarrantyGroup ? selectedWarrantyGroup.quantity : undefined}
                step={1}
                className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder={actionType === "IN" ? "Nhập số lượng nhập" : "Nhập số lượng xuất"}
              />
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {actionType === "IN" ? "Ghi chú bảo hành / ghi chú nhập hàng" : "Ghi chú xuất kho"}
              </label>
              <textarea
                rows={5}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={actionType === "IN" ? "Ví dụ: BH07.26" : "Nhập lý do hoặc mô tả xuất kho"}
              />
            </div>

            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
            {success && <p className="mt-4 text-sm text-green-700">{success}</p>}

            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="mt-5 h-11 w-full rounded-md bg-brand-700 px-5 text-sm font-medium text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Đang xử lý..." : actionType === "IN" ? "Lưu và nhập kho" : "Xác nhận xuất kho"}
            </button>
          </div>
        </aside>
      </form>
    </section>
  );
}
