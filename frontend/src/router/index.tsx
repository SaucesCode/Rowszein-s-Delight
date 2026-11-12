import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import AuthLayout from "@/layouts/AuthLayout";
import OwnerLayout from "@/layouts/OwnerLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import OwnerHomePage from "@/pages/OwnerHomePage";
import OwnerHomePreviewHarness from "@/pages/owner-home/OwnerHomePreviewHarness";
import DashboardPage from "@/pages/DashboardPage";
import IngredientsPage from "@/pages/IngredientsPage";
import IngredientFormPage from "@/pages/IngredientFormPage";
import ProductsPage from "@/pages/ProductsPage";
import ProductFormPage from "@/pages/ProductFormPage";
import RecipesPage from "@/pages/RecipesPage";
import RecipeFormPage from "@/pages/RecipeFormPage";
import ExpensesPage from "@/pages/ExpensesPage";
import ExpenseFormPage from "@/pages/ExpenseFormPage";
import SalesPage from "@/pages/SalesPage";
import SaleFormPage from "@/pages/SaleFormPage";
import ProfitMarginsPage from "@/pages/ProfitMarginsPage";
import GuestRoute from "@/components/GuestRoute";
import { useMe } from "@/hooks/useAuth";
import { can } from "@/lib/permissions";
import { OperationalCatalogPage, OperationalStockPage } from "@/pages/OperationalPages";

function CatalogRoute() {
  const { data: user } = useMe();
  return can(user, "catalog.manage") ? <ProductsPage /> : <OperationalCatalogPage />;
}

function StockRoute() {
  const { data: user } = useMe();
  return can(user, "stock.manage") ? <IngredientsPage /> : <OperationalStockPage />;
}

const router = createBrowserRouter([
  // ── Public — shop landing page, no auth required ──
  {
    path: "/",
    element: <LandingPage />,
  },

  // ── Visual Verification Preview Harness ──
  {
    path: "/preview/owner-home",
    element: <OwnerHomePreviewHarness />,
  },

  // ── Public — owner login (reached via the hidden nav icon) ──
  {
    element: <GuestRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          {
            path: "/login",
            element: <LoginPage />,
          },
        ],
      },
    ],
  },

  // ── Protected — Owner & Management Panel (Boutique Unified Layout) ──
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <OwnerLayout />,
        children: [
          { path: "/home", element: <OwnerHomePage /> },
          { path: "/dashboard", element: <Navigate to="/home" replace /> },
          { path: "/products", element: <CatalogRoute /> },
          { path: "/products/new", element: <ProductFormPage /> },
          { path: "/products/:id/edit", element: <ProductFormPage /> },
          { path: "/ingredients", element: <StockRoute /> },
          { path: "/ingredients/new", element: <IngredientFormPage /> },
          { path: "/ingredients/:id/edit", element: <IngredientFormPage /> },
          { path: "/recipes", element: <RecipesPage /> },
          { path: "/recipes/new", element: <RecipeFormPage /> },
          { path: "/recipes/:id/edit", element: <RecipeFormPage /> },
          { path: "/expenses", element: <ExpensesPage /> },
          { path: "/expenses/new", element: <ExpenseFormPage /> },
          { path: "/expenses/:id/edit", element: <ExpenseFormPage /> },
          { path: "/sales", element: <SalesPage /> },
          { path: "/sales/new", element: <SaleFormPage /> },
          { path: "/sales/:id/edit", element: <SaleFormPage /> },
          { path: "/analytics", element: <DashboardPage /> },
          { path: "/profit-margins", element: <ProfitMarginsPage /> },
        ],
      },
    ],
  },

  // ── Catch-all — unknown URLs land on the public shop, not the login screen ──
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);

export default function Router() {
  return <RouterProvider router={router} />;
}
