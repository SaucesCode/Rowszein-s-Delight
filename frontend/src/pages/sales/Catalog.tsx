import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import DonutArt from "@/components/DonutArt";
import { flavorOf, flavorTint } from "@/lib/flavor";
import { formatPeso } from "@/pages/dashboard/report-format";
import type { Product } from "@/types/product.types";

interface CatalogProps {
  products: Product[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onAdd: (product: Product) => void;
  quantityOf: (productId: number) => number;
  /** Owners can switch donuts on, so the empty state links to the collection. */
  canManageMenu: boolean;
}

/** Tap-to-add grid of everything in the shop, filterable by category and name. */
export default function Catalog({ products, loading, error, onRetry, onAdd, quantityOf, canManageMenu }: CatalogProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const product of products) seen.set(String(product.category.id), product.category.name);
    return [...seen.entries()];
  }, [products]);

  const visible = products.filter(
    product =>
      (category === "all" || String(product.category.id) === category) &&
      product.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <section className="catalog" aria-label="Donuts to add">
      <div className="catalog-filters">
        <label className="search-field">
          <span className="sr-only">Find a donut</span>
          <Search size={18} aria-hidden="true" />
          <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a donut" />
        </label>
        {categories.length > 1 && (
          <div className="chip-row" role="group" aria-label="Category">
            <button type="button" className="chip" aria-pressed={category === "all"} onClick={() => setCategory("all")}>
              All
            </button>
            {categories.map(([id, name]) => (
              <button key={id} type="button" className="chip" aria-pressed={category === id} onClick={() => setCategory(id)}>
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="catalog-scroll">
        {loading && (
          <div className="catalog-grid" aria-hidden="true">
            {Array.from({ length: 8 }, (_, index) => (
              <span key={index} className="catalog-tile skeleton" />
            ))}
          </div>
        )}

        {error && (
          <div className="catalog-message" role="alert">
            <p>Couldn't load the donuts. Check the connection, then try again.</p>
            <button type="button" className="btn-primary" onClick={onRetry}>Try again</button>
          </div>
        )}

        {!loading && !error && products.length === 0 && (
          <div className="catalog-message">
            {canManageMenu ? (
              <>
                <p>No donuts are in the shop right now. Switch some on in the Donut collection first.</p>
                <Link to="/products" className="btn-secondary">Open the Donut collection</Link>
              </>
            ) : (
              <p>No donuts are in the shop right now. Ask the owner to put some on the menu.</p>
            )}
          </div>
        )}

        {!loading && !error && products.length > 0 && visible.length === 0 && (
          <div className="catalog-message">
            <p>No donut called “{search}”.</p>
            <button type="button" className="btn-secondary" onClick={() => setSearch("")}>Clear search</button>
          </div>
        )}

        {visible.length > 0 && (
          <ul className="catalog-grid">
            {visible.map(product => {
              const flavor = flavorOf(product.name, product.category?.name);
              const inOrder = quantityOf(product.id);
              return (
                <li key={product.id}>
                  <button type="button" className="catalog-tile" onClick={() => onAdd(product)}>
                    <span className="catalog-art" style={{ background: flavorTint(flavor) }} aria-hidden="true">
                      {product.image_url ? <img src={product.image_url} alt="" loading="lazy" /> : <DonutArt flavor={flavor} size={64} />}
                    </span>
                    <span className="catalog-name">{product.name}</span>
                    {product.partner && <span className="catalog-by">by {product.partner.name}</span>}
                    <span className="catalog-price num">{formatPeso(Number(product.price))}</span>
                    {inOrder > 0 && (
                      <span key={inOrder} className="catalog-badge num">
                        {inOrder}
                        <span className="sr-only"> in this order</span>
                      </span>
                    )}
                    <span className="sr-only">, add one</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
