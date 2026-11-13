import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ShoppingBag } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useShopBoxes } from "@/hooks/useBoxes";
import { useListingPages } from "@/hooks/useListingPages";
import { uniqueRecords } from "@/lib/listingParams";
import { BrandDonutIcon } from "@/pages/owner-home/OwnerHomeIcons";
import type { ShopBoxes } from "@/types/box.types";
import type { Category, Product } from "@/types/product.types";
import PastryCase, { PastryCaseSkeleton } from "./PastryCase";
import BoxChooser from "./BoxChooser";
import BoxHero from "./BoxHero";
import FillingDock from "./FillingDock";
import OrderDock from "./OrderDock";
import OrderSheet from "./OrderSheet";
import ContactSection from "./ContactSection";
import HowToOrder from "./HowToOrder";
import ShopHero from "./ShopHero";
import { Ornament } from "./ShopIcons";
import { SHOP_EMAIL, SHOP_MESSENGER, orderSummary } from "./order";
import { toShelves } from "./shelves";
import { useBoxOrder } from "./useBoxOrder";
import { useFlyToBox } from "./useFlyToBox";
import { useInView } from "./useInView";
import { useScrolledPast } from "./useScrolledPast";
import { useScrollReveal } from "./useScrollReveal";
import "./shop.css";

type BoxSize = ShopBoxes["sizes"][number];
type ReadyMade = ShopBoxes["assortments"][number];

