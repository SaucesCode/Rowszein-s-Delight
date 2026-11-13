import { useState } from "react";
import { Search, Star } from "lucide-react";
import { useIngredients } from "@/hooks/useIngredients";
import { useCategories, useProducts } from "@/hooks/useProducts";
import { useListingPageRecovery } from "@/hooks/useListingPageRecovery";
import Pagination from "@/components/Pagination";
import DonutArt from "@/components/DonutArt";
import { flavorOf, flavorTint } from "@/lib/flavor";
import { STOCK_STATUS_LABEL, formatAmount, stockStatus, type StockStatus } from "@/lib/stockStatus";
import { formatPeso } from "@/pages/dashboard/report-format";
import type { Ingredient } from "@/types/ingredient.types";
import type { Category, Product } from "@/types/product.types";
import { usePantryCounts } from "./pantry/usePantryCounts";
import { MENU_AVAILABILITY, MENU_VIEWS, groupByCategory, useMenuCounts, type MenuView } from "./products/menu";
import "./pantry/pantry.css";
import "./products/products.css";

const PAGE_SIZE = 20;

/** Staff see only these fields; restock levels and costs stay with the owner. */
type StockLine = Pick<Ingredient, "id" | "name" | "quantity" | "unit" | "is_low_stock">;
type StockTab = "all" | "low_stock" | "out_of_stock" | "healthy";

const STOCK_TABS: { value: StockTab; label: string; tone: StockStatus | "all" }[] = [
  { value: "all", label: "All", tone: "all" },
  { value: "low_stock", label: "Running low", tone: "low" },
  { value: "out_of_stock", label: "Out of stock", tone: "out" },
  { value: "healthy", label: "Stocked", tone: "stocked" },
];

function ListError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className="menu-card menu-empty" role="alert">
      <h2 className="type-heading">Couldn't load the {what}</h2>
      <p>Check the internet connection, then try again. If it keeps happening, sign out and back in.</p>
      <button type="button" className="btn-primary" onClick={onRetry}>Try again</button>
    </div>
  );
}

