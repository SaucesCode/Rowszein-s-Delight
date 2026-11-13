import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import AuthLayout from "@/layouts/AuthLayout";
import OwnerLayout from "@/layouts/OwnerLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import GuestRoute from "@/components/GuestRoute";
import LoginPage from "@/pages/LoginPage";
import { useMe } from "@/hooks/useAuth";
import { can } from "@/lib/permissions";

// Each page downloads on first visit; OwnerLayout shows a skeleton meanwhile.
const ShopPage = lazy(() => import("@/pages/shop/ShopPage"));
const OwnerHomePreviewHarness = lazy(() => import("@/pages/owner-home/OwnerHomePreviewHarness"));
const OwnerHomePage = lazy(() => import("@/pages/OwnerHomePage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const IngredientsPage = lazy(() => import("@/pages/IngredientsPage"));
const IngredientFormPage = lazy(() => import("@/pages/IngredientFormPage"));
const ProductsPage = lazy(() => import("@/pages/ProductsPage"));
const ProductFormPage = lazy(() => import("@/pages/ProductFormPage"));
const RecipesPage = lazy(() => import("@/pages/RecipesPage"));
const RecipeFormPage = lazy(() => import("@/pages/RecipeFormPage"));
const ExpensesPage = lazy(() => import("@/pages/ExpensesPage"));
const ExpenseFormPage = lazy(() => import("@/pages/ExpenseFormPage"));
const SalesPage = lazy(() => import("@/pages/SalesPage"));
const SaleFormPage = lazy(() => import("@/pages/SaleFormPage"));
const OperationalCatalogPage = lazy(() => import("@/pages/OperationalPages").then(module => ({ default: module.OperationalCatalogPage })));
const OperationalStockPage = lazy(() => import("@/pages/OperationalPages").then(module => ({ default: module.OperationalStockPage })));

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
    element: <Suspense fallback={null}><ShopPage /></Suspense>,
  },

  // ── Visual Verification Preview Harness ──
  {
    path: "/preview/owner-home",
    element: <Suspense fallback={null}><OwnerHomePreviewHarness /></Suspense>,
  },

  // ── Public — sign-in for the owner and staff; not linked from the shop ──
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
          // Donut margins now live on the Recipe costing sheet.
          { path: "/profit-margins", element: <Navigate to="/recipes" replace /> },
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