export default function ShopPage() {
  const cart = useCart();
  const boxOrder = useBoxOrder();
  const shopBoxes = useShopBoxes();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [announcement, setAnnouncement] = useState("");
  const boxWindowRef = useRef<HTMLSpanElement>(null);
  const fillingBoxRef = useRef<HTMLDivElement>(null);
  const boxButtonRef = useRef<HTMLButtonElement>(null);
  const flyToOrder = useFlyToBox(boxWindowRef);
  const flyToFillingBox = useFlyToBox(fillingBoxRef);
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

  const sizes = shopBoxes.data?.sizes ?? [];
  const readyMade = shopBoxes.data?.assortments ?? [];
  const { addItem, items, totalItems } = cart;
  const { filling, boxes, addToBox, startBox: openBox } = boxOrder;
  const total = cart.totalAmount + boxOrder.boxesTotal;
  const hasOrder = totalItems > 0 || boxes.length > 0;

  // While a box is open, the case counts what's in that box; otherwise single donuts in the order.
  const quantityOf = useCallback(
    (productId: number) =>
      filling
        ? filling.donuts.filter(donut => donut.product_id === productId).length
        : (items.find(item => item.product_id === productId)?.quantity ?? 0),
    [filling, items],
  );

  const add = useCallback(
    (product: Product, art: HTMLElement) => {
      if (filling) {
        const left = filling.size - filling.donuts.length;
        if (left <= 0) {
          setAnnouncement(`Your box of ${filling.size} is full. Add it to your order.`);
          return;
        }
        addToBox(product);
        flyToFillingBox(art);
        setAnnouncement(left === 1 ? `${product.name} in. Your box is full.` : `${product.name} in. ${left - 1} more to go.`);
        return;
      }
      addItem(product);
      flyToOrder(art);
      setAnnouncement(`${product.name} added to your order.`);
    },
    [filling, addToBox, addItem, flyToFillingBox, flyToOrder],
  );

  const startBox = (size: BoxSize) => {
    if (filling && filling.donuts.length > 0) {
      setAnnouncement(`Finish or cancel your box of ${filling.size} first.`);
    } else {
      openBox(size.size, Number(size.price));
      setAnnouncement(`Box of ${size.size} open. Tap donuts in the case to fill it.`);
    }
    document.getElementById("menu")?.scrollIntoView({ block: "start" });
  };

  const addReadyMade = (assortment: ReadyMade, art: HTMLElement) => {
    const size = sizes.find(option => option.id === assortment.box_size_id);
    if (!size) return;
    boxOrder.addReadyMade(assortment, Number(size.price));
    flyToOrder(art);
    setAnnouncement(`${assortment.name} added to your order.`);
  };

  const finishBox = () => {
    if (!filling) return;
    boxOrder.finishBox();
    setAnnouncement(`Box of ${filling.size} added to your order.`);
  };

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
    <div ref={pageRef} className={`shop${filling ? " has-filling" : hasOrder ? " has-box" : ""}`}>
      <a className="shop-skip" href="#case">Skip to the donuts</a>
      <div ref={awningRef} className="shop-awning" aria-hidden="true" />

      <header className={`shop-header${headerStuck ? " is-stuck" : ""}`}>
        <div className="shop-header-inner">
          <nav className="shop-header-nav" aria-label="Sections">
            <a className="shop-header-link" href="#menu">Today's donuts</a>
            <a className="shop-header-link" href="#how">How to order</a>
          </nav>
          <a className="shop-brand" href="#top">Rowszein's Delight</a>
          <div className="shop-header-actions">
            <a className="shop-header-link" href="#contact">Ask us</a>
            <button ref={boxButtonRef} type="button" className="shop-box-button" onClick={() => setSheetOpen(true)}>
              <ShoppingBag size={20} aria-hidden="true" />
              <span className="shop-box-label">Your order</span>
              <span className="shop-box-count num">
                {boxes.length + totalItems}
                <span className="sr-only">: {orderSummary(boxes.length, totalItems)}</span>
              </span>
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="shop-main">
        {sizes.length > 0 ? (
          <BoxHero sizes={sizes} products={showcase} hasReadyMade={readyMade.length > 0} onStart={startBox} />
        ) : (
          <ShopHero products={showcase} onAdd={add} />
        )}

        {sizes.length > 0 && (
          <BoxChooser sizes={sizes} assortments={readyMade} onStart={startBox} onAddReadyMade={addReadyMade} />
        )}

        <div id="menu" className="shop-intro" data-reveal="">
          <Ornament className="shop-ornament" />
          <h2 className="shop-title">Today's donuts</h2>
          <p className="shop-lede">
            {filling
              ? `Tap donuts to fill your box of ${filling.size}. Premium flavours show their extra on the price card.`
              : sizes.length > 0
                ? "Tap a donut to add it on its own, or choose a box above and fill it from here."
                : "Tap the ones you'd like. When your order looks right, send it to us on Messenger."}
          </p>
        </div>

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

        <div id="case" ref={caseRef} className={`case${caseLit ? " is-lit" : ""}`} tabIndex={-1}>
          <div className="case-crown" aria-hidden="true" />
          <div className="case-interior">
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

            {products.length > 0 && <PastryCase shelves={shelves} filling={!!filling} quantityOf={quantityOf} onAdd={add} />}

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
          <div className="case-base" aria-hidden="true" />
        </div>

        <HowToOrder />
        <ContactSection />
      </main>

      <footer className="shop-footer" data-reveal="">
        <Ornament className="shop-ornament" />
        <p className="shop-footer-brand">Rowszein's Delight</p>
        <div className="shop-footer-links">
          <a href={SHOP_MESSENGER} target="_blank" rel="noopener noreferrer">Messenger</a>
          <a href={`mailto:${SHOP_EMAIL}`}>{SHOP_EMAIL}</a>
          <span>© {new Date().getFullYear()}</span>
          {/* Staff sign-in. Deliberately plain so customers read it as a brand mark. */}
          <Link to="/login" className="shop-footer-mark" aria-label="Staff sign in">
            <BrandDonutIcon width={18} height={18} aria-hidden="true" />
          </Link>
        </div>
      </footer>

      {filling ? (
        <FillingDock
          box={filling}
          boxRef={fillingBoxRef}
          onUndo={() => boxOrder.removeFromBox(filling.donuts.length - 1)}
          onCancel={boxOrder.cancelBox}
          onFinish={finishBox}
        />
      ) : (
        hasOrder && (
          <OrderDock
            boxes={boxes}
            singles={items}
            singleCount={totalItems}
            total={total}
            windowRef={boxWindowRef}
            onReview={() => setSheetOpen(true)}
          />
        )
      )}

      <OrderSheet open={sheetOpen} onClose={closeSheet} cart={cart} boxes={boxOrder} total={total} />

      <div className="sr-only" role="status">{announcement}</div>
    </div>
  );
}