/** Read-only pantry for staff: what's on the shelf and what needs restocking. */
export function OperationalStockPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<StockTab>("all");
  const counts = usePantryCounts();
  const { data, isLoading, isError, error, refetch } = useIngredients(page, { search, status: tab, ordering: "name" });
  useListingPageRecovery(page, error, setPage);

  const rows: StockLine[] = data?.data?.results ?? [];
  const totalPages = Math.ceil((data?.data?.count ?? 0) / PAGE_SIZE);
  const needs = counts ? counts.low_stock + counts.out_of_stock : 0;
  const lede = !counts
    ? " "
    : counts.all === 0
      ? "No ingredients have been added yet."
      : needs > 0
        ? `${needs} of ${counts.all} ingredients ${needs === 1 ? "needs" : "need"} restocking. Let the owner know before the next bake.`
        : `All ${counts.all} ingredients are stocked.`;

  const changeFilter = (apply: () => void) => {
    apply();
    setPage(1);
  };

  return (
    <div className="stock-check">
      <header className="page-head">
        <div>
          <h1 className="type-page">Pantry</h1>
          <p className="page-lede">{lede}</p>
        </div>
      </header>

      {counts && counts.all > 0 && (
        <div className="pantry-toolbar">
          <div
            className="pantry-health-bar"
            role="img"
            aria-label={`${counts.healthy} stocked, ${counts.low_stock} running low, ${counts.out_of_stock} out of stock`}
          >
            {counts.healthy > 0 && <span className="is-stocked" style={{ flexGrow: counts.healthy }} />}
            {counts.low_stock > 0 && <span className="is-low" style={{ flexGrow: counts.low_stock }} />}
            {counts.out_of_stock > 0 && <span className="is-out" style={{ flexGrow: counts.out_of_stock }} />}
          </div>
          <div className="pantry-tabs" role="group" aria-label="Show">
            {STOCK_TABS.map(option => (
              <button
                key={option.value}
                type="button"
                aria-pressed={tab === option.value}
                onClick={() => changeFilter(() => setTab(option.value))}
              >
                {option.tone !== "all" && <span className={`dot is-${option.tone}`} aria-hidden="true" />}
                {option.label}{" "}
                <span className="num pantry-tab-count">{counts[option.value]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="search-field stock-check-search">
        <span className="sr-only">Search ingredients</span>
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={search}
          placeholder="Search by name"
          onChange={event => changeFilter(() => setSearch(event.target.value))}
        />
      </label>

      {isLoading && (
        <>
          <ul className="pantry-list" aria-hidden="true">
            {Array.from({ length: 7 }, (_, index) => (
              <li key={index} className="stock-check-row">
                <span className="skeleton block h-4 w-2/5" />
                <span className="skeleton block h-4 w-16" />
              </li>
            ))}
          </ul>
          <span className="sr-only" role="status">Loading stock</span>
        </>
      )}

      {isError && <ListError what="stock" onRetry={() => void refetch()} />}

      {!isLoading && !isError && rows.length === 0 && (
        <div className="menu-card menu-empty" role="status">
          <h2 className="type-heading">
            {search ? `Nothing matches “${search}”` : tab === "all" ? "No ingredients yet" : "Nothing here. Nice."}
          </h2>
          <p>
            {search
              ? "Check the spelling, or search for part of the name."
              : tab === "all"
                ? "The owner hasn't added any ingredients."
                : "No ingredient is in this group right now."}
          </p>
        </div>
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <>
          <ul className="pantry-list">
            {rows.map(row => {
              const status = stockStatus(row);
              return (
                <li key={row.id} className="stock-check-row">
                  <span className={`dot is-${status}`} aria-hidden="true" />
                  <span className="stock-check-name">{row.name}</span>
                  {status !== "stocked" && (
                    <span className={`pantry-status is-${status}`}>{STOCK_STATUS_LABEL[status]}</span>
                  )}
                  <span className="stock-check-amount num">
                    {status === "out" ? "None left" : formatAmount(row.quantity, row.unit)}
                  </span>
                </li>
              );
            })}
          </ul>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      <p className="stock-check-note">Only the owner can change stock counts.</p>
    </div>
  );
}

function MenuReadLine({ product }: { product: Product }) {
  const flavor = flavorOf(product.name, product.category?.name);
  return (
    <li className="menu-line" data-resting={!product.is_available || undefined}>
      <span className="menu-line-art" style={{ background: flavorTint(flavor) }} aria-hidden="true">
        {product.image_url ? <img src={product.image_url} alt="" loading="lazy" /> : <DonutArt flavor={flavor} size={44} />}
      </span>
      <span className="menu-line-main">
        <span className="menu-line-top">
          <span className="menu-line-name">
            {product.name}
            {product.is_featured && (
              <span className="menu-line-star" title="Best seller">
                <Star size={14} strokeWidth={2} aria-hidden="true" />
                <span className="sr-only">, best seller</span>
              </span>
            )}
          </span>
          <span className="menu-line-leader" aria-hidden="true" />
          <span className="menu-line-price num">{formatPeso(Number(product.price))}</span>
        </span>
        {product.description && <span className="menu-line-desc">{product.description}</span>}
      </span>
      <span className="menu-line-state">{product.is_available ? "" : "Resting"}</span>
    </li>
  );
}

/** Read-only menu for staff: prices and what's in the shop today. */
export function OperationalCatalogPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<MenuView>("menu");
  const counts = useMenuCounts();
  const { data: categoriesData } = useCategories();
  const categories: Category[] = categoriesData?.data ?? [];
  const { data, isLoading, isError, error, refetch } = useProducts(page, {
    search,
    ordering: "name",
    is_available: MENU_AVAILABILITY[view],
  });
  useListingPageRecovery(page, error, setPage);

  const products: Product[] = data?.data?.results ?? [];
  const totalPages = Math.ceil((data?.data?.count ?? 0) / PAGE_SIZE);
  const groups = groupByCategory(products, categories);
  const lede = !counts
    ? " "
    : counts.all === 0
      ? "Nothing on the menu yet."
      : `${counts.menu} on the menu today${counts.resting ? `, ${counts.resting} resting` : ""}. Prices are set by the owner.`;

  const changeFilter = (apply: () => void) => {
    apply();
    setPage(1);
  };

  return (
    <div className="donuts">
      <header className="page-head">
        <div>
          <h1 className="type-page">Donut collection</h1>
          <p className="page-lede">{lede}</p>
        </div>
      </header>

      <div className="menu-toolbar">
        <div className="segmented" role="group" aria-label="Show">
          {MENU_VIEWS.map(option => (
            <button
              key={option.value}
              type="button"
              aria-pressed={view === option.value}
              onClick={() => changeFilter(() => setView(option.value))}
            >
              {option.label}{" "}
              {counts && <span className="num menu-count">{counts[option.value]}</span>}
            </button>
          ))}
        </div>
        <label className="search-field">
          <span className="sr-only">Search donuts</span>
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={search}
            placeholder="Search donuts"
            onChange={event => changeFilter(() => setSearch(event.target.value))}
          />
        </label>
      </div>

      {isLoading && (
        <>
          <div className="menu-card" aria-hidden="true">
            <span className="skeleton block h-7 w-40" />
            <ul className="menu-lines">
              {Array.from({ length: 6 }, (_, index) => (
                <li key={index} className="menu-line">
                  <span className="menu-line-art skeleton" />
                  <span className="grid flex-1 gap-2">
                    <span className="skeleton block h-5 w-3/5" />
                    <span className="skeleton block h-3 w-2/5" />
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <span className="sr-only" role="status">Loading the menu</span>
        </>
      )}

      {isError && <ListError what="menu" onRetry={() => void refetch()} />}

      {!isLoading && !isError && products.length === 0 && (
        <div className="menu-card menu-empty" role="status">
          <h2 className="type-heading">
            {search ? `No donuts match “${search}”` : view === "resting" ? "Nothing is resting" : "Nothing on the menu"}
          </h2>
          <p>
            {search
              ? "Check the spelling, or search for part of the name."
              : view === "resting"
                ? "Every donut is in the shop today."
                : "The owner hasn't put any donuts on the menu yet."}
          </p>
        </div>
      )}

      {!isLoading && !isError && products.length > 0 && (
        <div className="menu-card">
          {groups.map(group => (
            <section key={group.category.id} className="menu-section" aria-labelledby={`menu-cat-${group.category.id}`}>
              <h2 id={`menu-cat-${group.category.id}`} className="menu-section-title">
                {group.category.name}
              </h2>
              <ul className="menu-lines">
                {group.items.map(product => (
                  <MenuReadLine key={product.id} product={product} />
                ))}
              </ul>
            </section>
          ))}
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
