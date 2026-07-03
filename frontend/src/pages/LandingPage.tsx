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
  MessageCircle,
  Sparkles,
  Send,
  Mail,
} from "lucide-react";
import toast from "react-hot-toast";
import type { Product } from "@/types/product.types";

/* ─────────────────────────────────────────────
   CONFIG — replace with your real contact info
   ───────────────────────────────────────────── */
const SHOP_MESSENGER = "https://m.me/rowszeinsdelight";
const SHOP_EMAIL = "hello@rowszeinsdelight.com";

const PAGE_BG = "#FFF8F0";
const CARD_BG = "#FFFDFB";
const CARD_IMAGE_HEIGHT = 200;

const CATEGORIES: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "classic", label: "Classic" },
  { value: "fruity", label: "Fruity" },
  { value: "local", label: "Local Favorites" },
  { value: "premium", label: "Premium" },
  { value: "brownies", label: "Brownies & Bars" },
];

/* ─────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────── */
function formatPeso(value: number) {
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function CategoryFilter({
  active,
  onChange,
  counts,
}: {
  active: string;
  onChange: (val: string) => void;
  counts: Record<string, number>;
}) {
  return (
    <div
      className="flex flex-wrap justify-center gap-2 mb-8"
      role="group"
      aria-label="Filter menu by category"
    >
      {CATEGORIES.map(c => {
        const count = counts[c.value] ?? 0;
        if (c.value !== "all" && count === 0) return null;
        const isActive = active === c.value;
        return (
          <button
            key={c.value}
            onClick={() => onChange(c.value)}
            className="inline-flex items-center gap-2 font-heading font-bold transition-all"
            style={{
              height: 40,
              padding: "0 16px",
              borderRadius: 999,
              fontSize: 13,
              background: isActive
                ? "linear-gradient(135deg, #FF6FAE 0%, #E5528A 100%)"
                : "#FFFDFB",
              color: isActive ? "#FFFFFF" : "#6B4226",
              border: isActive ? "none" : "1px solid #E8E6E1",
              boxShadow: isActive ? "0 4px 14px rgba(255,111,174,0.35)" : "none",
            }}
            aria-pressed={isActive}
          >
            {c.label}
            <span
              className="font-body"
              style={{
                fontSize: 11,
                padding: "1px 6px",
                borderRadius: 999,
                background: isActive ? "rgba(255,255,255,0.25)" : "#FFF0F7",
                color: isActive ? "#FFFFFF" : "#9B6644",
              }}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────
   NAV
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
        background: "rgba(255, 253, 251, 0.88)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid #F5EDE0",
      }}
    >
      <div className="flex items-center justify-between px-6 md:px-12 lg:px-20 py-4">
        <a href="#top" className="flex items-center gap-2.5">
          <span
            className="flex items-center justify-center rounded-full font-heading font-bold text-lg"
            style={{
              width: 40,
              height: 40,
              background: "linear-gradient(135deg, #FF6FAE 0%, #E5528A 100%)",
              color: "#FFFFFF",
              boxShadow: "0 3px 10px rgba(255,111,174,0.35)",
            }}
          >
            R
          </span>
          <span className="font-heading font-bold" style={{ fontSize: 19, color: "#6B4226" }}>
            Rowszein's <span style={{ color: "#FF6FAE" }}>Delight</span>
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-7">
          {[
            ["#menu", "Menu"],
            ["#bestsellers", "Bestsellers"],
            ["#why", "Why Us"],
            ["#contact", "Contact"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="font-body font-semibold transition-colors"
              style={{ fontSize: 14, color: "#5A5650" }}
              onMouseOver={e => ((e.currentTarget as HTMLElement).style.color = "#E5528A")}
              onMouseOut={e => ((e.currentTarget as HTMLElement).style.color = "#5A5650")}
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={onCartClick}
            className="relative flex items-center justify-center rounded-full transition-transform"
            style={{
              width: 42,
              height: 42,
              background: "#FFF0F7",
            }}
            onMouseOver={e => ((e.currentTarget as HTMLElement).style.background = "#FFE3EF")}
            onMouseOut={e => ((e.currentTarget as HTMLElement).style.background = "#FFF0F7")}
            aria-label={`Open cart, ${cartCount} item${cartCount !== 1 ? "s" : ""}`}
          >
            <ShoppingBag size={18} style={{ color: "#6B4226" }} aria-hidden="true" />
            {cartCount > 0 && (
              <span
                className="absolute flex items-center justify-center rounded-full font-heading font-bold"
                style={{
                  top: -4,
                  right: -4,
                  minWidth: 19,
                  height: 19,
                  padding: "0 4px",
                  background: "#FF6FAE",
                  color: "#FFFFFF",
                  fontSize: 11,
                }}
                aria-hidden="true"
              >
                {cartCount}
              </span>
            )}
          </button>

          <Link
            to="/login"
            className="hidden sm:flex items-center justify-center rounded-full transition-opacity"
            style={{ width: 42, height: 42, opacity: 0.25 }}
            onMouseOver={e => ((e.currentTarget as HTMLElement).style.opacity = "0.6")}
            onMouseOut={e => ((e.currentTarget as HTMLElement).style.opacity = "0.25")}
            aria-label="Owner Login"
          >
            <CakeSlice size={16} style={{ color: "#6B4226" }} aria-hidden="true" />
          </Link>

          <button
            onClick={() => setMobileOpen(o => !o)}
            className="flex md:hidden items-center justify-center rounded-full"
            style={{ width: 42, height: 42, background: "#FFF0F7" }}
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

      {mobileOpen && (
        <div
          className="md:hidden flex flex-col gap-1 px-6 pb-5 pt-1 animate-fade-in"
          style={{ borderTop: "1px solid #F5EDE0", background: "#FFFDFB" }}
        >
          {[
            ["#menu", "Menu"],
            ["#bestsellers", "Bestsellers"],
            ["#why", "Why Us"],
            ["#contact", "Contact"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className="font-body font-semibold py-2"
              style={{ fontSize: 14, color: "#5A5650" }}
            >
              {label}
            </a>
          ))}
          <Link
            to="/login"
            onClick={() => setMobileOpen(false)}
            className="font-body mt-2"
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
   HERO
   ───────────────────────────────────────────── */
/* ─────────────────────────────────────────────
   HERO
   ───────────────────────────────────────────── */
function Hero({ heroProduct, totalCount }: { heroProduct: Product | null; totalCount: number }) {
  return (
    <section
      id="top"
      className="relative overflow-hidden px-6 md:px-12 lg:px-20 pt-14 pb-20 md:pt-20 md:pb-28"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute rounded-full"
          style={{
            width: 480,
            height: 480,
            top: -180,
            left: -160,
            background: "radial-gradient(circle, #FF6FAE 0%, transparent 70%)",
            opacity: 0.16,
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 380,
            height: 380,
            bottom: -160,
            right: -120,
            background: "radial-gradient(circle, #FFD6E7 0%, transparent 70%)",
            opacity: 0.5,
          }}
        />
      </div>

      <div className="relative max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        {/* Left — copy */}
        <div className="animate-slide-up">
          <span
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-body font-bold uppercase"
            style={{
              fontSize: 11,
              letterSpacing: "0.1em",
              background: "#FFFFFF",
              color: "#E5528A",
              border: "1px solid #FFD6E7",
            }}
          >
            <Sparkles size={13} aria-hidden="true" /> Baked fresh, every single day
          </span>

          <h1
            className="font-heading font-bold mt-5"
            style={{
              fontSize: "clamp(38px, 5.5vw, 60px)",
              color: "#6B4226",
              lineHeight: 0.98,
            }}
          >
            Soft, sweet,
            <br />
            <em style={{ color: "#FF6FAE", fontStyle: "italic" }}>homemade</em> donuts.
          </h1>

          <p
            className="font-body mt-5 max-w-md"
            style={{ fontSize: 16, color: "#7C7870", lineHeight: 1.75 }}
          >
            Hand-rolled donuts and desserts, made fresh each morning with real butter, real
            eggs, and a generous swirl of glaze. Pick your favorites — we'll do the rest.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-8">
            <a
              href="#menu"
              className="btn-primary"
              style={{ fontSize: 14, padding: "12px 26px", borderRadius: 999 }}
            >
              View Menu
            </a>
            <a
              href="#contact"
              className="btn-ghost"
              style={{ fontSize: 14, padding: "12px 26px", borderRadius: 999 }}
            >
              Contact Us
            </a>
          </div>

          <div
            className="flex items-center gap-6 mt-10 font-body"
            style={{ fontSize: 13, color: "#7C7870" }}
          >
            <div>
              <span
                className="font-heading font-bold"
                style={{ fontSize: 22, color: "#6B4226" }}
              >
                {totalCount || "9+"}
              </span>{" "}
              flavors
            </div>
            <div style={{ width: 1, height: 28, background: "#E8E6E1" }} />
            <div>
              <span
                className="font-heading font-bold"
                style={{ fontSize: 22, color: "#6B4226" }}
              >
                Daily
              </span>{" "}
              fresh batches
            </div>
          </div>
        </div>

        {/* Right — photo + floating badges */}
        <div
          className="relative flex items-center justify-center animate-fade-in"
          style={{ minHeight: 340 }}
        >
          {/* Sized exactly to the photo, so badges anchor to the photo's own
              corners rather than the wider column around it. */}
          <div
            className="relative"
            style={{ width: "min(340px, 78vw)", height: "min(340px, 78vw)" }}
          >
            <div
              className="absolute inset-0 rounded-[2.5rem] overflow-hidden flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #FF6FAE 0%, #FFD6E7 100%)",
                boxShadow: "0 28px 64px rgba(255,111,174,0.40)",
                transform: "rotate(2deg)",
              }}
            >
              {heroProduct?.image_url ? (
                <img
                  src={heroProduct.image_url}
                  alt={heroProduct.name}
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

            {/* "Made with love" — anchored to the photo's bottom-left corner */}
            <div
              className="absolute px-4 py-3 rounded-2xl flex items-center gap-3"
              style={{
                bottom: -18,
                left: -18,
                background: "#FFFFFF",
                boxShadow: "0 8px 24px rgba(107,66,38,0.16)",
                transform: "rotate(-3deg)",
                zIndex: 2,
              }}
            >
              <div
                className="flex items-center justify-center rounded-full flex-shrink-0"
                style={{ width: 36, height: 36, background: "#FFF0F7" }}
              >
                <Heart
                  size={16}
                  style={{ color: "#FF6FAE" }}
                  fill="#FF6FAE"
                  aria-hidden="true"
                />
              </div>
              <div style={{ whiteSpace: "nowrap" }}>
                <p
                  className="font-heading font-bold"
                  style={{ fontSize: 13, color: "#6B4226" }}
                >
                  Made with love
                </p>
                <p className="font-body" style={{ fontSize: 11, color: "#9B6644" }}>
                  Small batch, big flavor
                </p>
              </div>
            </div>

            {/* "from ₱X" — anchored to the photo's top-right corner */}
            {heroProduct && (
              <div
                className="absolute px-3 py-1.5 rounded-full font-heading font-bold"
                style={{
                  top: -14,
                  right: -14,
                  background: "#FF6FAE",
                  color: "#FFFFFF",
                  fontSize: 13,
                  transform: "rotate(6deg)",
                  boxShadow: "0 4px 14px rgba(255,111,174,0.4)",
                  whiteSpace: "nowrap",
                  zIndex: 2,
                }}
              >
                from {formatPeso(Number(heroProduct.price))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   WHY US
   ───────────────────────────────────────────── */
const WHY_US = [
  {
    icon: Sparkles,
    title: "Baked Fresh",
    body: "Every batch is hand-rolled and baked fresh each morning.",
  },
  {
    icon: Leaf,
    title: "Real Ingredients",
    body: "Butter, eggs, milk — no shortcuts, no artificial flavors.",
  },
  {
    icon: Heart,
    title: "Made with Love",
    body: "A family recipe, perfected and small-batched with care.",
  },
  {
    icon: MessageCircle,
    title: "Easy Ordering",
    body: "Build your order here, then message us to confirm.",
  },
];

function WhyUs() {
  return (
    <section
      id="why"
      className="px-6 md:px-12 lg:px-20 py-14"
      style={{ background: "#FFFDFB", scrollMarginTop: 72 }}
    >
      <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
        {WHY_US.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="rounded-3xl p-5"
            style={{ background: "#FFF8F0", border: "1px solid #F5EDE0" }}
          >
            <div
              className="flex items-center justify-center rounded-full mb-3"
              style={{ width: 44, height: 44, background: "#FFF0F7" }}
            >
              <Icon size={20} style={{ color: "#FF6FAE" }} aria-hidden="true" />
            </div>
            <p className="font-heading font-bold" style={{ fontSize: 16, color: "#6B4226" }}>
              {title}
            </p>
            <p
              className="font-body mt-1"
              style={{ fontSize: 12.5, color: "#9B6644", lineHeight: 1.6 }}
            >
              {body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   PRODUCT CARD — shared between bestsellers + menu
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
    <article
      className="group flex flex-col transition-all duration-300"
      style={{
        background: CARD_BG,
        border: "1px solid #F5EDE0",
        borderRadius: 24,
        overflow: "hidden",
      }}
      onMouseOver={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = "0 16px 36px rgba(107,66,38,0.16)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
      }}
      onMouseOut={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
      }}
    >
      {/* Image */}
      <div
        className="relative"
        style={{ height: 224, overflow: "hidden", background: "#FFF0F7" }}
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="absolute inset-0 w-full h-full transition-transform duration-500 group-hover:scale-105"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            <ImageOff
              size={28}
              style={{ color: "#FF6FAE", opacity: 0.4 }}
              aria-hidden="true"
            />
          </div>
        )}
        {product.is_featured && (
          <span
            className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-heading font-bold uppercase"
            style={{
              fontSize: 11,
              letterSpacing: "0.06em",
              background: "#FF6FAE",
              color: "#FFFFFF",
              boxShadow: "0 4px 14px rgba(255,111,174,0.4)",
            }}
          >
            <Sparkles size={12} aria-hidden="true" /> Bestseller
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5 flex flex-col flex-1">
        {/* Name, then price right underneath */}
        <div>
          <h3
            className="font-heading font-bold"
            style={{ fontSize: "clamp(15px, 4vw, 19px)", color: "#6B4226", lineHeight: 1.25 }}
          >
            {product.name}
          </h3>
          <div
            className="font-heading font-bold mt-1"
            style={{ fontSize: "clamp(14px, 3.6vw, 18px)", color: "#FF6FAE" }}
          >
            {formatPeso(Number(product.price))}
          </div>
        </div>

        {/* Description fills the remaining space */}
        <p
          className="font-body mt-1.5 flex-1 line-clamp-2"
          style={{ fontSize: 12.5, color: "#9B6644", lineHeight: 1.6 }}
        >
          {product.description || ""}
        </p>

        {/* Action — full-width button or full-width stepper */}
        <div className="mt-3 sm:mt-4">
          {quantity === 0 ? (
            <button
              onClick={() => {
                onAdd(product);
                toast.success(`${product.name} added to cart.`);
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 font-heading font-bold transition-colors"
              style={{
                height: 42,
                borderRadius: 999,
                background: "#6B4226",
                color: "#FFF8F0",
                fontSize: 13,
              }}
              onMouseOver={e =>
                ((e.currentTarget as HTMLElement).style.background = "#FF6FAE")
              }
              onMouseOut={e => ((e.currentTarget as HTMLElement).style.background = "#6B4226")}
            >
              <Plus size={14} aria-hidden="true" /> Add to cart
            </button>
          ) : (
            <div
              className="flex items-center justify-between rounded-full p-1.5"
              style={{ background: "#FFF0F7" }}
            >
              <button
                onClick={() => onDecrement(product.id)}
                className="flex items-center justify-center rounded-full flex-shrink-0"
                style={{
                  width: 30,
                  height: 30,
                  background: "#FFFDFB",
                  border: "1px solid #FFD6E7",
                }}
                aria-label={`Decrease ${product.name}`}
              >
                <Minus size={13} style={{ color: "#E5528A" }} />
              </button>
              <span
                className="font-heading font-bold"
                style={{ fontSize: 13, color: "#6B4226" }}
              >
                {quantity} in cart
              </span>
              <button
                onClick={() => onIncrement(product.id)}
                className="flex items-center justify-center rounded-full flex-shrink-0 transition-transform"
                style={{
                  width: 30,
                  height: 30,
                  background: "linear-gradient(135deg, #FF6FAE 0%, #E5528A 100%)",
                }}
                onMouseOver={e =>
                  ((e.currentTarget as HTMLElement).style.transform = "scale(1.08)")
                }
                onMouseOut={e =>
                  ((e.currentTarget as HTMLElement).style.transform = "scale(1)")
                }
                aria-label={`Increase ${product.name}`}
              >
                <Plus size={13} color="#FFFFFF" />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
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
          style={{ borderRadius: 24, overflow: "hidden", border: "1px solid #F5EDE0" }}
        >
          <div className="skeleton" style={{ height: CARD_IMAGE_HEIGHT, borderRadius: 0 }} />
          <div className="p-5 space-y-2">
            <div className="skeleton" style={{ height: 14, width: "70%", borderRadius: 5 }} />
            <div className="skeleton" style={{ height: 10, width: "50%", borderRadius: 5 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   ORDER CTA
   ───────────────────────────────────────────── */
function OrderCTA() {
  return (
    <section className="px-6 md:px-12 lg:px-20 py-16">
      <div
        className="max-w-6xl mx-auto rounded-[2rem] p-10 md:p-16 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #FF6FAE 0%, #E5528A 100%)" }}
      >
        <div
          aria-hidden="true"
          className="absolute -top-20 -right-20 rounded-full"
          style={{ width: 280, height: 280, background: "rgba(255,255,255,0.15)" }}
        />
        <div className="relative max-w-2xl">
          <span
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full font-body font-bold uppercase"
            style={{
              fontSize: 11,
              letterSpacing: "0.08em",
              background: "rgba(255,255,255,0.2)",
              color: "#FFFFFF",
            }}
          >
            <Sparkles size={13} aria-hidden="true" /> Bulk & Custom Orders
          </span>
          <h2
            className="font-heading font-bold mt-4"
            style={{ fontSize: "clamp(28px, 4vw, 44px)", color: "#FFFFFF", lineHeight: 1.1 }}
          >
            Birthdays, offices, special events?
          </h2>
          <p
            className="font-body mt-4"
            style={{ fontSize: 15, color: "rgba(255,255,255,0.9)", lineHeight: 1.7 }}
          >
            Message us a day ahead and we'll prepare your dozens — donut towers, themed boxes,
            dessert trays. Made fresh, just for your occasion.
          </p>
          <a
            href="#contact"
            className="inline-flex items-center gap-2 mt-7 font-heading font-bold transition-transform"
            style={{
              padding: "13px 28px",
              borderRadius: 999,
              background: "#FFFFFF",
              color: "#E5528A",
              fontSize: 14,
            }}
            onMouseOver={e =>
              ((e.currentTarget as HTMLElement).style.transform = "scale(1.03)")
            }
            onMouseOut={e => ((e.currentTarget as HTMLElement).style.transform = "scale(1)")}
          >
            <MessageCircle size={16} aria-hidden="true" /> Message Us
          </a>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   CONTACT FORM — client-side only, no backend
   ───────────────────────────────────────────── */
function ContactForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const validate = () => {
    if (!name.trim() || name.length > 100) return "Please enter your name.";
    if (!/^[+0-9()\-\s]{7,20}$/.test(phone.trim()))
      return "Please enter a valid phone number.";
    if (!message.trim() || message.length > 1000) return "Please enter a message.";
    return "";
  };

  const buildBody = () =>
    `Hi Rowszein's Delight!\n\nName: ${name}\nPhone: ${phone}\n\n${message}`;

  const sendMessenger = () => {
    const err = validate();
    if (err) return setError(err);
    setError("");
    navigator.clipboard?.writeText(buildBody()).catch(() => {});
    window.open(SHOP_MESSENGER, "_blank", "noopener,noreferrer");
  };

  const sendEmail = () => {
    const err = validate();
    if (err) return setError(err);
    setError("");
    const subject = encodeURIComponent(`Inquiry from ${name}`);
    const body = encodeURIComponent(buildBody());
    window.location.href = `mailto:${SHOP_EMAIL}?subject=${subject}&body=${body}`;
  };

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        sendMessenger();
      }}
      className="rounded-[2rem] p-6 md:p-9 space-y-4"
      style={{ background: CARD_BG, border: "1px solid #F5EDE0" }}
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="field-label">Your Name</label>
          <input
            type="text"
            required
            maxLength={100}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Juan Dela Cruz"
            className="field-input mt-1"
          />
        </div>
        <div>
          <label className="field-label">Phone Number</label>
          <input
            type="tel"
            required
            maxLength={20}
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+63 900 000 0000"
            className="field-input mt-1"
          />
        </div>
      </div>

      <div>
        <label className="field-label">Message</label>
        <textarea
          required
          maxLength={1000}
          rows={4}
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Hi! I'd like to order a dozen donuts for pickup on Saturday…"
          className="field-input mt-1"
          style={{ resize: "none" }}
        />
        <p className="field-helper text-right">{message.length}/1000</p>
      </div>

      {error && (
        <div className="px-4 py-2.5 rounded-xl" style={{ background: "#FEF2F2" }}>
          <p className="font-body font-semibold" style={{ fontSize: 13, color: "#B91C1C" }}>
            {error}
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-1">
        <button
          type="submit"
          className="btn-primary flex-1 justify-center"
          style={{ padding: "13px 20px", borderRadius: 999, fontSize: 14 }}
        >
          <Send size={15} aria-hidden="true" /> Send on Messenger
        </button>
        <button
          type="button"
          onClick={sendEmail}
          className="btn-ghost flex-1 justify-center"
          style={{ padding: "13px 20px", borderRadius: 999, fontSize: 14 }}
        >
          <Mail size={15} aria-hidden="true" /> Send by Email
        </button>
      </div>

      <p className="font-body text-center" style={{ fontSize: 11, color: "#A8A49B" }}>
        Opens Messenger or your email app — nothing is stored on this site.
      </p>
    </form>
  );
}

/* ─────────────────────────────────────────────
   PAGE
   ───────────────────────────────────────────── */
export default function LandingPage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const cart = useCart();
  const [categoryFilter, setCategoryFilter] = useState("all");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-products"],
    queryFn: () => productService.getAll(1),
  });

  const allProducts: Product[] = data?.data?.results ?? [];
  const products = allProducts.filter(p => p.is_available);
  const featured = products.filter(p => p.is_featured);

  const heroProduct = featured[0] ?? products[0] ?? null;

  const categoryCounts = products.reduce<Record<string, number>>((acc, p) => {
    acc.all = (acc.all ?? 0) + 1;
    acc[p.category] = (acc[p.category] ?? 0) + 1;
    return acc;
  }, {});

  const filteredProducts =
    categoryFilter === "all" ? products : products.filter(p => p.category === categoryFilter);

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
    <div
      ref={pageRef}
      className="landing-page"
      style={{ background: PAGE_BG, minHeight: "100vh" }}
    >
      <PublicNav cartCount={cart.totalItems} onCartClick={() => setCartOpen(true)} />

      <Hero heroProduct={heroProduct} totalCount={products.length} />
      <WhyUs />

      {/* Bestsellers */}
      {featured.length > 0 && (
        <section
          id="bestsellers"
          className="px-6 md:px-12 lg:px-20 py-14"
          style={{ background: PAGE_BG, scrollMarginTop: 72 }}
        >
          <div className="max-w-6xl mx-auto">
            <div className="flex items-end justify-between mb-8">
              <div>
                <p
                  className="font-body font-bold uppercase"
                  style={{ fontSize: 11, letterSpacing: "0.08em", color: "#E5528A" }}
                >
                  Crowd Favorites
                </p>
                <h2
                  className="font-heading font-bold mt-1"
                  style={{ fontSize: "clamp(26px, 3.5vw, 38px)", color: "#6B4226" }}
                >
                  Bestsellers
                </h2>
              </div>
              <a
                href="#menu"
                className="hidden sm:inline font-body font-bold"
                style={{ fontSize: 13, color: "#FF6FAE" }}
              >
                See full menu →
              </a>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map(product => (
                <ProductCard key={product.id} product={product} {...cardProps(product)} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Full menu */}
      <section
        id="menu"
        className="px-6 md:px-12 lg:px-20 py-16"
        style={{ background: "#FFFDFB", scrollMarginTop: 72 }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p
              className="font-body font-bold uppercase"
              style={{ fontSize: 11, letterSpacing: "0.08em", color: "#FF6FAE" }}
            >
              The Whole Menu
            </p>
            <h2
              className="font-heading font-bold mt-2"
              style={{ fontSize: "clamp(28px, 4vw, 42px)", color: "#6B4226" }}
            >
              Pick your sweet
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
            <>
              <CategoryFilter
                active={categoryFilter}
                onChange={setCategoryFilter}
                counts={categoryCounts}
              />

              {filteredProducts.length === 0 ? (
                <div className="card-surface p-10 text-center max-w-md mx-auto">
                  <p className="font-body" style={{ fontSize: 13, color: "#9B6644" }}>
                    No treats in this category yet — check back soon!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {filteredProducts.map(product => (
                    <ProductCard key={product.id} product={product} {...cardProps(product)} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <OrderCTA />

      {/* Contact */}
      <section
        id="contact"
        className="px-6 md:px-12 lg:px-20 py-16"
        style={{ scrollMarginTop: 72 }}
      >
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <p
              className="font-body font-bold uppercase"
              style={{ fontSize: 11, letterSpacing: "0.08em", color: "#FF6FAE" }}
            >
              Send Us a Message
            </p>
            <h2
              className="font-heading font-bold mt-2"
              style={{ fontSize: "clamp(26px, 3.5vw, 38px)", color: "#6B4226" }}
            >
              Get in touch
            </h2>
            <p className="font-body mt-3" style={{ fontSize: 14, color: "#9B6644" }}>
              Questions or a special request? Drop us a note — we'll reply on Messenger or by
              email.
            </p>
          </div>
          <ContactForm />
        </div>
      </section>

      {/* Footer */}
      <footer
        className="px-6 md:px-12 lg:px-20 py-12 text-center"
        style={{ background: "#FFFDFB", borderTop: "1px solid #F5EDE0" }}
      >
        <div className="flex items-center justify-center gap-2 mb-3">
          <span
            className="flex items-center justify-center rounded-full font-heading font-bold"
            style={{
              width: 28,
              height: 28,
              background: "linear-gradient(135deg, #FF6FAE 0%, #E5528A 100%)",
              color: "#FFFFFF",
              fontSize: 13,
            }}
          >
            R
          </span>
          <p className="font-heading font-bold" style={{ fontSize: 15, color: "#6B4226" }}>
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
          © {new Date().getFullYear()} Rowszein's Delight — Made with love
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
