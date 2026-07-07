import { ImageOff, Star, MoreVertical, Pencil, Copy, Eye, EyeOff, Trash2 } from "lucide-react";
import type { Product } from "@/types/product.types";
import StatusBadge, { type ProductStatus } from "@/components/StatusBadge";
import DropdownMenu from "@/components/DropdownMenu";

function resolveStatus(product: Product): ProductStatus {
  if (product.is_out_of_stock) return "out_of_stock";
  if (!product.is_available) return "hidden";
  if (product.is_seasonal) return "seasonal";
  return "available";
}

interface ProductCardProps {
  product: Product;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggleAvailability: () => void;
  onDelete: () => void;
  togglePending?: boolean;
}

export default function ProductCard({
  product,
  onEdit,
  onDuplicate,
  onToggleAvailability,
  onDelete,
  togglePending,
}: ProductCardProps) {
  const status = resolveStatus(product);
  const categoryLabel = product.category?.name ?? "Uncategorized";
  const formattedPrice = Number(product.price).toFixed(2);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit();
        }
      }}
      className="group/card flex flex-col cursor-pointer transition-all duration-200"
      style={{
        background: "#FFFDFB",
        border: "1px solid #E8E6E1",
        borderRadius: 16,
        overflow: "hidden",
      }}
      onMouseOver={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "#FFD6E7";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
      }}
      onMouseOut={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "#E8E6E1";
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
      }}
      aria-label={`${product.name}, ${categoryLabel}, ₱${formattedPrice}`}
    >
      {/* Image */}
      <div className="relative" style={{ aspectRatio: "4 / 3", background: "#FFF0F7" }}>
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            <ImageOff
              size={26}
              style={{ color: "#FF6FAE", opacity: 0.4 }}
              aria-hidden="true"
            />
          </div>
        )}

        <div className="absolute top-2.5 left-2.5">
          <StatusBadge status={status} />
        </div>

        {product.is_featured && (
          <div
            className="absolute top-2.5 right-2.5 flex items-center justify-center rounded-full"
            style={{ width: 26, height: 26, background: "#FFFDFB" }}
            title="Featured product"
          >
            <Star size={13} style={{ color: "#FF6FAE" }} fill="#FF6FAE" aria-hidden="true" />
          </div>
        )}

        {/* Quick actions — hover-reveal on desktop, always visible on touch */}
        <div
          className="absolute bottom-2.5 right-2.5 opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100 sm:group-focus-within/card:opacity-100 transition-opacity"
          onClick={e => e.stopPropagation()}
        >
          <DropdownMenu
            width={180}
            trigger={({ open }) => (
              <button
                className="flex items-center justify-center rounded-full transition-colors"
                style={{
                  width: 30,
                  height: 30,
                  background: open ? "#6B4226" : "rgba(255,253,251,0.92)",
                }}
                aria-label={`More actions for ${product.name}`}
                aria-haspopup="menu"
                aria-expanded={open}
              >
                <MoreVertical
                  size={15}
                  strokeWidth={2}
                  style={{ color: open ? "#FFFDFB" : "#6B4226" }}
                  aria-hidden="true"
                />
              </button>
            )}
          >
            <button
              onClick={onEdit}
              className="flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 transition-colors hover:bg-[#FFF8F0]"
              style={{ fontSize: 13, color: "#6B4226" }}
            >
              <Pencil
                size={14}
                strokeWidth={2}
                style={{ color: "#9B6644" }}
                aria-hidden="true"
              />
              Edit product
            </button>
            <button
              onClick={onDuplicate}
              className="flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 transition-colors hover:bg-[#FFF8F0]"
              style={{ fontSize: 13, color: "#6B4226" }}
            >
              <Copy
                size={14}
                strokeWidth={2}
                style={{ color: "#9B6644" }}
                aria-hidden="true"
              />
              Duplicate
            </button>
            <button
              onClick={onToggleAvailability}
              disabled={togglePending}
              className="flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 transition-colors hover:bg-[#FFF8F0]"
              style={{ fontSize: 13, color: "#6B4226", borderTop: "1px solid #F5EDE0" }}
            >
              {product.is_available ? (
                <EyeOff
                  size={14}
                  strokeWidth={2}
                  style={{ color: "#9B6644" }}
                  aria-hidden="true"
                />
              ) : (
                <Eye
                  size={14}
                  strokeWidth={2}
                  style={{ color: "#9B6644" }}
                  aria-hidden="true"
                />
              )}
              {product.is_available ? "Hide from shop" : "Show in shop"}
            </button>
            <button
              onClick={onDelete}
              className="flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 transition-colors hover:bg-[#FEF2F2]"
              style={{ fontSize: 13, color: "#DC2626", borderTop: "1px solid #F5EDE0" }}
            >
              <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
              Delete permanently
            </button>
          </DropdownMenu>
        </div>
      </div>

      {/* Content */}
      <div className="p-3.5 flex flex-col gap-1">
        <p
          className="font-body"
          style={{
            fontSize: 11,
            color: "#B8A98D",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {categoryLabel}
        </p>
        <div className="flex items-start justify-between gap-2">
          <h3
            className="font-heading font-semibold truncate"
            style={{ fontSize: 14.5, color: "#6B4226" }}
          >
            {product.name}
          </h3>
          <span
            className="font-heading font-semibold flex-shrink-0"
            style={{ fontSize: 14.5, color: "#FF6FAE" }}
          >
            ₱{formattedPrice}
          </span>
        </div>
      </div>
    </div>
  );
}
