import { Navigate, createBrowserRouter } from "react-router-dom";
import { PublicSearchPage } from "./pages/PublicSearchPage";
import { AdminLoginPage } from "./pages/AdminLoginPage";
import { AdminLayout } from "./layouts/AdminLayout";
import { AdminSectionPage } from "./pages/AdminSectionPage";

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
    element: <AdminLayout />,
    children: [
      { index: true, element: <Navigate to="/admin/products" replace /> },
      { path: "products", element: <AdminSectionPage title="Products" /> },
      { path: "warranty-batches", element: <AdminSectionPage title="Warranty Batches" /> },
      { path: "stock-in", element: <AdminSectionPage title="Stock In" /> },
      { path: "stock-out", element: <AdminSectionPage title="Stock Out" /> },
      { path: "transaction-history", element: <AdminSectionPage title="Transaction History" /> }
    ]
  }
]);
