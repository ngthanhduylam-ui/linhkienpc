import { Navigate } from "react-router-dom";

export function StockOutPage() {
  return <Navigate to="/admin/inventory-workbench" replace />;
}
