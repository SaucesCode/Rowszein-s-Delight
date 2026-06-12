import { createBrowserRouter, RouterProvider } from "react-router-dom";
import AuthLayout from "@/layouts/AuthLayout";
import MainLayout from "@/layouts/MainLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import IngredientsPage from "@/pages/IngredientsPage";
import IngredientFormPage from "@/pages/IngredientFormPage";
import ProductsPage from "@/pages/ProductsPage";
import ProductFormPage from "@/pages/ProductFormPage";

const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [{ path: "/login", element: <LoginPage /> }],
  },
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
        ],
      },
    ],
  },
  {
    path: "*",
    element: <LoginPage />,
  },
]);

export default function Router() {
  return <RouterProvider router={router} />;
}
