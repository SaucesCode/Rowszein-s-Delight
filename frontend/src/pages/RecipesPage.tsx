import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { useProductMargins } from "@/hooks/useDashboard";
import { useAllRecipes } from "@/hooks/useRecipes";
import type { ProductMargin } from "@/services/dashboard.service";
import DonutArt from "@/components/DonutArt";
import { flavorOf, flavorTint } from "@/lib/flavor";
import { formatPeso } from "@/pages/dashboard/report-format";
import "./recipes/recipes.css";

type Sort = "least" | "most" | "name";

const SORTS: { value: Sort; label: string }[] = [
  { value: "least", label: "Keeps the least" },
  { value: "most", label: "Keeps the most" },
  { value: "name", label: "A to Z" },
];

/** Below this share of the price, a donut is flagged as earning little. */
const THIN_MARGIN = 30;

function sortMargins(rows: ProductMargin[], sort: Sort) {
  const copy = [...rows];
  if (sort === "name") return copy.sort((a, b) => a.product_name.localeCompare(b.product_name));
  return copy.sort((a, b) => (sort === "least" ? a.margin_percent - b.margin_percent : b.margin_percent - a.margin_percent));
}

function CostLine({ row, href }: { row: ProductMargin; href: string }) {
  const price = Number(row.selling_price);
  const cost = Number(row.production_cost);
  const keep = Number(row.profit_per_unit);
  const losing = keep < 0;
  const thin = !losing && row.margin_percent < THIN_MARGIN;
  const flavor = flavorOf(row.product_name);

  return (
    <li>
      <Link to={href} className="cost-line">
        <span className="cost-art" style={{ background: flavorTint(flavor) }} aria-hidden="true">
          <DonutArt flavor={flavor} size={40} />
        </span>
        <span className="cost-main">
          <span className="cost-top">
            <span className="cost-name">{row.product_name}</span>
            {!row.is_available && <span className="cost-tag">Resting</span>}
            <span className="cost-price num">Sells for {formatPeso(price)}</span>
          </span>
          <span className="cost-bar" aria-hidden="true">
            <span className="cost-bar-cost" style={{ flexGrow: losing ? 1 : cost }} />
            {!losing && <span className="cost-bar-keep" style={{ flexGrow: keep }} />}
          </span>
          <span className="cost-sentence">
            {losing
              ? `${formatPeso(cost)} in ingredients, so each one loses ${formatPeso(Math.abs(keep))}.`
              : `${formatPeso(cost)} in ingredients, you keep ${formatPeso(keep)}.`}
          </span>
        </span>
        <span className={`cost-margin ${losing || thin ? "is-warn" : "is-good"}`}>
          <strong className="num">{losing ? "Loss" : `${Math.round(row.margin_percent)}%`}</strong>
          <span>{losing ? "check the price" : thin ? "kept, thin" : "kept"}</span>
        </span>
      </Link>
    </li>
  );
}

function SheetSkeleton() {
  return (
    <ul className="cost-lines" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <li key={index} className="cost-line">
          <span className="cost-art skeleton" />
          <span className="cost-main">
            <span className="skeleton block h-5 w-1/2" />
            <span className="skeleton block h-3 w-full" />
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function RecipesPage() {
  const navigate = useNavigate();
  const [sort, setSort] = useState<Sort>("least");
  const margins = useProductMargins();
  const recipes = useAllRecipes();

  const recipeIdByProduct = useMemo(
    () => new Map((recipes.data ?? []).map(recipe => [recipe.product, recipe.id])),
    [recipes.data],
  );
  const rows = margins.data ?? [];
  const costed = sortMargins(rows.filter(row => row.has_recipe), sort);
  const missing = rows.filter(row => !row.has_recipe);
  const average = costed.length ? costed.reduce((sum, row) => sum + row.margin_percent, 0) / costed.length : 0;
  const loading = margins.isPending || recipes.isPending;
  const failed = margins.isError || recipes.isError;

  const hrefFor = (row: ProductMargin) => {
    const recipeId = recipeIdByProduct.get(row.product_id);
    return recipeId ? `/recipes/${recipeId}/edit` : `/recipes/new?product=${row.product_id}`;
  };

  const lede = loading || failed
    ? " "
    : rows.length === 0
      ? "Add donuts to the collection first, then give each one a recipe."
      : [
          costed.length ? `On average you keep ${Math.round(average)}% of each donut's price.` : "",
          missing.length ? `${missing.length} ${missing.length === 1 ? "donut still needs" : "donuts still need"} a recipe.` : "",
        ]
          .filter(Boolean)
          .join(" ");

  return (
    <div className="recipes">
      <header className="page-head">
        <div>
          <h1 className="type-page">Recipe costing</h1>
          <p className="page-lede">{lede}</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => navigate("/recipes/new")}>
          <Plus size={20} aria-hidden="true" />
          Add a recipe
        </button>
      </header>

      {failed && (
        <div className="recipes-panel recipes-message" role="alert">
          <h2 className="type-heading">Couldn't load the costs</h2>
          <p>Check the internet connection, then try again.</p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              void margins.refetch();
              void recipes.refetch();
            }}
          >
            Try again
          </button>
        </div>
      )}

      {!failed && missing.length > 0 && (
        <section className="recipes-missing" aria-labelledby="missing-title">
          <h2 id="missing-title" className="recipes-section-title">Still needs a recipe</h2>
          <p className="recipes-hint">Without one, you can't see what these donuts cost to make.</p>
          <ul>
            {missing.map(row => (
              <li key={row.product_id}>
                <span className="cost-art" style={{ background: flavorTint(flavorOf(row.product_name)) }} aria-hidden="true">
                  <DonutArt flavor={flavorOf(row.product_name)} size={32} />
                </span>
                <span className="recipes-missing-name">{row.product_name}</span>
                <Link to={hrefFor(row)} className="btn-secondary">
                  Add its recipe<span className="sr-only"> for {row.product_name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!failed && (
        <section className="recipes-panel" aria-labelledby="sheet-title">
          <div className="recipes-panel-head">
            <div>
              <h2 id="sheet-title" className="recipes-section-title">What each donut earns</h2>
              <p className="recipes-legend">
                <span className="legend-swatch is-cost" aria-hidden="true" /> Ingredients
                <span className="legend-swatch is-keep" aria-hidden="true" /> What you keep
              </p>
            </div>
            <div className="segmented" role="group" aria-label="Order">
              {SORTS.map(option => (
                <button key={option.value} type="button" aria-pressed={sort === option.value} onClick={() => setSort(option.value)}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <>
              <SheetSkeleton />
              <span className="sr-only" role="status">Loading the costs</span>
            </>
          ) : costed.length === 0 ? (
            <div className="recipes-message">
              <DonutArt flavor="classic" size={72} />
              <p>No recipes yet. Add one and you'll see, to the centavo, what each donut costs and what you keep.</p>
              <button type="button" className="btn-primary" onClick={() => navigate("/recipes/new")}>
                <Plus size={20} aria-hidden="true" />
                Add a recipe
              </button>
            </div>
          ) : (
            <ul className="cost-lines">
              {costed.map(row => (
                <CostLine key={row.product_id} row={row} href={hrefFor(row)} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
