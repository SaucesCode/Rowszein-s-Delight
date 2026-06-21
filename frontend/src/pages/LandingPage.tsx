import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { productService } from "@/services/product.service";
import { useCart } from "@/hooks/useCart";
import CartPanel from "@/components/CartPanel";
import { ShoppingBag, CakeSlice, Plus, ImageOff } from "lucide-react";
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
function PublicNav({
  cartCount,
  onCartClick,
}: {
  cartCount: number;
  onCartClick: () => void;
}) {
  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-6 py-4"
      style={{
        background: "rgba(255, 253, 251, 0.85)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid #F5EDE0",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div
          className="flex items-center justify-center rounded-lg flex-shrink-0"
          style={{
            width: 32,
            height: 32,
            background: "linear-gradient(135deg, #FF6FAE 0%, #E5528A 100%)",
          }}
        >
          <CakeSlice size={17} color="#FFFFFF" />
        </div>
        <p className="font-heading font-semibold" style={{ fontSize: 16, color: "#6B4226" }}>
          Rowszein's Delight
        </p>
      </div>

      {/* Links */}
      <nav className="hidden md:flex items-center gap-8">
        <a
          href="#menu"
          className="font-body font-medium"
          style={{ fontSize: 14, color: "#5A5650" }}
        >
          Menu
        </a>
        <a
          href="#contact"
          className="font-body font-medium"
          style={{ fontSize: 14, color: "#5A5650" }}
        >
          Contact
        </a>
      </nav>

      {/* Right side — cart + hidden owner login */}
      <div className="flex items-center gap-3">
        {/* Cart button */}
        <button
          onClick={onCartClick}
          className="relative flex items-center justify-center rounded-full transition-colors"
          style={{ width: 38, height: 38, background: "#FFF0F7" }}
          aria-label={`Open cart, ${cartCount} item${cartCount !== 1 ? "s" : ""}`}
        >
          <ShoppingBag size={17} style={{ color: "#FF6FAE" }} aria-hidden="true" />
          {cartCount > 0 && (
            <span
              className="absolute flex items-center justify-center rounded-full font-heading font-semibold"
              style={{
                top: -2,
                right: -2,
                minWidth: 16,
                height: 16,
                padding: "0 3px",
                background: "#E5528A",
                color: "#FFFFFF",
                fontSize: 10,
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
          className="flex items-center justify-center rounded-full transition-opacity"
          style={{ width: 38, height: 38, opacity: 0.35 }}
          onMouseOver={e => ((e.currentTarget as HTMLElement).style.opacity = "0.7")}
          onMouseOut={e => ((e.currentTarget as HTMLElement).style.opacity = "0.35")}
          aria-label="Owner Login"
        >
          <CakeSlice size={16} style={{ color: "#6B4226" }} aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}

/* ─────────────────────────────────────────────
   HERO — split layout, organic decoration
   ───────────────────────────────────────────── */
function Hero({ featured }: { featured: Product | null }) {
  return (
    <section
      className="relative overflow-hidden px-6 py-16 md:py-24"
      style={{ background: "#FFF8F0" }}
    >
      {/* Decorative blobs */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute rounded-full"
          style={{
            width: 480,
            height: 480,
            top: -160,
            right: -120,
            background: "radial-gradient(circle, #FFD6E7 0%, transparent 70%)",
            opacity: 0.6,
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 320,
            height: 320,
            bottom: -140,
            left: -80,
            background: "radial-gradient(circle, #FFD6E7 0%, transparent 70%)",
            opacity: 0.4,
          }}
        />
      </div>

      <div className="relative max-w-400 mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        {/* Left — copy + CTAs */}
        <div className="animate-slide-up">
          <h1
            className="font-heading font-bold"
            style={{
              fontSize: "clamp(32px, 5vw, 48px)",
              color: "#6B4226",
              lineHeight: 1.15,
            }}
          >
            Love in
            <br />
            every bite
          </h1>
          <p
            className="font-body mt-4 max-w-md"
            style={{ fontSize: 15, color: "#7C7870", lineHeight: 1.7 }}
          >
            Freshly made donuts and desserts, baked daily with real ingredients and a whole lot
            of care. Browse our menu and build your order.
          </p>

          <div className="flex items-center gap-3 mt-7">
            <a
              href="#menu"
              className="btn-primary"
              style={{ fontSize: 14, padding: "10px 22px" }}
            >
              View Menu
            </a>
            <a
              href="#contact"
              className="btn-ghost"
              style={{ fontSize: 14, padding: "10px 22px" }}
            >
              Contact Us
            </a>
          </div>
        </div>

        {/* Right — featured product image */}
        <div className="relative flex items-center justify-center animate-fade-in">
          <div
            className="relative rounded-full overflow-hidden flex items-center justify-center"
            style={{
              width: "min(320px, 80vw)",
              height: "min(320px, 80vw)",
              background: "linear-gradient(135deg, #FFD6E7 0%, #FFF0F7 100%)",
              boxShadow: "0 20px 60px rgba(255, 111, 174, 0.30)",
            }}
          >
            {featured?.image_url ? (
              <img
                src={featured.image_url}
                alt={featured.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <CakeSlice
                size={64}
                style={{ color: "#FF6FAE", opacity: 0.4 }}
                aria-hidden="true"
              />
            )}
          </div>
          {featured && (
            <div
              className="absolute px-4 py-2 rounded-xl"
              style={{
                bottom: 8,
                left: "50%",
                transform: "translateX(-50%)",
                background: "#FFFDFB",
                boxShadow: "0 4px 16px rgba(107, 66, 38, 0.15)",
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
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   PRODUCT CARD
   ───────────────────────────────────────────── */
function ProductCard({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: (product: Product) => void;
}) {
  const handleAdd = () => {
    onAdd(product);
    toast.success(`${product.name} added to cart.`);
  };

  return (
    <div
      className="flex flex-col overflow-hidden transition-transform"
      style={{
        background: "#FFFDFB",
        border: "1px solid #F5EDE0",
        borderRadius: 16,
      }}
    >
      {/* Image */}
      <div
        className="flex items-center justify-center"
        style={{ aspectRatio: "1 / 1", background: "#FFF0F7" }}
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <ImageOff size={28} style={{ color: "#FF6FAE", opacity: 0.4 }} aria-hidden="true" />
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        <p className="font-heading font-semibold" style={{ fontSize: 14, color: "#6B4226" }}>
          {product.name}
        </p>
        {product.description && (
          <p
            className="font-body mt-1 line-clamp-2"
            style={{ fontSize: 12, color: "#9B6644", lineHeight: 1.5 }}
          >
            {product.description}
          </p>
        )}

        <div
          className="flex items-center justify-between mt-3 pt-3"
          style={{ borderTop: "1px solid #F5EDE0" }}
        >
          <span
            className="font-heading font-semibold"
            style={{ fontSize: 15, color: "#FF6FAE" }}
          >
            {formatPeso(Number(product.price))}
          </span>
          <button
            onClick={handleAdd}
            className="flex items-center justify-center rounded-full transition-colors"
            style={{
              width: 30,
              height: 30,
              background: "linear-gradient(135deg, #FF6FAE 0%, #E5528A 100%)",
              boxShadow: "0 2px 8px rgba(255, 111, 174, 0.30)",
            }}
            aria-label={`Add ${product.name} to cart`}
          >
            <Plus size={15} color="#FFFFFF" aria-hidden="true" />
          </button>
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
          <div className="skeleton" style={{ aspectRatio: "1 / 1", borderRadius: 0 }} />
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
  const featured = products[0] ?? null;

  return (
    <div ref={pageRef} style={{ background: "#FFF8F0", minHeight: "100vh" }}>
      <PublicNav cartCount={cart.totalItems} onCartClick={() => setCartOpen(true)} />

      <Hero featured={featured} />

      {/* Menu */}
      <section id="menu" className="px-6 py-16 max-w-400 mx-auto">
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
            Pick your favorites
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
            {products.map(product => (
              <ProductCard key={product.id} product={product} onAdd={cart.addItem} />
            ))}
          </div>
        )}
      </section>

      {/* Contact / footer */}
      <footer
        id="contact"
        className="px-6 py-12 text-center"
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
