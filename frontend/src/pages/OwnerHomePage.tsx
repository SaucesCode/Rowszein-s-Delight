import { useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { useMe, useLogout } from "@/hooks/useAuth";
import { useProducts, useCategories } from "@/hooks/useProducts";
import { useLowStockIngredients } from "@/hooks/useIngredients";
import { useSales, useSalesSummary } from "@/hooks/useSales";
import { useExpenses } from "@/hooks/useExpenses";
import { useDashboard } from "@/hooks/useDashboard";
import { useRecipes } from "@/hooks/useRecipes";
import { getDateRange, manilaDate } from "@/lib/dateRanges";
import { formatPeso } from "@/pages/dashboard/report-format";
import { can } from "@/lib/permissions";
import type { Sale } from "@/types/sale.types";
import type { Expense } from "@/types/expense.types";
import type { Category } from "@/types/product.types";
import {
  BrandDonutIcon,
  DonutProductIcon,
  IngredientCanisterIcon,
  SalesReceiptIcon,
  ExpensesLedgerIcon,
  RecipeBookIcon,
  StorefrontIcon,
  PlusIcon,
  AlertTriangleIcon,
  ArrowRightIcon,
  ExternalLinkIcon,
  ClockIcon,
} from "./owner-home/OwnerHomeIcons";
import "./owner-home/owner-home.css";

export default function OwnerHomePage({ standalone = false }: { standalone?: boolean }) {
  const { data: user } = useMe();
  const logout = useLogout();

  // Set document title
  useEffect(() => {
    document.title = "Owner Control Hub | Rowszein’s Delight";
  }, []);

  // Manila Date & Greeting Calculations
  const now = useMemo(() => new Date(), []);
  const todayManila = useMemo(() => manilaDate(now), [now]);

  const greetingDateStr = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "Asia/Manila",
      }).format(now);
    } catch {
      return todayManila;
    }
  }, [now, todayManila]);

  const isOwner = can(user, "finance.read");

  // Date ranges
  const todayRange = useMemo(() => getDateRange("today", now), [now]);
  const weekRange = useMemo(() => getDateRange("this_week", now), [now]);

  // Authorized Query Hooks
  const productsQuery = useProducts(1);
  const categoriesQuery = useCategories();
  const lowStockQuery = useLowStockIngredients();
  const salesQuery = useSales(todayRange, true);
  const salesSummaryQuery = useSalesSummary(todayRange, isOwner);
  const expensesQuery = useExpenses(weekRange, true);
  const dashboardQuery = useDashboard(weekRange, isOwner);
  const recipesQuery = useRecipes(1);

  // Derived Business Metrics
  // 1. Products
  const productsCount = productsQuery.data?.data?.count ?? 0;
  const categoriesList = categoriesQuery.data?.data ?? [];

  // 2. Ingredients
  const lowStockList = lowStockQuery.data ?? [];
  const lowStockCount = lowStockList.length;

  // 3. Sales
  const salesCount = salesQuery.data?.data?.count ?? 0;
  const todayNetSales = useMemo(() => {
    if (salesSummaryQuery.data?.totals?.net_sales !== undefined) {
      return Number(salesSummaryQuery.data.totals.net_sales);
    }
    const results: Sale[] = salesQuery.data?.data?.results ?? [];
    return results.reduce((sum: number, s: Sale) => sum + Number(s.total_amount), 0);
  }, [salesSummaryQuery.data, salesQuery.data]);

  // 4. Expenses
  const expensesCount = expensesQuery.data?.data?.count ?? 0;
  const weekTotalExpenses = useMemo(() => {
    if (dashboardQuery.data?.totals?.total_expenses !== undefined) {
      return Number(dashboardQuery.data.totals.total_expenses);
    }
    const results: Expense[] = expensesQuery.data?.data?.results ?? [];
    return results.reduce((sum: number, e: Expense) => sum + Number(e.amount), 0);
  }, [dashboardQuery.data, expensesQuery.data]);

  // 5. Recipes
  const recipesCount = recipesQuery.data?.data?.count ?? 0;

  // Initials for avatar
  const username = user?.username ?? "";
  const initials = username
    .split(/[\s_.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "RO";

  return (
    <div className="owner-home-root">
      {/* ─────────────────────────────────────────────────────────
           TOP HORIZONTAL BRANDING HEADER
           No permanent sidebar on owner home
           ───────────────────────────────────────────────────────── */}
      {standalone && (
        <header className="oh-header">
        <Link to="/home" className="oh-brand-group" aria-label="Rowszein's Delight Control Hub Home">
          <div className="oh-brand-insignia">
            <BrandDonutIcon />
          </div>
          <div className="oh-brand-titles">
            <span className="oh-brand-name">Rowszein's Delight</span>
            <span className="oh-brand-tagline">Bakery Management</span>
          </div>
        </Link>

        <div className="oh-greeting-pill" aria-label="Current Owner Session">
          <span className="oh-greeting-dot" aria-hidden="true"></span>
          <span>Good morning, {user?.username ?? "Rose"} &bull; {greetingDateStr}</span>
        </div>

        <div className="oh-header-actions">
          {isOwner && (
            <Link to="/analytics" className="oh-btn-subtle-link" aria-label="Open detailed financial analytics dashboard">
              <span>Analytics</span>
              <ExternalLinkIcon width={12} height={12} aria-hidden="true" />
            </Link>
          )}

          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="oh-btn-subtle-link"
            aria-label="Visit customer storefront (opens in new tab)"
          >
            <span>Visit Shop</span>
            <ExternalLinkIcon width={12} height={12} aria-hidden="true" />
          </a>

          <div className="oh-owner-profile" aria-label={`Signed in as ${user?.username ?? "Owner"}`}>
            <div className="oh-owner-avatar" aria-hidden="true">
              {initials}
            </div>
            <span className="oh-owner-name">{user?.username ?? "Owner"}</span>
          </div>

          <button
            type="button"
            className="oh-btn-logout"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            aria-label="Logout of bakery management session"
          >
            {logout.isPending ? "Logging out…" : "Logout"}
          </button>
        </div>
      </header>
      )}

      {/* ─────────────────────────────────────────────────────────
           MAIN STAGE: THE SIX-CARD BAKERY CONTROL HUB
           ───────────────────────────────────────────────────────── */}
      <main className="oh-main" id="main-content">
        {/* Intro / Title Row */}
        <div className="oh-intro-row">
          <div>
            <h1 className="oh-title">Your Bakery Control Hub</h1>
            <p className="oh-subtitle">Live overview of your daily donut production, inventory, and revenue.</p>
          </div>
          <div className="oh-meta-badge" aria-label="Current Timezone: Asia Manila">
            <ClockIcon width={13} height={13} style={{ color: "var(--oh-rose-primary)" }} aria-hidden="true" />
            <span>Asia/Manila &bull; {todayManila}</span>
          </div>
        </div>

        {/* Prioritized Quick Action Strip */}
        <div className="oh-quick-action-strip" role="toolbar" aria-label="Quick Bakery Actions">
          <Link to="/sales/new" className="oh-action-btn-primary" aria-label="Record a customer sale">
            <PlusIcon width={14} height={14} aria-hidden="true" />
            <span>Record Sale</span>
          </Link>

          {can(user, "catalog.manage") && (
            <Link to="/products/new" className="oh-action-btn-secondary" aria-label="Add new donut product to menu">
              <PlusIcon width={14} height={14} style={{ color: "var(--oh-rose-primary)" }} aria-hidden="true" />
              <span>Add Donut</span>
            </Link>
          )}

          <Link
            to="/ingredients"
            className={`oh-action-btn-secondary${lowStockCount > 0 ? " alert" : ""}`}
            aria-label={`View ${lowStockCount} ingredients requiring restock`}
          >
            <AlertTriangleIcon width={14} height={14} aria-hidden="true" />
            <span>Restock Alert ({lowStockCount})</span>
          </Link>

          {can(user, "expenses.manage") && (
            <Link to="/expenses/new" className="oh-action-btn-secondary" aria-label="Log a bakery operating expense">
              <PlusIcon width={14} height={14} style={{ color: "#6C40C7" }} aria-hidden="true" />
              <span>Log Expense</span>
            </Link>
          )}
        </div>

        {/* ─────────────────────────────────────────────────────────
             THE SIX MANAGEMENT CARDS (3 Columns × 2 Rows on Desktop)
             Connected directly to authorized API data
             ───────────────────────────────────────────────────────── */}
        <div className="oh-hub-grid">
          {/* Card 1: Products */}
          <Link to="/products" className="oh-hub-card" aria-label={`Products: ${productsCount} active donut varieties. Manage menu`}>
            <div className="oh-card-top">
              <div className="oh-card-header-left">
                <div className="oh-card-icon-frame oh-icon-products">
                  <DonutProductIcon />
                </div>
                <div className="oh-card-title-group">
                  <span className="oh-card-module-name">Products</span>
                  <span className="oh-card-scope-label">Catalog Overview</span>
                </div>
              </div>
            </div>

            <div className="oh-card-metric-block">
              {productsQuery.isLoading ? (
                <div className="oh-skeleton-shimmer" style={{ width: 120, height: 36, marginBottom: 8 }} />
              ) : (
                <div className="oh-card-stat-value">{productsCount} Active</div>
              )}
              <div className="oh-card-stat-meta">Donut varieties ready on menu</div>
            </div>

            <div className="oh-card-footer">
              <div className="oh-card-detail-pill-group">
                {categoriesList.length > 0 ? (
                  categoriesList.slice(0, 2).map((cat: Category) => (
                    <span key={cat.id} className="oh-detail-sub-chip">
                      {cat.name}
                    </span>
                  ))
                ) : (
                  <span className="oh-detail-sub-chip">Active catalog</span>
                )}
              </div>
              <span className="oh-card-link-affordance">
                <span>Manage Menu</span>
                <ArrowRightIcon />
              </span>
            </div>
          </Link>

          {/* Card 2: Ingredients (Alert State) */}
          <Link
            to="/ingredients"
            className="oh-hub-card"
            aria-label={`Ingredients: ${lowStockCount} need restock. Review pantry inventory`}
          >
            <div className="oh-card-top">
              <div className="oh-card-header-left">
                <div className="oh-card-icon-frame oh-icon-ingredients">
                  <IngredientCanisterIcon />
                </div>
                <div className="oh-card-title-group">
                  <span className="oh-card-module-name">Ingredients</span>
                  <span className="oh-card-scope-label">Pantry Inventory</span>
                </div>
              </div>
              {lowStockCount > 0 && (
                <span className="oh-card-status-chip warning">
                  <AlertTriangleIcon width={12} height={12} aria-hidden="true" />
                  <span>{lowStockCount} Low Stock</span>
                </span>
              )}
            </div>

            <div className="oh-card-metric-block">
              {lowStockQuery.isLoading ? (
                <div className="oh-skeleton-shimmer" style={{ width: 160, height: 36, marginBottom: 8 }} />
              ) : lowStockCount > 0 ? (
                <div className="oh-card-stat-value alert">{lowStockCount} Need Restock</div>
              ) : (
                <div className="oh-card-stat-value" style={{ color: "var(--oh-emerald-ink)" }}>Stock Healthy</div>
              )}
              <div className="oh-card-stat-meta">
                {lowStockCount > 0
                  ? lowStockList.slice(0, 2).map((i) => i.name).join(", ")
                  : "All pantry ingredients at safe levels"}
              </div>
            </div>

            <div className="oh-card-footer">
              <span
                className="oh-detail-sub-chip"
                style={{ color: lowStockCount > 0 ? "var(--oh-amber-ink)" : "var(--oh-emerald-ink)" }}
              >
                {lowStockCount > 0 ? "Minimum threshold reached" : "Inventory optimal"}
              </span>
              <span
                className="oh-card-link-affordance"
                style={{ color: lowStockCount > 0 ? "var(--oh-amber-ink)" : "var(--oh-rose-primary)" }}
              >
                <span>Review Stock</span>
                <ArrowRightIcon />
              </span>
            </div>
          </Link>

          {/* Card 3: Sales Today */}
          <Link
            to="/sales"
            className="oh-hub-card"
            aria-label={`Sales Today: ${formatPeso(todayNetSales)}. ${salesCount} customer orders recorded`}
          >
            <div className="oh-card-top">
              <div className="oh-card-header-left">
                <div className="oh-card-icon-frame oh-icon-sales">
                  <SalesReceiptIcon />
                </div>
                <div className="oh-card-title-group">
                  <span className="oh-card-module-name">Sales Today</span>
                  <span className="oh-card-scope-label">Recorded today ({todayManila})</span>
                </div>
              </div>
            </div>

            <div className="oh-card-metric-block">
              {salesQuery.isLoading ? (
                <div className="oh-skeleton-shimmer" style={{ width: 150, height: 36, marginBottom: 8 }} />
              ) : (
                <div className="oh-card-stat-value revenue">{formatPeso(todayNetSales)}</div>
              )}
              <div className="oh-card-stat-meta">{salesCount} customer orders recorded</div>
            </div>

            <div className="oh-card-footer">
              <span className="oh-detail-sub-chip" style={{ color: "var(--oh-emerald-ink)" }}>
                Gross revenue today
              </span>
              <span className="oh-card-link-affordance" style={{ color: "var(--oh-emerald-ink)" }}>
                <span>View Register</span>
                <ArrowRightIcon />
              </span>
            </div>
          </Link>

          {/* Card 4: Expenses */}
          <Link
            to="/expenses"
            className="oh-hub-card"
            aria-label={`Expenses: ${formatPeso(weekTotalExpenses)} this week. ${expensesCount} entries logged`}
          >
            <div className="oh-card-top">
              <div className="oh-card-header-left">
                <div className="oh-card-icon-frame oh-icon-expenses">
                  <ExpensesLedgerIcon />
                </div>
                <div className="oh-card-title-group">
                  <span className="oh-card-module-name">Expenses</span>
                  <span className="oh-card-scope-label">This Week ({weekRange.date_from} &ndash; {weekRange.date_to})</span>
                </div>
              </div>
            </div>

            <div className="oh-card-metric-block">
              {expensesQuery.isLoading ? (
                <div className="oh-skeleton-shimmer" style={{ width: 130, height: 36, marginBottom: 8 }} />
              ) : (
                <div className="oh-card-stat-value">{formatPeso(weekTotalExpenses)}</div>
              )}
              <div className="oh-card-stat-meta">{expensesCount} expense entries logged this week</div>
            </div>

            <div className="oh-card-footer">
              <span className="oh-detail-sub-chip">Operating expenses</span>
              <span className="oh-card-link-affordance" style={{ color: "#6C40C7" }}>
                <span>View Ledger</span>
                <ArrowRightIcon />
              </span>
            </div>
          </Link>

          {/* Card 5: Recipes & Costing */}
          <Link
            to="/recipes"
            className="oh-hub-card"
            aria-label={`Recipes: ${recipesCount} standard formulations configured`}
          >
            <div className="oh-card-top">
              <div className="oh-card-header-left">
                <div className="oh-card-icon-frame oh-icon-recipes">
                  <RecipeBookIcon />
                </div>
                <div className="oh-card-title-group">
                  <span className="oh-card-module-name">Recipes &amp; Costing</span>
                  <span className="oh-card-scope-label">Baking Formulations</span>
                </div>
              </div>
            </div>

            <div className="oh-card-metric-block">
              {recipesQuery.isLoading ? (
                <div className="oh-skeleton-shimmer" style={{ width: 110, height: 36, marginBottom: 8 }} />
              ) : (
                <div className="oh-card-stat-value">{recipesCount} Formulas</div>
              )}
              <div className="oh-card-stat-meta">Standard batch yields &amp; ingredient ratios</div>
            </div>

            <div className="oh-card-footer">
              <span className="oh-detail-sub-chip">Glazes, Doughs, Batches</span>
              <span className="oh-card-link-affordance">
                <span>View Formulas</span>
                <ArrowRightIcon />
              </span>
            </div>
          </Link>

          {/* Card 6: Customer Storefront */}
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="oh-hub-card"
            aria-label="Customer Storefront: Opens your public online donut catalog in a new tab"
          >
            <div className="oh-card-top">
              <div className="oh-card-header-left">
                <div className="oh-card-icon-frame oh-icon-storefront">
                  <StorefrontIcon />
                </div>
                <div className="oh-card-title-group">
                  <span className="oh-card-module-name">Customer Storefront</span>
                  <span className="oh-card-scope-label">Public Website Portal</span>
                </div>
              </div>
              <span className="oh-card-status-chip external">
                <span>Open Store</span>
                <ExternalLinkIcon width={11} height={11} aria-hidden="true" />
              </span>
            </div>

            <div className="oh-card-metric-block">
              <div className="oh-card-stat-value">Visit Shop ↗</div>
              <div className="oh-card-stat-meta">Opens your online donut catalog &amp; cart</div>
            </div>

            <div className="oh-card-footer">
              <span className="oh-detail-sub-chip">Customer-facing website</span>
              <span className="oh-card-link-affordance" style={{ color: "#C2410C" }}>
                <span>Launch Website</span>
                <ExternalLinkIcon width={14} height={14} aria-hidden="true" />
              </span>
            </div>
          </a>
        </div>
      </main>
    </div>
  );
}
