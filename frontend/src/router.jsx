import { lazy, Suspense } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";

function lazyNamed(loader, exportName) {
  return lazy(() => loader().then((module) => ({ default: module[exportName] })));
}

const AdminLayout = lazyNamed(() => import("./layouts/AdminLayout"), "AdminLayout");
const AdminLoginPage = lazyNamed(() => import("./pages/AdminLoginPage"), "AdminLoginPage");
const CustomerDetailPage = lazyNamed(() => import("./pages/CustomerDetailPage"), "CustomerDetailPage");
const CustomerListPage = lazyNamed(() => import("./pages/CustomerListPage"), "CustomerListPage");
const InventoryCheckPage = lazyNamed(() => import("./pages/InventoryCheckPage"), "InventoryCheckPage");
const OnlineListingPage = lazyNamed(() => import("./pages/OnlineListingPage"), "OnlineListingPage");
const ProductFormPage = lazyNamed(() => import("./pages/ProductFormPage"), "ProductFormPage");
const ProductManagementPage = lazyNamed(() => import("./pages/ProductManagementPage"), "ProductManagementPage");
const PublicSearchPage = lazyNamed(() => import("./pages/PublicSearchPage"), "PublicSearchPage");
const StockInBulkPage = lazyNamed(() => import("./pages/StockInBulkPage"), "StockInBulkPage");
const StockInPage = lazyNamed(() => import("./pages/StockInPage"), "StockInPage");
const StockOutBulkPage = lazyNamed(() => import("./pages/StockOutBulkPage"), "StockOutBulkPage");
const StockOutPage = lazyNamed(() => import("./pages/StockOutPage"), "StockOutPage");
const SkuCategoryRulesPage = lazyNamed(() => import("./pages/SkuCategoryRulesPage"), "SkuCategoryRulesPage");
const SupplierListPage = lazyNamed(() => import("./pages/SupplierListPage"), "SupplierListPage");
const TransactionHistoryPage = lazyNamed(() => import("./pages/TransactionHistoryPage"), "TransactionHistoryPage");
const TransactionVoucherDetailPage = lazyNamed(
  () => import("./pages/TransactionVoucherDetailPage"),
  "TransactionVoucherDetailPage"
);
const TransactionVoucherPrintPage = lazyNamed(
  () => import("./pages/TransactionVoucherPrintPage"),
  "TransactionVoucherPrintPage"
);

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-center text-sm font-semibold text-slate-600">
      Đang tải...
    </div>
  );
}

function withSuspense(element) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
}

export const appRouter = createBrowserRouter([
  {
    path: "/",
    element: withSuspense(<PublicSearchPage />)
  },
  {
    path: "/admin/login",
    element: withSuspense(<AdminLoginPage />)
  },
  {
    path: "/admin",
    element: <ProtectedRoute />,
    children: [
      { path: "stock-out", element: withSuspense(<StockOutBulkPage />) },
      { path: "transaction-history/:voucherId/print", element: withSuspense(<TransactionVoucherPrintPage />) },
      {
        element: withSuspense(<AdminLayout />),
        children: [
          { index: true, element: <Navigate to="/admin/stock-in" replace /> },
          { path: "inventory-workbench", element: <Navigate to="/admin/stock-in" replace /> },
          { path: "products", element: withSuspense(<ProductManagementPage />) },
          { path: "products/new", element: withSuspense(<ProductFormPage />) },
          { path: "products/:id/edit", element: withSuspense(<ProductFormPage />) },
          { path: "suppliers", element: withSuspense(<SupplierListPage />) },
          { path: "customers", element: withSuspense(<CustomerListPage />) },
          { path: "customers/:id", element: withSuspense(<CustomerDetailPage />) },
          { path: "stock-in", element: withSuspense(<StockInBulkPage />) },
          { path: "stock-in-single", element: withSuspense(<StockInPage />) },
          { path: "stock-out-single", element: withSuspense(<StockOutPage />) },
          { path: "stock-out-bulk", element: <Navigate to="/admin/stock-out" replace /> },
          { path: "inventory-check", element: withSuspense(<InventoryCheckPage />) },
          { path: "settings/sku-rules", element: withSuspense(<SkuCategoryRulesPage />) },
          { path: "online-listing", element: withSuspense(<OnlineListingPage />) },
          { path: "transaction-history", element: withSuspense(<TransactionHistoryPage />) },
          { path: "transaction-history/:voucherId", element: withSuspense(<TransactionVoucherDetailPage />) }
        ]
      }
    ]
  }
]);
