import { useEffect, useId, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Download, Plus, Search, X } from "lucide-react";
import { useIngredient, useIngredients } from "@/hooks/useIngredients";
import { useListingPageRecovery } from "@/hooks/useListingPageRecovery";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { exportIngredientsCSV } from "@/lib/exportIngredientsCSV";
import { formatAmount, stockStatus, type StockStatus } from "@/lib/stockStatus";
import { INGREDIENT_CATEGORIES, type Ingredient } from "@/types/ingredient.types";
import Pagination from "@/components/Pagination";
import LevelBar from "@/components/LevelBar";
import IngredientDetail from "./pantry/IngredientDetail";
import JarGauge from "./pantry/JarGauge";
import { usePantryCounts } from "./pantry/usePantryCounts";
import "./pantry/pantry.css";

type Tab = "all" | "low_stock" | "out_of_stock" | "healthy";
const PAGE_SIZE = 20;
const WIDE = "(min-width: 1280px)";

const TABS: { value: Tab; label: string; tone: StockStatus | "all" }[] = [
  { value: "all", label: "All", tone: "all" },
  { value: "low_stock", label: "Running low", tone: "low" },
  { value: "out_of_stock", label: "Out of stock", tone: "out" },
  { value: "healthy", label: "Stocked", tone: "stocked" },
];

function rowSummary(ingredient: Ingredient): string {
  const status = stockStatus(ingredient);
  if (status === "out") return "None left";
  const amount = formatAmount(ingredient.quantity, ingredient.unit);
  if (status === "low") return `${amount} left, restock at ${formatAmount(ingredient.minimum_stock, ingredient.unit)}`;
  return amount;
}

function ListSkeleton() {
  return (
    <ul className="pantry-list" aria-hidden="true">
      {Array.from({ length: 7 }, (_, index) => (
        <li key={index} className="pantry-row">
          <span className="grid flex-1 gap-2">
            <span className="skeleton block h-4 w-2/5" />
            <span className="skeleton block h-3 w-1/3" />
          </span>
          <span className="skeleton block h-1.5 w-16" />
        </li>
      ))}
    </ul>
  );
}

