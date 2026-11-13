import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useListingPages } from "@/hooks/useListingPages";
import { uniqueRecords } from "@/lib/listingParams";
import { BrandDonutIcon } from "@/pages/owner-home/OwnerHomeIcons";
import type { Category, Product } from "@/types/product.types";
import PastryCase, { PastryCaseSkeleton } from "./PastryCase";
import BoxDock from "./BoxDock";
import BoxSheet from "./BoxSheet";
import ContactSection from "./ContactSection";
import HowToOrder from "./HowToOrder";
import ShopHero from "./ShopHero";
import { BoxIcon } from "./ShopIcons";
import { SHOP_EMAIL, SHOP_MESSENGER } from "./order";
import { toShelves } from "./shelves";
import { useFlyToBox } from "./useFlyToBox";
import { useInView } from "./useInView";
import { useScrolledPast } from "./useScrolledPast";
import { useScrollReveal } from "./useScrollReveal";
import "./shop.css";

export default function ShopPage() {
  const cart = useCart();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [announcement, setAnnouncement] = useState("");
  const boxWindowRef = useRef<HTMLSpanElement>(null);
  const boxButtonRef = useRef<HTMLButtonElement>(null);
  const flyToBox = useFlyToBox(boxWindowRef);
  const [caseRef, caseLit] = useInView<HTMLDivElement>();
  const [awningRef, headerStuck] = useScrolledPast<HTMLDivElement>();
  const pageRef = useRef<HTMLDivElement>(null);
  useScrollReveal(pageRef);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const catalog = useListingPages<Product>(
    "products",
    { search, category, is_available: true, category_active: true },
    "storefront",
    true,
    true,
  );
  const categoryList = useListingPages<Category>("categories", { is_active: true }, "storefront-categories", true, true);
  const bestSellers = useListingPages<Product>(
    "products",
    { is_featured: true, is_available: true, category_active: true },
    "storefront-featured",
    true,
    true,
  );

  const products = uniqueRecords(catalog.data?.pages.map(page => page.data.results) ?? []);
  const categories = uniqueRecords(categoryList.data?.pages.map(page => page.data.results) ?? []);
  const shelves = toShelves(products, categories);
  const filtered = !!search || category !== "all";
  const featured = uniqueRecords(bestSellers.data?.pages.map(page => page.data.results) ?? []);
  const showcase = featured.length > 0 ? featured : filtered ? [] : products;

  const { addItem, items, totalItems } = cart;
  const quantityOf = useCallback(
    (productId: number) => items.find(item => item.product_id === productId)?.quantity ?? 0,
    [items],
  );

  const add = useCallback(
    (product: Product, art: HTMLElement) => {
      addItem(product);
      flyToBox(art);
      const count = totalItems + 1;
      setAnnouncement(`${product.name} added. ${count === 1 ? "1 donut" : `${count} donuts`} in your box.`);
    },
    [addItem, flyToBox, totalItems],
  );

  // The dock's button disappears if the box was emptied while open; keep focus somewhere sensible.
  const closeSheet = () => {
    setSheetOpen(false);
    requestAnimationFrame(() => {
      if (document.activeElement === document.body) boxButtonRef.current?.focus();
    });
  };

  const showEverything = () => {
    setQuery("");
    setSearch("");
    setCategory("all");
  };

  return (
    <div ref={pageRef} className={`shop${totalItems > 0 ? " has-box" : ""}`}>
      <a className="shop-skip" href="#case">Skip to the donuts</a>
      <div ref={awningRef} className="shop-awning" aria-hidden="true" />

      <header className={`shop-header${headerStuck ? " is-stuck" : ""}`}>
        <div className="shop-header-inner">
          <a className="shop-brand" href="#top">
            <BrandDonutIcon width={28} height={28} aria-hidden="true" />
            <span>Rowszein's Delight</span>
          </a>
          <nav className="shop-header-actions" aria-label="Shop">
            <a className="shop-header-link" href="#contact">Ask us</a>
            <button ref={boxButtonRef} type="button" className="shop-box-button" onClick={() => setSheetOpen(true)}>
              <BoxIcon />
              <span className="shop-box-label">Your box</span>
              <span className="shop-box-count num">
                {totalItems}
                <span className="sr-only">{totalItems === 1 ? " donut" : " donuts"}</span>
              </span>
            </button>
          </nav>
        </div>
      </header>

      <main id="top" className="shop-main">
        <ShopHero products={showcase} onAdd={add} />

        <div id="menu" className="shop-intro" data-reveal="">
          <h2 className="shop-title">Today's donuts</h2>
          <p className="shop-lede">Tap the ones you'd like. When your box looks right, send it to us on Messenger.</p>
        </div>

        <div id="case" ref={caseRef} className={`case${caseLit ? " is-lit" : ""}`} tabIndex={-1}>
          <div className="case-tools">
            <div className="chip-row" role="group" aria-label="Show">
              <button type="button" className="chip" aria-pressed={category === "all"} onClick={() => setCategory("all")}>
                Everything
              </button>
              {categories.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className="chip"
                  aria-pressed={category === String(item.id)}
                  onClick={() => setCategory(String(item.id))}
                >
                  {item.name}
                </button>
              ))}
            </div>
            <label className="search-field case-search">
              <span className="sr-only">Find a donut</span>
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                maxLength={100}
                value={query}
                placeholder="Find a donut"
                onChange={event => setQuery(event.target.value)}
              />
            </label>
          </div>

          {catalog.isPending && (
            <>
              <PastryCaseSkeleton />
              <span className="sr-only" role="status">Loading today's donuts</span>
            </>
          )}

          {catalog.isError && (
            <div className="case-message" role="alert">
              <h2 className="case-message-title">The case didn't load</h2>
              <p>Check your internet connection, then try again.</p>
              <button type="button" className="btn-primary" onClick={() => void catalog.refetch()}>Try again</button>
            </div>
          )}

          {catalog.isSuccess && products.length === 0 && (
            <div className="case-message">
              {filtered ? (
                <>
                  <h2 className="case-message-title">{search ? `No donuts called “${search}”` : "Nothing on this shelf today"}</h2>
                  <p>Try another name, or look at everything in the case.</p>
                  <button type="button" className="btn-secondary" onClick={showEverything}>Show everything</button>
                </>
              ) : (
                <>
                  <h2 className="case-message-title">The case is empty right now</h2>
                  <p>Message us to ask what's coming out next.</p>
                  <a className="btn-secondary" href={SHOP_MESSENGER} target="_blank" rel="noopener noreferrer">
                    Message us on Messenger
                  </a>
                </>
              )}
            </div>
          )}

          {products.length > 0 && <PastryCase shelves={shelves} quantityOf={quantityOf} onAdd={add} />}

          {catalog.hasNextPage && (
            <div className="case-more">
              <button
                type="button"
                className="btn-secondary"
                disabled={catalog.isFetchingNextPage}
                aria-busy={catalog.isFetchingNextPage}
                onClick={() => void catalog.fetchNextPage()}
              >
                {catalog.isFetchingNextPage ? "Loading…" : "Show more donuts"}
              </button>
            </div>
          )}
        </div>

        <HowToOrder />
        <ContactSection />
      </main>

      <footer className="shop-footer" data-reveal="">
        <span className="shop-footer-brand">Rowszein's Delight</span>
        <a href={SHOP_MESSENGER} target="_blank" rel="noopener noreferrer">Messenger</a>
        <a href={`mailto:${SHOP_EMAIL}`}>{SHOP_EMAIL}</a>
        <span>© {new Date().getFullYear()}</span>
        {/* Staff sign-in. Deliberately plain so customers read it as a brand mark. */}
        <Link to="/login" className="shop-footer-mark" aria-label="Staff sign in">
          <BrandDonutIcon width={18} height={18} aria-hidden="true" />
        </Link>
      </footer>

      {totalItems > 0 && (
        <BoxDock
          items={items}
          totalItems={totalItems}
          totalAmount={cart.totalAmount}
          windowRef={boxWindowRef}
          onReview={() => setSheetOpen(true)}
        />
      )}

      <BoxSheet open={sheetOpen} onClose={closeSheet} cart={cart} />

      <div className="sr-only" role="status">{announcement}</div>
    </div>
  );
}
