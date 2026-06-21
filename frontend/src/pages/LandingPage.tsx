import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { productService } from "@/services/product.service";
import { useCart } from "@/hooks/useCart";
import CartPanel from "@/components/CartPanel";
import { ShoppingBag, CakeSlice, Plus, Minus, ImageOff, Menu, X } from "lucide-react";
import toast from "react-hot-toast";
import type { Product } from "@/types/product.types";

/* ─────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────── */
function formatPeso(value: number) {
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/* ─────────────────────────────────────────────
   NAV BAR
   ───────────────────────────────────────────── */
function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="font-body font-medium relative"
      style={{ fontSize: 14, color: "#5A5650" }}
      onMouseOver={e => {
        (e.currentTarget as HTMLElement).style.color = "#E5528A";
      }}
      onMouseOut={e => {
        (e.currentTarget as HTMLElement).style.color = "#5A5650";
      }}
    >
      {children}
    </a>
  );
}

function PublicNav({
  cartCount,
  onCartClick,
}: {
  cartCount: number;
  onCartClick: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-30"
      style={{
        background: "rgba(255, 253, 251, 0.85)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid #F5EDE0",
      }}
    >
      <div className="flex items-center justify-between px-6 md:px-12 lg:px-20 py-4">
        {/* Logo — warm circular badge with inner ring, reads more like
            a bakery seal/stamp than a generic app icon square. */}
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{
              width: 36,
              height: 36,
              background: "linear-gradient(135deg, #FF6FAE 0%, #E5528A 100%)",
              border: "2px solid #FFD6E7",
              boxShadow: "0 3px 10px rgba(255, 111, 174, 0.35)",
            }}
          >
            <CakeSlice size={17} color="#FFFFFF" />
          </div>
          <p className="font-heading font-semibold" style={{ fontSize: 16, color: "#6B4226" }}>
            Rowszein's Delight
          </p>
        </div>

        {/* Desktop links + CTA */}
        <nav className="hidden md:flex items-center gap-8">
          <NavLink href="#menu">Menu</NavLink>
          <a
            href="#contact"
            className="font-heading font-semibold transition-transform"
            style={{
              fontSize: 13,
              color: "#E5528A",
              border: "1.5px solid #FF6FAE",
              borderRadius: 999,
              padding: "7px 18px",
              display: "inline-block",
            }}
            onMouseOver={e => {
              (e.currentTarget as HTMLElement).style.background = "#FFF0F7";
            }}
            onMouseOut={e => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            Contact Us
          </a>
        </nav>

        {/* Right side — cart + hidden owner login + mobile hamburger */}
        <div className="flex items-center gap-2.5">
          {/* Cart button — filled, so it visually reads as THE primary
              action in the nav, distinct from the deliberately quiet
              login icon next to it. */}
          <button
            onClick={onCartClick}
            className="relative flex items-center justify-center rounded-full transition-transform"
            style={{
              width: 38,
              height: 38,
              background: "linear-gradient(135deg, #FF6FAE 0%, #E5528A 100%)",
              boxShadow: "0 3px 10px rgba(255, 111, 174, 0.35)",
            }}
            onMouseOver={e => {
              (e.currentTarget as HTMLElement).style.transform = "scale(1.06)";
            }}
            onMouseOut={e => {
              (e.currentTarget as HTMLElement).style.transform = "scale(1)";
            }}
            aria-label={`Open cart, ${cartCount} item${cartCount !== 1 ? "s" : ""}`}
          >
            <ShoppingBag size={17} color="#FFFFFF" aria-hidden="true" />
            {cartCount > 0 && (
              <span
                className="absolute flex items-center justify-center rounded-full font-heading font-semibold"
                style={{
                  top: -3,
                  right: -3,
                  minWidth: 17,
                  height: 17,
                  padding: "0 3px",
                  background: "#FFFDFB",
                  color: "#E5528A",
                  fontSize: 10,
                  border: "1.5px solid #FF6FAE",
                }}
                aria-hidden="true"
              >
                {cartCount}
              </span>
            )}
          </button>

          {/* Hidden owner login — looks like a quiet logo flourish, not a CTA */}
          <Link
            to="/login"
            className="hidden sm:flex items-center justify-center rounded-full transition-opacity"
            style={{ width: 38, height: 38, opacity: 0.35 }}
            onMouseOver={e => ((e.currentTarget as HTMLElement).style.opacity = "0.7")}
            onMouseOut={e => ((e.currentTarget as HTMLElement).style.opacity = "0.35")}
            aria-label="Owner Login"
          >
            <CakeSlice size={16} style={{ color: "#6B4226" }} aria-hidden="true" />
          </Link>

          {/* Mobile hamburger — only shown under md breakpoint, where
              the desktop nav links are hidden. */}
          <button
            onClick={() => setMobileOpen(open => !open)}
            className="flex md:hidden items-center justify-center rounded-full"
            style={{ width: 38, height: 38, background: "#FFF0F7" }}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <X size={18} style={{ color: "#FF6FAE" }} aria-hidden="true" />
            ) : (
              <Menu size={18} style={{ color: "#FF6FAE" }} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer — simple slide-down panel with the same links
          and CTA that the desktop nav shows inline. */}
      {mobileOpen && (
        <div
          className="md:hidden flex flex-col gap-1 px-6 pb-5 pt-1 animate-fade-in"
          style={{ borderTop: "1px solid #F5EDE0" }}
        >
          <a
            href="#menu"
            onClick={() => setMobileOpen(false)}
            className="font-body font-medium py-2.5"
            style={{ fontSize: 14, color: "#5A5650" }}
          >
            Menu
          </a>
          <a
            href="#contact"
            onClick={() => setMobileOpen(false)}
            className="font-heading font-semibold text-center mt-2"
            style={{
              fontSize: 13,
              color: "#FFFFFF",
              background: "linear-gradient(135deg, #FF6FAE 0%, #E5528A 100%)",
              borderRadius: 999,
              padding: "10px 18px",
            }}
          >
            Contact Us
          </a>
          {/* Owner login also reachable here on mobile, since the icon
              version is hidden below the sm breakpoint */}
          <Link
            to="/login"
            onClick={() => setMobileOpen(false)}
            className="font-body sm:hidden mt-2"
            style={{ fontSize: 12, color: "#D1CEC7", textAlign: "center" }}
          >
            Owner Login
          </Link>
        </div>
      )}
    </header>
  );
}

