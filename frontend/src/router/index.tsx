import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import AuthLayout from "@/layouts/AuthLayout";
import MainLayout from "@/layouts/MainLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
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

const router = createBrowserRouter([
  // ── Public — shop landing page, no auth required ──
  {
    path: "/",
    element: <LandingPage />,
  },

  // ── Public — owner login (reached via the hidden nav icon) ──
  {
    element: <AuthLayout />,
    children: [{ path: "/login", element: <LoginPage /> }],
  },

  // ── Protected — Owner Panel ──
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <MainLayout />,
        children: [
          { path: "/dashboard", element: <DashboardPage /> },
          { path: "/ingredients", element: <IngredientsPage /> },
          { path: "/ingredients/new", element: <IngredientFormPage /> },
          { path: "/ingredients/:id/edit", element: <IngredientFormPage /> },
          { path: "/products", element: <ProductsPage /> },
          { path: "/products/new", element: <ProductFormPage /> },
          { path: "/products/:id/edit", element: <ProductFormPage /> },
          { path: "/recipes", element: <RecipesPage /> },
          { path: "/recipes/new", element: <RecipeFormPage /> },
          { path: "/recipes/:id/edit", element: <RecipeFormPage /> },
          { path: "/expenses", element: <ExpensesPage /> },
          { path: "/expenses/new", element: <ExpenseFormPage /> },
          { path: "/expenses/:id/edit", element: <ExpenseFormPage /> },
          { path: "/sales", element: <SalesPage /> },
          { path: "/sales/new", element: <SaleFormPage /> },
          { path: "/sales/:id/edit", element: <SaleFormPage /> },
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
