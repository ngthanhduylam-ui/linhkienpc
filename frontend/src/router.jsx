import { Navigate, createBrowserRouter } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminLayout } from "./layouts/AdminLayout";
import { AdminLoginPage } from "./pages/AdminLoginPage";
import { CustomerDetailPage } from "./pages/CustomerDetailPage";
import { CustomerListPage } from "./pages/CustomerListPage";
import { InventoryCheckPage } from "./pages/InventoryCheckPage";
import { ProductFormPage } from "./pages/ProductFormPage";
import { ProductManagementPage } from "./pages/ProductManagementPage";
import { PublicSearchPage } from "./pages/PublicSearchPage";
import { StockInBulkPage } from "./pages/StockInBulkPage";
import { StockInPage } from "./pages/StockInPage";
import { StockOutBulkPage } from "./pages/StockOutBulkPage";
import { StockOutPage } from "./pages/StockOutPage";
import { SupplierListPage } from "./pages/SupplierListPage";
import { TransactionHistoryPage } from "./pages/TransactionHistoryPage";

export const appRouter = createBrowserRouter([
  {
    path: "/",
    element: <PublicSearchPage />
  },
  {
    path: "/admin/login",
    element: <AdminLoginPage />
  },
  {
    path: "/admin",
    element: <ProtectedRoute />,
    children: [
      { path: "stock-out", element: <StockOutBulkPage /> },
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="/admin/stock-in" replace /> },
          { path: "inventory-workbench", element: <Navigate to="/admin/stock-in" replace /> },
          { path: "products", element: <ProductManagementPage /> },
          { path: "products/new", element: <ProductFormPage /> },
          { path: "products/:id/edit", element: <ProductFormPage /> },
          { path: "suppliers", element: <SupplierListPage /> },
          { path: "customers", element: <CustomerListPage /> },
          { path: "customers/:id", element: <CustomerDetailPage /> },
          { path: "stock-in", element: <StockInBulkPage /> },
          { path: "stock-in-single", element: <StockInPage /> },
          { path: "stock-out-single", element: <StockOutPage /> },
          { path: "stock-out-bulk", element: <Navigate to="/admin/stock-out" replace /> },
          { path: "inventory-check", element: <InventoryCheckPage /> },
          { path: "transaction-history", element: <TransactionHistoryPage /> }
        ]
      }
    ]
  }
]);
