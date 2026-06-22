import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { productService } from "@/services/product.service";
import { useCart } from "@/hooks/useCart";
import CartPanel from "@/components/CartPanel";
import {
  ShoppingBag,
  CakeSlice,
  Plus,
  Minus,
  ImageOff,
  Menu,
  X,
  Leaf,
  Heart,
  PackageCheck,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import type { Product } from "@/types/product.types";

/* ─────────────────────────────────────────────
   CONSTANTS
   ───────────────────────────────────────────── */
const PAGE_BG = "#FFD6E7";
const CARD_BG = "#FFFDFB";
const CARD_IMAGE_HEIGHT = 180;

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
   NAV LINK
   ───────────────────────────────────────────── */
function NavLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      className="font-body font-medium relative group"
      style={{ fontSize: 14, color: "#5A5650" }}
      onMouseOver={e => ((e.currentTarget as HTMLElement).style.color = "#E5528A")}
      onMouseOut={e => ((e.currentTarget as HTMLElement).style.color = "#5A5650")}
    >
      {children}
    </a>
  );
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
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-30"
      style={{
        background: "rgba(255, 253, 251, 0.90)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid #F5EDE0",
      }}
    >
      <div className="flex items-center justify-between px-6 md:px-12 lg:px-20 py-4">
        {/* Logo — circular bakery-seal badge */}
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
          <div>
            <p
              className="font-heading font-bold"
              style={{ fontSize: 15, color: "#6B4226", lineHeight: 1.1 }}
            >
              Rowszein's Delight
            </p>
            <p
              className="font-body"
              style={{ fontSize: 10, color: "#9B6644", letterSpacing: "0.04em" }}
            >
              Homemade Donuts &amp; Desserts
            </p>
          </div>
        </div>

        {/* Desktop links + CTA */}
        <nav className="hidden md:flex items-center gap-8">
          <NavLink href="#menu">Menu</NavLink>
          <NavLink href="#why-us">About</NavLink>
          <a
            href="#contact"
            className="font-heading font-semibold transition-colors"
            style={{
              fontSize: 13,
              color: "#E5528A",
              border: "1.5px solid #FF6FAE",
              borderRadius: 999,
              padding: "7px 20px",
            }}
            onMouseOver={e => {
              (e.currentTarget as HTMLElement).style.background = "#FF6FAE";
              (e.currentTarget as HTMLElement).style.color = "#FFFFFF";
            }}
            onMouseOut={e => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "#E5528A";
            }}
          >
            Contact Us
          </a>
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2.5">
          {/* Cart — filled pink, primary action */}
          <button
            onClick={onCartClick}
            className="relative flex items-center justify-center rounded-full transition-transform"
            style={{
              width: 38,
              height: 38,
              background: "linear-gradient(135deg, #FF6FAE 0%, #E5528A 100%)",
              boxShadow: "0 3px 10px rgba(255, 111, 174, 0.35)",
            }}
            onMouseOver={e =>
              ((e.currentTarget as HTMLElement).style.transform = "scale(1.06)")
            }
            onMouseOut={e => ((e.currentTarget as HTMLElement).style.transform = "scale(1)")}
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

          {/* Hidden owner login */}
          <Link
            to="/login"
            className="hidden sm:flex items-center justify-center rounded-full transition-opacity"
            style={{ width: 38, height: 38, opacity: 0.3 }}
            onMouseOver={e => ((e.currentTarget as HTMLElement).style.opacity = "0.65")}
            onMouseOut={e => ((e.currentTarget as HTMLElement).style.opacity = "0.3")}
            aria-label="Owner Login"
          >
            <CakeSlice size={16} style={{ color: "#6B4226" }} aria-hidden="true" />
          </Link>

          {/* Hamburger */}
          <button
            onClick={() => setMobileOpen(o => !o)}
            className="flex md:hidden items-center justify-center rounded-full"
            style={{ width: 38, height: 38, background: "#FFF0F7" }}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <X size={18} style={{ color: "#FF6FAE" }} />
            ) : (
              <Menu size={18} style={{ color: "#FF6FAE" }} />
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          className="md:hidden flex flex-col gap-1 px-6 pb-5 pt-1 animate-fade-in"
          style={{ borderTop: "1px solid #F5EDE0", background: "#FFFDFB" }}
        >
          <NavLink href="#menu" onClick={() => setMobileOpen(false)}>
            Menu
          </NavLink>
          <NavLink href="#why-us" onClick={() => setMobileOpen(false)}>
            About
          </NavLink>
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
          <Link
            to="/login"
            onClick={() => setMobileOpen(false)}
            className="font-body sm:hidden mt-2 text-center"
            style={{ fontSize: 11, color: "#D1CEC7" }}
          >
            Owner Login
          </Link>
        </div>
      )}
    </header>
  );
}

