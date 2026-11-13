import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search, Star } from "lucide-react";
import { useCategories, useProducts, useUpdateProduct } from "@/hooks/useProducts";
import { useListingPageRecovery } from "@/hooks/useListingPageRecovery";
import type { Category, Product, ProductPayload } from "@/types/product.types";
import DonutArt from "@/components/DonutArt";
import Pagination from "@/components/Pagination";
import Switch from "@/components/ui/Switch";
import { flavorOf, flavorTint } from "@/lib/flavor";
import { formatPeso } from "@/pages/dashboard/report-format";
import { MENU_AVAILABILITY, MENU_VIEWS, groupByCategory, useMenuCounts, type MenuView } from "./products/menu";
import "./products/products.css";

const PAGE_SIZE = 20;

/** The update endpoint replaces the whole record, so a quick toggle resends every field. */
function availabilityPayload(product: Product): ProductPayload {
  return {
    name: product.name,
    description: product.description,
    price: Number(product.price),
    category_id: product.category.id,
    is_available: !product.is_available,
    is_featured: product.is_featured,
    image: null,
  };
}

function MenuLine({ product }: { product: Product }) {
  const updateProduct = useUpdateProduct(product.id);
  const flavor = flavorOf(product.name, product.category?.name);

  return (
    <li className="menu-line" data-resting={!product.is_available || undefined}>
      <span className="menu-line-art" style={{ background: flavorTint(flavor) }} aria-hidden="true">
        {product.image_url ? <img src={product.image_url} alt="" loading="lazy" /> : <DonutArt flavor={flavor} size={44} />}
      </span>
      <Link to={`/products/${product.id}/edit`} className="menu-line-main">
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
      </Link>
      <span className="menu-line-switch">
        <Switch
          checked={product.is_available}
          onChange={() => updateProduct.mutate(availabilityPayload(product))}
          disabled={updateProduct.isPending}
        >
          <span className="menu-line-switch-label">In the shop</span>
          <span className="sr-only">: {product.name}</span>
        </Switch>
      </span>
    </li>
  );
}

function MenuSkeleton() {
  return (
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
  );
}

export default function ProductsPage() {
  const navigate = useNavigate();
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

  const products: Product[] = data?.data.results ?? [];
  const totalPages = Math.ceil((data?.data.count ?? 0) / PAGE_SIZE);
  const groups = groupByCategory(products, categories);

  const changeFilter = (apply: () => void) => {
    apply();
    setPage(1);
  };

  const lede = !counts
    ? " "
    : counts.all === 0
      ? "Nothing on the menu yet."
      : `${counts.menu} on the menu today${counts.resting ? `, ${counts.resting} resting` : ""}.`;

  return (
    <div className="donuts">
      <header className="page-head">
        <div>
          <h1 className="type-page">Donut collection</h1>
          <p className="page-lede">{lede}</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => navigate("/products/new")}>
          <Plus size={20} aria-hidden="true" />
          Add a donut
        </button>
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
            onChange={event => changeFilter(() => setSearch(event.target.value))}
            placeholder="Search the collection"
          />
        </label>
      </div>

      {isLoading && (
        <>
          <MenuSkeleton />
          <span className="sr-only" role="status">Loading the collection</span>
        </>
      )}

      {isError && (
        <div className="menu-card menu-empty" role="alert">
          <h2 className="type-heading">Couldn't load the collection</h2>
          <p>Check the internet connection, then try again.</p>
          <button type="button" className="btn-primary" onClick={() => void refetch()}>Try again</button>
        </div>
      )}

      {!isLoading && !isError && products.length === 0 && (
        <div className="menu-card menu-empty">
          <DonutArt flavor="strawberry" size={88} />
          {search ? (
            <>
              <h2 className="type-heading">No donuts match “{search}”</h2>
              <p>Check the spelling, or search for a flavour instead.</p>
              <button type="button" className="btn-secondary" onClick={() => changeFilter(() => setSearch(""))}>
                Clear search
              </button>
            </>
          ) : view === "resting" ? (
            <>
              <h2 className="type-heading">Nothing is resting</h2>
              <p>Every donut in the collection is in the shop right now.</p>
            </>
          ) : (
            <>
              <h2 className="type-heading">{view === "menu" ? "Nothing on the menu" : "Your collection is empty"}</h2>
              <p>Add a donut and switch it on to put it in the shop.</p>
              <button type="button" className="btn-primary" onClick={() => navigate("/products/new")}>
                <Plus size={20} aria-hidden="true" />
                Add a donut
              </button>
            </>
          )}
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
                  <MenuLine key={product.id} product={product} />
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
