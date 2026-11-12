import { MoreVertical, Copy, Trash2, Eye, EyeOff } from "lucide-react";
import type { Product } from "@/types/product.types";
import DropdownMenu from "@/components/DropdownMenu";
import { StarIcon, CheckIcon, AlertTriangleIcon } from "@/pages/owner-home/OwnerHomeIcons";

interface ProductCardProps {
  product: Product;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggleAvailability: () => void;
  onDelete: () => void;
  togglePending?: boolean;
}

function getDonutVisualTheme(name: string, categoryName: string) {
  const n = (name + " " + categoryName).toLowerCase();
  if (n.includes("choco") || n.includes("cocoa") || n.includes("velvet")) {
    return {
      bg: "linear-gradient(135deg, #F5EDEA 0%, #E8DBD6 100%)",
      dough: "#5A3825",
      glaze: "#3D2415",
      accent: "#F4A261",
      sprinkles: false,
    };
  }
  if (n.includes("matcha") || n.includes("green tea")) {
    return {
      bg: "linear-gradient(135deg, #F5FBEF 0%, #E5F3D8 100%)",
      dough: "#E8B880",
      glaze: "#7BA05B",
      accent: "#5D7C42",
      sprinkles: false,
    };
  }
  if (n.includes("ube") || n.includes("taro") || n.includes("local")) {
    return {
      bg: "linear-gradient(135deg, #FAF5FF 0%, #F3E8FF 100%)",
      dough: "#E8B880",
      glaze: "#8B5CF6",
      accent: "#DDD6FE",
      sprinkles: true,
    };
  }
  if (n.includes("classic") || n.includes("cinnamon") || n.includes("sugar")) {
    return {
      bg: "linear-gradient(135deg, #FFF3E6 0%, #FFE6CC 100%)",
      dough: "#EDAD6C",
      glaze: "#FDE4B8",
      accent: "#D98A3C",
      sprinkles: false,
    };
  }
  // Default wild strawberry / specialty glaze
  return {
    bg: "linear-gradient(135deg, #FFE5EE 0%, #FFD1DF 100%)",
    dough: "#F8C08A",
    glaze: "#FF8BB5",
    accent: "#E07936",
    sprinkles: true,
  };
}