/* ─────────────────────────────────────────────
   ORBIT THUMBNAIL
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
   HERO
   ───────────────────────────────────────────── */
function Hero({ products }: { products: Product[] }) {
  const featured = products[0] ?? null;
  const satellites = products.slice(1, 3);

  return (
    <section
      className="relative overflow-hidden px-6 md:px-12 lg:px-20 pt-14 pb-20 md:pt-20 md:pb-28"
      style={{ background: PAGE_BG }}
    >
      {/* Decorative blobs */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute rounded-full"
          style={{
            width: 500,
            height: 500,
            top: -180,
            right: -140,
            background: "radial-gradient(circle, #FF6FAE 0%, transparent 70%)",
            opacity: 0.18,
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 340,
            height: 340,
            bottom: -140,
            left: -80,
            background: "radial-gradient(circle, #FF6FAE 0%, transparent 70%)",
            opacity: 0.14,
          }}
        />
      </div>

      <div className="relative max-w-400 mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        {/* Left */}
        <div className="animate-slide-up">
          <p
            className="font-heading font-semibold uppercase mb-3"
            style={{ fontSize: 11, color: "#E5528A", letterSpacing: "0.12em" }}
          >
            Baked fresh, every single day
          </p>
          <h1
            className="font-heading font-bold"
            style={{ fontSize: "clamp(36px, 5vw, 54px)", color: "#6B4226", lineHeight: 1.1 }}
          >
            Love in
            <br />
            every bite
          </h1>
          <p
            className="font-body mt-5 max-w-md"
            style={{ fontSize: 15, color: "#7C7870", lineHeight: 1.75 }}
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

        {/* Right — hero circle + satellites */}
        <div
          className="relative flex items-center justify-center animate-fade-in"
          style={{ minHeight: 340 }}
        >
          <div
            className="relative rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
            style={{
              width: "min(300px, 72vw)",
              height: "min(300px, 72vw)",
              background: "linear-gradient(135deg, #FF6FAE 0%, #FFD6E7 100%)",
              boxShadow: "0 24px 64px rgba(255, 111, 174, 0.40)",
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
                style={{ color: "#FFFFFF", opacity: 0.6 }}
                aria-hidden="true"
              />
            )}
          </div>

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
   WHY US — trust signal strip
   ───────────────────────────────────────────── */
const WHY_US = [
  {
    icon: Leaf,
    title: "Real Ingredients",
    body: "No artificial flavors. Just good food made the honest way.",
  },
  {
    icon: Sparkles,
    title: "Made Fresh Daily",
    body: "Every batch is hand-rolled and baked fresh each morning.",
  },
  {
    icon: Heart,
    title: "Made with Love",
    body: "A family recipe passed down and perfected over the years.",
  },
  {
    icon: PackageCheck,
    title: "Easy Ordering",
    body: "Build your order here, save the summary, and send it our way.",
  },
];

function WhyUs() {
  return (
    <section
      id="why-us"
      className="px-6 md:px-12 lg:px-20 py-16"
      style={{ background: "#FFFDFB" }}
    >
      <div className="max-w-400 mx-auto">
        <div className="text-center mb-10">
          <p
            className="font-heading font-semibold uppercase tracking-wide"
            style={{ fontSize: 11, color: "#FF6FAE", letterSpacing: "0.08em" }}
          >
            Why Rowszein's
          </p>
          <h2
            className="font-heading font-bold mt-2"
            style={{ fontSize: 26, color: "#6B4226" }}
          >
            Baked with purpose
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {WHY_US.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="flex flex-col items-center text-center p-6 rounded-2xl"
              style={{ background: "#FFF8F0", border: "1px solid #F5EDE0" }}
            >
              <div
                className="flex items-center justify-center rounded-2xl mb-4"
                style={{
                  width: 48,
                  height: 48,
                  background: "#FFF0F7",
                  border: "1px solid #FFD6E7",
                }}
              >
                <Icon size={22} style={{ color: "#FF6FAE" }} aria-hidden="true" />
              </div>
              <p
                className="font-heading font-semibold mb-1"
                style={{ fontSize: 14, color: "#6B4226" }}
              >
                {title}
              </p>
              <p
                className="font-body"
                style={{ fontSize: 12, color: "#9B6644", lineHeight: 1.6 }}
              >
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   BESTSELLERS — featured row
   ───────────────────────────────────────────── */
function BestsellerCard({
  product,
  quantity,
  onAdd,
  onIncrement,
  onDecrement,
}: {
  product: Product;
  quantity: number;
  onAdd: (p: Product) => void;
  onIncrement: (id: number) => void;
  onDecrement: (id: number) => void;
}) {
  return (
    <div
      className="flex gap-4 p-4 rounded-2xl transition-shadow"
      style={{ background: CARD_BG, border: "1px solid #F5EDE0" }}
      onMouseOver={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = "0 10px 24px rgba(107,66,38,0.10)";
      }}
      onMouseOut={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      {/* Image */}
      <div
        className="flex-shrink-0 rounded-xl overflow-hidden"
        style={{ width: 80, height: 80, background: "#FFF0F7" }}
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            <ImageOff size={20} style={{ color: "#FF6FAE", opacity: 0.4 }} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="font-heading font-semibold" style={{ fontSize: 14, color: "#6B4226" }}>
            {product.name}
          </p>
          <span
            className="badge badge-pink flex-shrink-0"
            style={{
              fontSize: 10,
              background: "#FFF0F7",
              color: "#E5528A",
              border: "1px solid #FFD6E7",
            }}
          >
            Bestseller
          </span>
        </div>
        {product.description && (
          <p
            className="font-body mt-1 line-clamp-1"
            style={{ fontSize: 12, color: "#9B6644" }}
          >
            {product.description}
          </p>
        )}

        <div className="flex items-center justify-between mt-auto pt-2">
          <span
            className="font-heading font-semibold"
            style={{ fontSize: 14, color: "#FF6FAE" }}
          >
            {formatPeso(Number(product.price))}
          </span>

          {quantity === 0 ? (
            <button
              onClick={() => {
                onAdd(product);
                toast.success(`${product.name} added to cart.`);
              }}
              className="flex items-center gap-1 rounded-full font-heading font-semibold transition-transform"
              style={{
                fontSize: 12,
                padding: "5px 12px",
                background: "linear-gradient(135deg, #FF6FAE 0%, #E5528A 100%)",
                color: "#FFFFFF",
                boxShadow: "0 2px 8px rgba(255,111,174,0.28)",
              }}
              onMouseOver={e => {
                (e.currentTarget as HTMLElement).style.transform = "scale(1.04)";
              }}
              onMouseOut={e => {
                (e.currentTarget as HTMLElement).style.transform = "scale(1)";
              }}
            >
              <Plus size={13} aria-hidden="true" /> Add
            </button>
          ) : (
            <div
              className="flex items-center gap-1.5 rounded-full"
              style={{ background: "#FFF0F7", padding: "3px 4px" }}
            >
              <button
                onClick={() => onDecrement(product.id)}
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 22,
                  height: 22,
                  background: "#FFFDFB",
                  border: "1px solid #FFD6E7",
                }}
                aria-label={`Decrease ${product.name}`}
              >
                <Minus size={11} style={{ color: "#E5528A" }} />
              </button>
              <span
                className="font-heading font-semibold text-center"
                style={{ fontSize: 13, color: "#6B4226", width: 16 }}
              >
                {quantity}
              </span>
              <button
                onClick={() => onIncrement(product.id)}
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 22,
                  height: 22,
                  background: "linear-gradient(135deg, #FF6FAE 0%, #E5528A 100%)",
                }}
                aria-label={`Increase ${product.name}`}
              >
                <Plus size={11} color="#FFFFFF" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PRODUCT CARD — full menu grid
   ───────────────────────────────────────────── */
function ProductCard({
  product,
  quantity,
  onAdd,
  onIncrement,
  onDecrement,
}: {
  product: Product;
  quantity: number;
  onAdd: (p: Product) => void;
  onIncrement: (id: number) => void;
  onDecrement: (id: number) => void;
}) {
  return (
    <div
      className="flex flex-col h-full overflow-hidden transition-shadow"
      style={{ background: CARD_BG, border: "1px solid #F5EDE0", borderRadius: 16 }}
      onMouseOver={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 28px rgba(107,66,38,0.12)";
      }}
      onMouseOut={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{ height: CARD_IMAGE_HEIGHT, overflow: "hidden", background: "#FFF0F7" }}
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <ImageOff size={28} style={{ color: "#FF6FAE", opacity: 0.4 }} aria-hidden="true" />
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <p className="font-heading font-semibold" style={{ fontSize: 14, color: "#6B4226" }}>
          {product.name}
        </p>
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

          {quantity === 0 ? (
            <button
              onClick={() => {
                onAdd(product);
                toast.success(`${product.name} added to cart.`);
              }}
              className="flex items-center justify-center rounded-full transition-transform"
              style={{
                width: 30,
                height: 30,
                background: "linear-gradient(135deg, #FF6FAE 0%, #E5528A 100%)",
                boxShadow: "0 2px 8px rgba(255,111,174,0.30)",
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
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 22,
                  height: 22,
                  background: "#FFFDFB",
                  border: "1px solid #FFD6E7",
                }}
                aria-label={`Decrease ${product.name}`}
              >
                <Minus size={11} style={{ color: "#E5528A" }} />
              </button>
              <span
                className="font-heading font-semibold text-center"
                style={{ fontSize: 13, color: "#6B4226", width: 16 }}
              >
                {quantity}
              </span>
              <button
                onClick={() => onIncrement(product.id)}
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 22,
                  height: 22,
                  background: "linear-gradient(135deg, #FF6FAE 0%, #E5528A 100%)",
                }}
                aria-label={`Increase ${product.name}`}
              >
                <Plus size={11} color="#FFFFFF" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MENU SKELETON
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
   ORDER CTA BANNER
   ───────────────────────────────────────────── */
function OrderCTA() {
  return (
    <section
      className="px-6 md:px-12 lg:px-20 py-16"
      style={{ background: "linear-gradient(135deg, #FF6FAE 0%, #E5528A 100%)" }}
    >
      <div className="max-w-400 mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
        <div>
          <p
            className="font-heading font-bold"
            style={{ fontSize: 24, color: "#FFFFFF", lineHeight: 1.2 }}
          >
            Want a custom order?
          </p>
          <p
            className="font-body mt-2"
            style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 1.6 }}
          >
            Bulk orders, special flavors, event boxes — just send us a message and we'll sort
            it out together.
          </p>
        </div>
        <a
          href="#contact"
          className="font-heading font-semibold flex-shrink-0 transition-transform"
          style={{
            fontSize: 14,
            color: "#E5528A",
            background: "#FFFDFB",
            borderRadius: 999,
            padding: "12px 28px",
            boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
          }}
          onMouseOver={e => {
            (e.currentTarget as HTMLElement).style.transform = "scale(1.03)";
          }}
          onMouseOut={e => {
            (e.currentTarget as HTMLElement).style.transform = "scale(1)";
          }}
        >
          Message Us
        </a>
      </div>
    </section>
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
  const featured = products.filter(p => p.is_featured);

  function cardProps(product: Product) {
    const cartItem = cart.items.find(i => i.product_id === product.id);
    return {
      quantity: cartItem?.quantity ?? 0,
      onAdd: cart.addItem,
      onIncrement: cart.incrementItem,
      onDecrement: cart.decrementItem,
    };
  }

  return (
    <div ref={pageRef} style={{ background: PAGE_BG, minHeight: "100vh" }}>
      <PublicNav cartCount={cart.totalItems} onCartClick={() => setCartOpen(true)} />

      <Hero products={products} />

      <WhyUs />

      {/* Bestsellers */}
      {featured.length > 0 && (
        <section className="px-6 md:px-12 lg:px-20 py-14" style={{ background: PAGE_BG }}>
          <div className="max-w-400 mx-auto">
            <div className="text-center mb-8">
              <p
                className="font-heading font-semibold uppercase tracking-wide"
                style={{ fontSize: 11, color: "#E5528A", letterSpacing: "0.08em" }}
              >
                Top Picks
              </p>
              <h2
                className="font-heading font-bold mt-2"
                style={{ fontSize: 26, color: "#6B4226" }}
              >
                Crowd Favorites
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map(product => (
                <BestsellerCard key={product.id} product={product} {...cardProps(product)} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Full menu */}
      <section
        id="menu"
        className="px-6 md:px-12 lg:px-20 py-16"
        style={{ background: "#FFFDFB" }}
      >
        <div className="max-w-400 mx-auto">
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
              {products.map(product => (
                <ProductCard key={product.id} product={product} {...cardProps(product)} />
              ))}
            </div>
          )}
        </div>
      </section>

      <OrderCTA />

      {/* Footer / contact */}
      <footer
        id="contact"
        className="px-6 md:px-12 lg:px-20 py-12 text-center"
        style={{ background: "#FFFDFB", borderTop: "1px solid #F5EDE0" }}
      >
        <div className="flex items-center justify-center gap-2 mb-3">
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: 28,
              height: 28,
              background: "linear-gradient(135deg, #FF6FAE 0%, #E5528A 100%)",
            }}
          >
            <CakeSlice size={13} color="#FFFFFF" />
          </div>
          <p className="font-heading font-semibold" style={{ fontSize: 15, color: "#6B4226" }}>
            Rowszein's Delight
          </p>
        </div>
        <p
          className="font-body"
          style={{ fontSize: 13, color: "#9B6644", maxWidth: 420, margin: "0 auto" }}
        >
          Have a question or want to place a custom order? Send us a message on Facebook or
          visit us in store. We'd love to hear from you.
        </p>
        <p className="font-body mt-6" style={{ fontSize: 12, color: "#D1CEC7" }}>
          © {new Date().getFullYear()} Rowszein's Delight — Made with love in Lucena
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
