import { memo, useId, useRef, type CSSProperties } from "react";
import PatisserieDonut from "./PatisserieDonut";
import { flavorOf } from "@/lib/flavor";
import { formatPeso } from "@/pages/dashboard/report-format";
import type { Product } from "@/types/product.types";
import { Doily, DonutName } from "./ShopIcons";
import type { Shelf } from "./shelves";
import { canGoInBox } from "./useBoxOrder";
import { useShelfColumns } from "./useShelfColumns";

interface CaseItemProps {
  product: Product;
  /** True while the customer is filling a box: tapping puts the donut in the box. */
  filling: boolean;
  inBox: number;
  order: number;
  onAdd: (product: Product, art: HTMLElement) => void;
}

/** One donut on a plate, with its price tag hanging below the glass. Tapping adds it to the box. */
const CaseItem = memo(function CaseItem({ product, filling, inBox, order, onAdd }: CaseItemProps) {
  const descriptionId = useId();
  const flavor = flavorOf(product.name, product.category?.name);
  const extra = Number(product.box_extra ?? 0);
  const maker = product.partner ? ` by ${product.partner.name}` : "";
  const details = `${maker}${product.is_featured ? ", best seller" : ""}, ${formatPeso(Number(product.price))}`;
  const notInBox = filling && !canGoInBox(product);
  const label = notInBox
    ? `${product.name}${maker}, not in boxes. Finish your box first, then add it to your order.`
    : filling
      ? `Put ${product.name} in your box${extra > 0 ? `, adds ${formatPeso(extra)}` : ""}`
      : `Add ${product.name}${details}${inBox ? `. ${inBox} in your order` : ""}`;

  return (
    <li className={`case-item${notInBox ? " is-not-in-box" : ""}`} style={{ "--i": Math.min(order, 8) } as CSSProperties}>
      <button
        type="button"
        className="case-item-button"
        aria-label={label}
        aria-disabled={notInBox || undefined}
        aria-describedby={product.description ? descriptionId : undefined}
        onClick={event => {
          const art = event.currentTarget.querySelector<HTMLElement>(".case-art");
          onAdd(product, art ?? event.currentTarget);
        }}
      >
        <span className="case-plate" aria-hidden="true">
          <Doily className="case-doily" />
          <span className="case-art">
            {product.image_url ? <img src={product.image_url} alt="" loading="lazy" width={96} height={96} /> : <PatisserieDonut flavor={flavor} size={84} />}
          </span>
          {inBox > 0 && <span className="case-count num">{inBox}</span>}
        </span>
        <span className="case-glass" aria-hidden="true" />
        <span className="case-tag" aria-hidden="true">
          <span className="case-name">
            <DonutName name={product.name} bestSeller={product.is_featured} />
          </span>
          <span className="case-price num">{formatPeso(Number(product.price))}</span>
          {extra > 0 && <span className="case-extra num">+{formatPeso(extra)} in a box</span>}
          {notInBox && <span className="case-extra">Not in boxes</span>}
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
  filling: boolean;
  quantityOf: (productId: number) => number;
  onAdd: (product: Product, art: HTMLElement) => void;
}

export default function PastryCase({ shelves, filling, quantityOf, onAdd }: PastryCaseProps) {
  const ref = useRef<HTMLDivElement>(null);
  const columns = useShelfColumns(ref);
  let order = 0;
  return (
    <div ref={ref} className="case-shelves" style={{ "--cols": columns } as CSSProperties}>
      {shelves.map(shelf => (
        <section key={shelf.id} className={`case-shelf${shelf.partner ? " is-partner" : ""}`} aria-labelledby={`shelf-${shelf.id}`}>
          <h2 id={`shelf-${shelf.id}`} className="case-shelf-title">{shelf.title}</h2>
          {shelf.blurb && <p className="case-shelf-blurb">{shelf.blurb}</p>}
          <ul className="case-row">
            {shelf.items.map(product => (
              <CaseItem
                key={product.id}
                product={product}
                filling={filling}
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
