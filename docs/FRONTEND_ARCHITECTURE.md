# FRONTEND ARCHITECTURE

---

## 🧱 Architecture Philosophy

The frontend must follow a **feature-based architecture**, not a flat folder structure.

Each module (ingredients, products, sales, etc.) should be self-contained when possible.

Rules:
- UI is separate from business logic
- API logic is never inside components
- Pages only compose components
- Features scale independently

---

## 📁 Layouts

### AuthLayout

Used for:
- Login

Purpose:
- Minimal layout
- No sidebar/navbar

---

### MainLayout

Used for:
- Dashboard
- Ingredients
- Products
- Recipes
- Expenses
- Sales

Contains:
- Sidebar
- Navbar
- Main content area

Rules:
- Layout contains NO business logic
- Only navigation + structure

---

## 📄 Pages (Route-Level Only)

### Authentication
- LoginPage

---

### Dashboard
- DashboardPage

---

### Ingredients
- IngredientsPage
- IngredientFormPage

---

### Products
- ProductsPage
- ProductFormPage

---

### Recipes
- RecipesPage
- RecipeFormPage

---

### Expenses
- ExpensesPage
- ExpenseFormPage

---

### Sales
- SalesPage
- SaleFormPage

---

## 🧩 Component Structure (UPDATED RULE)

### Shared UI Components

- DataTable
- FormModal
- ConfirmDialog
- EmptyState
- LoadingSpinner
- PageHeader

Rules:
- Must be reusable
- Must NOT contain API calls
- Must NOT contain business logic

---

### Layout Components

- Sidebar
- Navbar

Rules:
- Only navigation + UI logic
- No API calls

---

### Dashboard Components

- StatCard
- SalesChart
- ExpenseChart
- ProfitChart

Rules:
- Must accept data via props only
- No internal API fetching

---

## 🔌 Feature-Based Structure (NEW — IMPORTANT)

Instead of grouping only by type, features must be grouped like this:

```text
src/features/
  ingredients/
    components/
    pages/
    services/
    hooks/

  products/
  sales/
  expenses/
  recipes/
  dashboard/