/* ─────────────────────────────────────────────
   ORBIT THUMBNAIL — small satellite product photo
   that sits near the edge of the hero circle.
   ───────────────────────────────────────────── */
function OrbitThumbnail({
  product,
  size,
  style,
}: {
  product: Product;
  size: number;
  style: React.CSSProperties;
}) {
  return (
    <div
      className="absolute rounded-full overflow-hidden transition-transform duration-300"
      style={{
        width: size,
        height: size,
        border: "3px solid #FFFDFB",
        boxShadow: "0 8px 20px rgba(107, 66, 38, 0.18)",
        ...style,
      }}
      onMouseOver={e => {
        (e.currentTarget as HTMLElement).style.transform =
          `${style.transform ?? ""} translateY(-4px)`;
      }}
      onMouseOut={e => {
        (e.currentTarget as HTMLElement).style.transform = style.transform ?? "";
      }}
    >
      {product.image_url ? (
        <img
          src={product.image_url}
          alt={product.name}
          className="w-full h-full"
          style={{ objectFit: "cover" }}
        />
      ) : (
        <div
          className="flex items-center justify-center w-full h-full"
          style={{ background: "#FFF0F7" }}
        >
          <CakeSlice size={size * 0.35} style={{ color: "#FF6FAE", opacity: 0.4 }} />
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   HERO — split layout. The circular showcase is
   the page's signature element: one hero product
   at center, two smaller "satellite" products
   orbiting its edge, all sharing one soft pink
   halo instead of being separate sections.
   ───────────────────────────────────────────── */
function Hero({ products }: { products: Product[] }) {
  const featured = products[0] ?? null;
  const satellites = products.slice(1, 3);

  return (
    <section
      className="relative overflow-hidden px-6 md:px-12 lg:px-20 pt-14 pb-20 md:pt-20 md:pb-28"
      style={{ background: "#FFF8F0" }}
    >
      {/* Decorative blobs */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute rounded-full"
          style={{
            width: 560,
            height: 560,
            top: -200,
            right: -160,
            background: "radial-gradient(circle, #FFD6E7 0%, transparent 70%)",
            opacity: 0.6,
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 360,
            height: 360,
            bottom: -160,
            left: -100,
            background: "radial-gradient(circle, #FFD6E7 0%, transparent 70%)",
            opacity: 0.4,
          }}
        />
      </div>

      <div className="relative max-w-400 mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        {/* Left — copy + CTAs */}
        <div className="animate-slide-up">
          <p
            className="font-heading font-semibold uppercase mb-3"
            style={{ fontSize: 11, color: "#FF6FAE", letterSpacing: "0.1em" }}
          >
            Baked fresh, every single day
          </p>
          <h1
            className="font-heading font-bold"
            style={{
              fontSize: "clamp(34px, 5vw, 52px)",
              color: "#6B4226",
              lineHeight: 1.1,
            }}
          >
            Love in
            <br />
            every bite
          </h1>
          <p
            className="font-body mt-5 max-w-md"
            style={{ fontSize: 15, color: "#7C7870", lineHeight: 1.7 }}
          >
            Hand-rolled donuts and desserts, made fresh each morning with real ingredients and
            a whole lot of care. Browse the menu and build your order below.
          </p>

          <div className="flex items-center gap-3 mt-8">
            <a
              href="#menu"
              className="btn-primary"
              style={{ fontSize: 14, padding: "11px 24px" }}
            >
              View Menu
            </a>
            <a
              href="#contact"
              className="btn-ghost"
              style={{ fontSize: 14, padding: "11px 24px" }}
            >
              Contact Us
            </a>
          </div>
        </div>

        {/* Right — hero circle with orbiting satellites */}
        <div
          className="relative flex items-center justify-center animate-fade-in"
          style={{ minHeight: 340 }}
        >
          {/* Main hero circle */}
          <div
            className="relative rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
            style={{
              width: "min(300px, 72vw)",
              height: "min(300px, 72vw)",
              background: "linear-gradient(135deg, #FFD6E7 0%, #FFF0F7 100%)",
              boxShadow: "0 24px 64px rgba(255, 111, 174, 0.32)",
            }}
          >
            {featured?.image_url ? (
              <img
                src={featured.image_url}
                alt={featured.name}
                className="w-full h-full"
                style={{ objectFit: "cover" }}
              />
            ) : (
              <CakeSlice
                size={64}
                style={{ color: "#FF6FAE", opacity: 0.4 }}
                aria-hidden="true"
              />
            )}
          </div>

          {/* Floating name + price badge */}
          {featured && (
            <div
              className="absolute px-4 py-2 rounded-xl z-10"
              style={{
                bottom: "8%",
                left: "50%",
                transform: "translateX(-50%)",
                background: "#FFFDFB",
                boxShadow: "0 6px 20px rgba(107, 66, 38, 0.18)",
              }}
            >
              <p
                className="font-heading font-semibold text-center"
                style={{ fontSize: 13, color: "#6B4226" }}
              >
                {featured.name}
              </p>
              <p
                className="font-body text-center"
                style={{ fontSize: 12, color: "#FF6FAE", fontWeight: 600 }}
              >
                {formatPeso(Number(featured.price))}
              </p>
            </div>
          )}

          {/* Orbiting satellite thumbnails */}
          {satellites[0] && (
            <OrbitThumbnail
              product={satellites[0]}
              size={76}
              style={{ top: "2%", right: "0%" }}
            />
          )}
          {satellites[1] && (
            <OrbitThumbnail
              product={satellites[1]}
              size={64}
              style={{ bottom: "16%", left: "-4%" }}
            />
          )}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   PRODUCT CARD
   Fixed-height image block (explicit px, not just
   aspect-ratio) with its own overflow boundary —
   this is what keeps every card the same shape
   regardless of the source image's native size.
   ───────────────────────────────────────────── */
const CARD_IMAGE_HEIGHT = 180;

function ProductCard({
  product,
  quantity,
  onAdd,
  onIncrement,
  onDecrement,
}: {
  product: Product;
  quantity: number;
  onAdd: (product: Product) => void;
  onIncrement: (id: number) => void;
  onDecrement: (id: number) => void;
}) {
  const handleAdd = () => {
    onAdd(product);
    toast.success(`${product.name} added to cart.`);
  };

  return (
    <div
      className="flex flex-col h-full overflow-hidden transition-shadow"
      style={{
        background: "#FFFDFB",
        border: "1px solid #F5EDE0",
        borderRadius: 16,
      }}
      onMouseOver={e => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          "0 12px 28px rgba(107, 66, 38, 0.12)";
      }}
      onMouseOut={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      {/* Image — fixed height + its own overflow:hidden boundary.
          This is the actual fix: previously the wrapper only had
          aspect-ratio with no explicit height, and overflow:hidden
          lived on the outer card div instead of this element, so
          tall/portrait source images could push past their box. */}
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{
          height: CARD_IMAGE_HEIGHT,
          overflow: "hidden",
          background: "#FFF0F7",
        }}
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <ImageOff size={28} style={{ color: "#FF6FAE", opacity: 0.4 }} aria-hidden="true" />
        )}
      </div>

      {/* Info — flex-1 so the footer row always sits at the same
          relative position regardless of description length */}
      <div className="p-4 flex flex-col flex-1">
        <p className="font-heading font-semibold" style={{ fontSize: 14, color: "#6B4226" }}>
          {product.name}
        </p>

        {/* Fixed-height description slot — line-clamp keeps two lines
            max, and min-height reserves the space even when a product
            has no description, so price rows still align across cards. */}
        <p
          className="font-body mt-1 line-clamp-2"
          style={{ fontSize: 12, color: "#9B6644", lineHeight: 1.5, minHeight: 32 }}
        >
          {product.description || ""}
        </p>

        <div
          className="flex items-center justify-between mt-3 pt-3"
          style={{ borderTop: "1px solid #F5EDE0", marginTop: "auto" }}
        >
          <span
            className="font-heading font-semibold"
            style={{ fontSize: 15, color: "#FF6FAE" }}
          >
            {formatPeso(Number(product.price))}
          </span>

          {/* Plain + button until the item is in the cart, then it
              becomes a stepper. Keeps the grid quiet by default —
              a stepper appearing is itself the signal that an item
              has been added, no separate badge needed. */}
          {quantity === 0 ? (
            <button
              onClick={handleAdd}
              className="flex items-center justify-center rounded-full transition-transform"
              style={{
                width: 30,
                height: 30,
                background: "linear-gradient(135deg, #FF6FAE 0%, #E5528A 100%)",
                boxShadow: "0 2px 8px rgba(255, 111, 174, 0.30)",
              }}
              onMouseOver={e => {
                (e.currentTarget as HTMLElement).style.transform = "scale(1.08)";
              }}
              onMouseOut={e => {
                (e.currentTarget as HTMLElement).style.transform = "scale(1)";
              }}
              aria-label={`Add ${product.name} to cart`}
            >
              <Plus size={15} color="#FFFFFF" aria-hidden="true" />
            </button>
          ) : (
            <div
              className="flex items-center gap-1.5 rounded-full"
              style={{ background: "#FFF0F7", padding: "3px 4px" }}
            >
              <button
                onClick={() => onDecrement(product.id)}
                className="flex items-center justify-center rounded-full transition-colors"
                style={{
                  width: 22,
                  height: 22,
                  background: "#FFFDFB",
                  border: "1px solid #FFD6E7",
                }}
                aria-label={`Decrease quantity of ${product.name}`}
              >
                <Minus size={11} style={{ color: "#E5528A" }} aria-hidden="true" />
              </button>
              <span
                className="font-heading font-semibold text-center"
                style={{ fontSize: 13, color: "#6B4226", width: 16 }}
                aria-live="polite"
              >
                {quantity}
              </span>
              <button
                onClick={() => onIncrement(product.id)}
                className="flex items-center justify-center rounded-full transition-colors"
                style={{
                  width: 22,
                  height: 22,
                  background: "linear-gradient(135deg, #FF6FAE 0%, #E5528A 100%)",
                }}
                aria-label={`Increase quantity of ${product.name}`}
              >
                <Plus size={11} color="#FFFFFF" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MENU SECTION SKELETON
   ───────────────────────────────────────────── */
function MenuSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          style={{ borderRadius: 16, overflow: "hidden", border: "1px solid #F5EDE0" }}
        >
          <div className="skeleton" style={{ height: CARD_IMAGE_HEIGHT, borderRadius: 0 }} />
          <div className="p-4 space-y-2">
            <div className="skeleton" style={{ height: 12, width: "70%", borderRadius: 5 }} />
            <div className="skeleton" style={{ height: 10, width: "50%", borderRadius: 5 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   PAGE
   ───────────────────────────────────────────── */
export default function LandingPage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const [cartOpen, setCartOpen] = useState(false);

  const cart = useCart();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-products"],
    queryFn: () => productService.getAll(1),
  });

  const allProducts: Product[] = data?.data?.results ?? [];
  const products = allProducts.filter(p => p.is_available);

  return (
    <div ref={pageRef} style={{ background: "#FFF8F0", minHeight: "100vh" }}>
      <PublicNav cartCount={cart.totalItems} onCartClick={() => setCartOpen(true)} />

      <Hero products={products} />

      {/* Menu */}
      <section id="menu" className="px-6 md:px-12 lg:px-20 py-16 max-w-400 mx-auto">
        <div className="text-center mb-10">
          <p
            className="font-heading font-semibold uppercase tracking-wide"
            style={{ fontSize: 11, color: "#FF6FAE", letterSpacing: "0.08em" }}
          >
            Our Menu
          </p>
          <h2
            className="font-heading font-bold mt-2"
            style={{ fontSize: 28, color: "#6B4226" }}
          >
            Your Next Favorite
          </h2>
        </div>

        {isLoading && <MenuSkeleton />}

        {isError && (
          <div className="card-surface p-8 text-center max-w-md mx-auto">
            <p className="font-body" style={{ fontSize: 13, color: "#EF4444" }}>
              Couldn't load the menu right now. Please try again shortly.
            </p>
          </div>
        )}

        {!isLoading && !isError && products.length === 0 && (
          <div className="card-surface p-10 text-center max-w-md mx-auto">
            <CakeSlice
              size={28}
              style={{ color: "#FF6FAE", opacity: 0.5, margin: "0 auto 12px" }}
            />
            <p className="font-body" style={{ fontSize: 13, color: "#9B6644" }}>
              No items available right now — check back soon!
            </p>
          </div>
        )}

        {!isLoading && !isError && products.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map(product => {
              const cartItem = cart.items.find(i => i.product_id === product.id);
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  quantity={cartItem?.quantity ?? 0}
                  onAdd={cart.addItem}
                  onIncrement={cart.incrementItem}
                  onDecrement={cart.decrementItem}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Contact / footer */}
      <footer
        id="contact"
        className="px-6 md:px-12 lg:px-20 py-12 text-center"
        style={{ background: "#FFFDFB", borderTop: "1px solid #F5EDE0" }}
      >
        <p className="font-heading font-semibold" style={{ fontSize: 15, color: "#6B4226" }}>
          Rowszein's Delight
        </p>
        <p className="font-body mt-2" style={{ fontSize: 13, color: "#9B6644" }}>
          Have a question or want to place a custom order? Send us a message on Facebook or
          visit us in store.
        </p>
        <p className="font-body mt-6" style={{ fontSize: 12, color: "#D1CEC7" }}>
          © {new Date().getFullYear()} Rowszein's Delight
        </p>
      </footer>

      <CartPanel
        open={cartOpen}
        items={cart.items}
        totalAmount={cart.totalAmount}
        onClose={() => setCartOpen(false)}
        onIncrement={cart.incrementItem}
        onDecrement={cart.decrementItem}
        onRemove={cart.removeItem}
        onClearAll={cart.clearCart}
      />
    </div>
  );
}
