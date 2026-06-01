import { Navigate, createBrowserRouter } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminLayout } from "./layouts/AdminLayout";
import { AdminLoginPage } from "./pages/AdminLoginPage";
import { AdminSectionPage } from "./pages/AdminSectionPage";
import { PublicSearchPage } from "./pages/PublicSearchPage";
import { StockInPage } from "./pages/StockInPage";
import { StockOutPage } from "./pages/StockOutPage";
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
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="/admin/products" replace /> },
          { path: "products", element: <AdminSectionPage title="San pham" /> },
          { path: "warranty-batches", element: <AdminSectionPage title="Lo bao hanh" /> },
          { path: "stock-in", element: <StockInPage /> },
          { path: "stock-out", element: <StockOutPage /> },
          { path: "transaction-history", element: <TransactionHistoryPage /> }
        ]
      }
    ]
  }
]);