export default function IngredientsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const isWide = useMediaQuery(WIDE);
  const headingId = useId();
  const sheetRef = useRef<HTMLDialogElement>(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [tab, setTab] = useState<Tab>("all");

  const counts = usePantryCounts();
  const { data, isLoading, isError, error, refetch } = useIngredients(page, {
    search,
    category,
    status: tab,
    ordering: "name",
  });
  useListingPageRecovery(page, error, setPage);

  const items: Ingredient[] = data?.data?.results ?? [];
  const totalPages = Math.ceil((data?.data?.count ?? 0) / PAGE_SIZE);
  const filtered = !!search || category !== "all" || tab !== "all";

  const selectedId = Number(params.get("item")) || 0;
  const listed = items.find(item => item.id === selectedId);
  const detailQuery = useIngredient(listed ? 0 : selectedId);
  const selected = listed ?? detailQuery.data;

  const select = (id: number) => {
    const next = new URLSearchParams(params);
    next.set("item", String(id));
    setParams(next, { replace: isWide, state: isWide ? undefined : { sheet: true } });
  };

  const closeSheet = () => {
    if (!params.get("item")) return;
    if ((location.state as { sheet?: boolean } | null)?.sheet) {
      navigate(-1);
      return;
    }
    const next = new URLSearchParams(params);
    next.delete("item");
    setParams(next, { replace: true });
  };

  const firstId = items[0]?.id;
  useEffect(() => {
    if (!isWide || selectedId || !firstId) return;
    const next = new URLSearchParams(params);
    next.set("item", String(firstId));
    setParams(next, { replace: true });
  }, [isWide, selectedId, firstId, params, setParams]);

  const sheetOpen = !isWide && !!selected;
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    if (sheetOpen && !sheet.open) sheet.showModal();
    if (!sheetOpen && sheet.open) sheet.close();
  }, [sheetOpen]);

  const changeFilter = (apply: () => void) => {
    apply();
    setPage(1);
  };

  const needs = counts ? counts.low_stock + counts.out_of_stock : 0;
  const sentence = !counts
    ? " "
    : counts.all === 0
      ? "Nothing in the pantry yet."
      : needs > 0
        ? `${needs} of ${counts.all} ingredients ${needs === 1 ? "needs" : "need"} restocking.`
        : `All ${counts.all} ingredients are stocked.`;

  const edit = (id: number) => navigate(`/ingredients/${id}/edit`);
  const detail = selected && <IngredientDetail ingredient={selected} headingId={headingId} onEdit={() => edit(selected.id)} />;

  return (
    <div className="pantry">
      <header className="page-head">
        <div>
          <h1 className="type-page">Pantry</h1>
          <p className="page-lede">{sentence}</p>
        </div>
        <div className="pantry-head-actions">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => exportIngredientsCSV(items)}
            disabled={items.length === 0}
          >
            <Download size={18} aria-hidden="true" />
            Download this list
          </button>
          <button type="button" className="btn-primary" onClick={() => navigate("/ingredients/new")}>
            <Plus size={20} aria-hidden="true" />
            New ingredient
          </button>
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
            {TABS.map(option => (
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

      <div className="pantry-layout">
        <section className="pantry-browse" aria-label="Ingredients">
          <div className="pantry-filters">
            <label className="search-field">
              <span className="sr-only">Search ingredients</span>
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                value={search}
                placeholder="Search by name or supplier"
                onChange={event => changeFilter(() => setSearch(event.target.value))}
              />
            </label>
            <label className="pantry-category">
              <span className="sr-only">Category</span>
              <select
                className="field-input"
                value={category}
                onChange={event => changeFilter(() => setCategory(event.target.value))}
              >
                <option value="all">All categories</option>
                {INGREDIENT_CATEGORIES.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          {isLoading && (
            <>
              <ListSkeleton />
              <span className="sr-only" role="status">Loading the pantry</span>
            </>
          )}

          {isError && (
            <div className="pantry-empty" role="alert">
              <h2 className="type-heading">Couldn't load the pantry</h2>
              <p>Check the internet connection, then try again.</p>
              <button type="button" className="btn-primary" onClick={() => void refetch()}>Try again</button>
            </div>
          )}

          {!isLoading && !isError && items.length === 0 && (
            <div className="pantry-empty">
              <JarGauge fill={0} mark={null} status="stocked" size={88} />
              {filtered ? (
                <>
                  <h2 className="type-heading">
                    {tab === "low_stock" || tab === "out_of_stock" ? "Nothing here. Nice." : "No ingredients match"}
                  </h2>
                  <p>
                    {tab === "low_stock" || tab === "out_of_stock"
                      ? "Everything in this view is stocked above its restock level."
                      : "Try another word or category."}
                  </p>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() =>
                      changeFilter(() => {
                        setSearch("");
                        setCategory("all");
                        setTab("all");
                      })
                    }
                  >
                    Show everything
                  </button>
                </>
              ) : (
                <>
                  <h2 className="type-heading">Your pantry is empty</h2>
                  <p>Add the flour, sugar and fillings you bake with, and you'll see the moment each one runs low.</p>
                  <button type="button" className="btn-primary" onClick={() => navigate("/ingredients/new")}>
                    <Plus size={20} aria-hidden="true" />
                    New ingredient
                  </button>
                </>
              )}
            </div>
          )}

          {!isLoading && !isError && items.length > 0 && (
            <div className="pantry-scroll">
              <ul className="pantry-list">
                {items.map(item => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="pantry-row"
                      aria-current={item.id === selectedId ? "true" : undefined}
                      onClick={() => select(item.id)}
                    >
                      <span className={`dot is-${stockStatus(item)}`} aria-hidden="true" />
                      <span className="pantry-row-text">
                        <span className="pantry-row-name">{item.name}</span>
                        <span className="pantry-row-sub">{rowSummary(item)}</span>
                      </span>
                      <LevelBar ingredient={item} />
                    </button>
                  </li>
                ))}
              </ul>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </section>

        {isWide && items.length > 0 && (
          <aside className="pantry-pane">
            {detail ?? <span className="skeleton block h-64 w-full" aria-hidden="true" />}
          </aside>
        )}
      </div>

      {!isWide && (
        <dialog ref={sheetRef} className="pantry-sheet" aria-labelledby={headingId} onClose={closeSheet}>
          <button type="button" className="icon-button pantry-sheet-close" onClick={closeSheet}>
            <X size={22} aria-hidden="true" />
            <span className="sr-only">Close</span>
          </button>
          {sheetOpen && detail}
        </dialog>
      )}
    </div>
  );
}
