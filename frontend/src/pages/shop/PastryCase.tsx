import { memo, useId, useRef, type CSSProperties } from "react";
import { Star } from "lucide-react";
import DonutArt from "@/components/DonutArt";
import { flavorOf, flavorTint } from "@/lib/flavor";
import { formatPeso } from "@/pages/dashboard/report-format";
import type { Product } from "@/types/product.types";
import type { Shelf } from "./shelves";
import { useShelfColumns } from "./useShelfColumns";

interface CaseItemProps {
  product: Product;
  inBox: number;
  order: number;
  onAdd: (product: Product, art: HTMLElement) => void;
}

/** One donut on a plate, with its price tag hanging below the glass. Tapping adds it to the box. */
const CaseItem = memo(function CaseItem({ product, inBox, order, onAdd }: CaseItemProps) {
  const descriptionId = useId();
  const flavor = flavorOf(product.name, product.category?.name);
  const label = `Add ${product.name}, ${formatPeso(Number(product.price))}${inBox ? `. ${inBox} in your box` : ""}`;

  return (
    <li className="case-item" style={{ "--i": Math.min(order, 8) } as CSSProperties}>
      <button
        type="button"
        className="case-item-button"
        aria-label={label}
        aria-describedby={product.description ? descriptionId : undefined}
        onClick={event => {
          const art = event.currentTarget.querySelector<HTMLElement>(".case-art");
          onAdd(product, art ?? event.currentTarget);
        }}
      >
        <span className="case-plate" aria-hidden="true">
          <span className="case-art" style={{ background: product.image_url ? undefined : flavorTint(flavor) }}>
            {product.image_url ? <img src={product.image_url} alt="" loading="lazy" width={96} height={96} /> : <DonutArt flavor={flavor} size={84} />}
          </span>
          {inBox > 0 && <span className="case-count num">{inBox}</span>}
        </span>
        <span className="case-glass" aria-hidden="true" />
        <span className="case-tag" aria-hidden="true">
          <span className="case-name">
            {product.name}
            {product.is_featured && "\u2060" /* keeps the star on the same line as the name */}
            {product.is_featured && (
              <span className="case-star" title="Best seller">
                <Star size={13} strokeWidth={2} />
              </span>
            )}
          </span>
          <span className="case-price num">{formatPeso(Number(product.price))}</span>
        </span>
      </button>
      {product.description && (
        <p id={descriptionId} className="case-description">{product.description}</p>
      )}
    </li>
  );
});

interface PastryCaseProps {
  shelves: Shelf[];
  quantityOf: (productId: number) => number;
  onAdd: (product: Product, art: HTMLElement) => void;
}

export default function PastryCase({ shelves, quantityOf, onAdd }: PastryCaseProps) {
  const ref = useRef<HTMLDivElement>(null);
  const columns = useShelfColumns(ref);
  let order = 0;
  return (
    <div ref={ref} className="case-shelves" style={{ "--cols": columns } as CSSProperties}>
      {shelves.map(shelf => (
        <section key={shelf.category.id} className="case-shelf" aria-labelledby={`shelf-${shelf.category.id}`}>
          <h2 id={`shelf-${shelf.category.id}`} className="case-shelf-title">{shelf.category.name}</h2>
          <ul className="case-row">
            {shelf.items.map(product => (
              <CaseItem
                key={product.id}
                product={product}
                inBox={quantityOf(product.id)}
                order={order++}
                onAdd={onAdd}
              />
            ))}
            {Array.from({ length: (columns - (shelf.items.length % columns)) % columns }, (_, index) => (
              <li key={`empty-${index}`} className="case-item is-empty" aria-hidden="true">
                <span className="case-glass" />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function PastryCaseSkeleton() {
  return (
    <div className="case-shelves" aria-hidden="true">
      <div className="case-shelf">
        <span className="skeleton block h-6 w-32" />
        <ul className="case-row">
          {Array.from({ length: 4 }, (_, index) => (
            <li key={index} className="case-item">
              <span className="case-item-button">
                <span className="case-plate"><span className="case-art skeleton" /></span>
                <span className="case-glass" />
                <span className="case-tag">
                  <span className="skeleton block h-4 w-24" />
                  <span className="skeleton block h-4 w-12" />
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