export default function ProductCard({
  product,
  onEdit,
  onDuplicate,
  onToggleAvailability,
  onDelete,
  togglePending,
}: ProductCardProps) {
  const categoryLabel = product.category?.name ?? "Donut";
  const formattedPrice = Number(product.price).toFixed(2);
  const isAvailable = product.is_available && !product.is_out_of_stock;
  const theme = getDonutVisualTheme(product.name, categoryLabel);

  return (
    <article
      className="group/card flex flex-col bg-white transition-all duration-200"
      style={{
        border: "1px solid var(--ol-card-border, #F5D5E2)",
        borderRadius: "16px",
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(43, 24, 32, 0.04), 0 2px 6px rgba(199, 37, 94, 0.03)",
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = "var(--ol-card-border-hover, #EEB3CB)";
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(199, 37, 94, 0.08)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = "var(--ol-card-border, #F5D5E2)";
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(43, 24, 32, 0.04), 0 2px 6px rgba(199, 37, 94, 0.03)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
      aria-label={`${product.name}, ${categoryLabel}, ₱${formattedPrice}`}
    >
      {/* ─── Visual Header: Image or Signature Glazed Artwork ─── */}
      <div
        className="relative overflow-hidden flex items-center justify-center"
        style={{
          height: 160,
          background: theme.bg,
        }}
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105"
          />
        ) : (
          <div className="flex items-center justify-center transition-transform duration-300 group-hover/card:scale-105 group-hover/card:rotate-2">
            <svg width="88" height="88" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <circle cx="24" cy="24" r="19" fill={theme.dough} />
              <circle cx="24" cy="24" r="18" fill={theme.glaze} />
              <path
                d="M10 21c2 0 3 4 5 4s3-4 5-4 3 4 5 4 3-4 5-4 3 4 5 4"
                stroke="#FFFFFF"
                strokeWidth="2.5"
                strokeLinecap="round"
                opacity="0.8"
              />
              <circle cx="24" cy="24" r="7" fill={theme.dough} opacity="0.3" />
              <circle cx="24" cy="24" r="7" stroke={theme.accent} strokeWidth="1.5" />
              {theme.sprinkles && (
                <>
                  <rect x="17" y="14" width="4" height="1.5" rx="0.75" fill="#FFFFFF" transform="rotate(25 17 14)" />
                  <rect x="27" y="15" width="4" height="1.5" rx="0.75" fill="#FFE600" transform="rotate(-30 27 15)" />
                  <rect x="31" y="25" width="4" height="1.5" rx="0.75" fill="#FFFFFF" transform="rotate(45 31 25)" />
                  <rect x="15" y="27" width="4" height="1.5" rx="0.75" fill="#70D6FF" transform="rotate(10 15 27)" />
                </>
              )}
            </svg>
          </div>
        )}

        {/* Top-Left: Status Pill */}
        <div className="absolute top-2.5 left-2.5 z-10">
          {product.is_out_of_stock ? (
            <span
              className="inline-flex items-center gap-1 font-semibold rounded-full text-xs"
              style={{
                background: "#FEF2F2",
                color: "#B91C1C",
                border: "1px solid #FECACA",
                padding: "3px 8px",
              }}
            >
              <AlertTriangleIcon width={11} height={11} />
              <span>Sold Out</span>
            </span>
          ) : !product.is_available ? (
            <span
              className="inline-flex items-center gap-1 font-semibold rounded-full text-xs"
              style={{
                background: "#FEF3EB",
                color: "#C2410C",
                border: "1px solid #FCD0B3",
                padding: "3px 8px",
              }}
            >
              <EyeOff size={11} />
              <span>Hidden</span>
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 font-semibold rounded-full text-xs"
              style={{
                background: "#E6F7F2",
                color: "#0F766E",
                border: "1px solid #99E2D0",
                padding: "3px 8px",
              }}
            >
              <CheckIcon width={10} height={10} />
              <span>Available</span>
            </span>
          )}
        </div>

        {/* Top-Right: Bestseller Star Badge */}
        {product.is_featured && (
          <div
            className="absolute top-2.5 right-2.5 z-10 flex items-center justify-center rounded-full bg-white shadow-sm"
            style={{ width: 28, height: 28, color: "#C7255E" }}
            title="Bestseller Donut"
          >
            <StarIcon width={14} height={14} aria-hidden="true" />
          </div>
        )}
      </div>

      {/* ─── Card Body ─── */}
      <div className="p-4 flex flex-col flex-1">
        <span
          className="text-xs font-bold uppercase tracking-wider mb-1"
          style={{ color: "#C7255E", letterSpacing: "0.06em", fontSize: "0.6875rem" }}
        >
          {categoryLabel}
        </span>

        <h3
          className="font-bold text-base truncate mb-1"
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            color: "#2B1820",
            letterSpacing: "-0.015em",
          }}
          title={product.name}
        >
          {product.name}
        </h3>

        <p
          className="text-xs line-clamp-2 mb-3 flex-1"
          style={{ color: "#7E6570", lineHeight: 1.45, minHeight: "2.8em" }}
        >
          {product.description || "Freshly baked artisan donut crafted daily with premium ingredients."}
        </p>

        <div
          className="flex items-baseline justify-between pt-3 mt-auto"
          style={{ borderTop: "1px solid #FDF0F5" }}
        >
          <span
            className="font-extrabold text-lg"
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              color: "#C7255E",
              letterSpacing: "-0.02em",
            }}
          >
            ₱{formattedPrice}
          </span>
          <span className="text-xs text-gray-400 font-medium">Daily Fresh</span>
        </div>
      </div>

      {/* ─── Card Footer: Instant Toggle + Actions ─── */}
      <div
        className="px-4 py-3 flex items-center justify-between gap-2"
        style={{ background: "#FFFDFE", borderTop: "1px solid #F8EBF1" }}
      >
        <button
          type="button"
          onClick={onToggleAvailability}
          disabled={togglePending}
          className="inline-flex items-center gap-2 cursor-pointer border-none bg-transparent p-0 text-left"
          aria-label={product.is_available ? "Hide from customer storefront" : "Make available in customer storefront"}
        >
          <div
            className="relative rounded-full transition-colors duration-200"
            style={{
              width: 34,
              height: 20,
              backgroundColor: isAvailable ? "#C7255E" : "#E5E7EB",
              opacity: togglePending ? 0.6 : 1,
            }}
          >
            <span
              className="absolute rounded-full bg-white shadow-sm transition-transform duration-200"
              style={{
                width: 14,
                height: 14,
                top: 3,
                left: 3,
                transform: isAvailable ? "translateX(14px)" : "translateX(0)",
              }}
            />
          </div>
          <span
            className="text-xs font-semibold"
            style={{ color: isAvailable ? "#2B1820" : "#7E6570", fontSize: "0.75rem" }}
          >
            {isAvailable ? "In Shop" : "Hidden"}
          </span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onEdit}
            className="px-3 py-1 rounded-full text-xs font-bold transition-colors"
            style={{
              background: "#FFE6F0",
              color: "#C7255E",
              border: "1px solid transparent",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = "#C7255E";
              e.currentTarget.style.color = "#FFFFFF";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "#FFE6F0";
              e.currentTarget.style.color = "#C7255E";
            }}
          >
            Edit
          </button>

          <DropdownMenu
            width={180}
            trigger={({ open }) => (
              <button
                type="button"
                className="w-7 h-7 flex items-center justify-center rounded-full transition-colors"
                style={{
                  background: open ? "#FFE6F0" : "transparent",
                  color: open ? "#C7255E" : "#7E6570",
                }}
                aria-label={`More actions for ${product.name}`}
                aria-haspopup="menu"
                aria-expanded={open}
              >
                <MoreVertical size={14} aria-hidden="true" />
              </button>
            )}
          >
            <button
              onClick={onDuplicate}
              className="flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 transition-colors hover:bg-[#FFF0F5]"
              style={{ fontSize: 13, color: "#2B1820" }}
            >
              <Copy size={14} style={{ color: "#C7255E" }} aria-hidden="true" />
              Duplicate
            </button>
            <button
              onClick={onToggleAvailability}
              disabled={togglePending}
              className="flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 transition-colors hover:bg-[#FFF0F5]"
              style={{ fontSize: 13, color: "#2B1820", borderTop: "1px solid #F8EBF1" }}
            >
              {product.is_available ? (
                <EyeOff size={14} style={{ color: "#7E6570" }} aria-hidden="true" />
              ) : (
                <Eye size={14} style={{ color: "#C7255E" }} aria-hidden="true" />
              )}
              {product.is_available ? "Hide from shop" : "Show in shop"}
            </button>
            <button
              onClick={onDelete}
              className="flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 transition-colors hover:bg-[#FEF2F2]"
              style={{ fontSize: 13, color: "#DC2626", borderTop: "1px solid #F8EBF1" }}
            >
              <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
              Delete permanently
            </button>
          </DropdownMenu>
        </div>
      </div>
    </article>
  );
}
