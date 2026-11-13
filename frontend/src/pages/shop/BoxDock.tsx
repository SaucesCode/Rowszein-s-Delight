import type { Ref } from "react";
import PatisserieDonut from "./PatisserieDonut";
import type { CartItem } from "@/hooks/useCart";
import { flavorOf } from "@/lib/flavor";
import { formatPeso } from "@/pages/dashboard/report-format";
import { boxUnits } from "./order";

const WINDOW_SLOTS = 6;

interface BoxDockProps {
  items: CartItem[];
  totalItems: number;
  totalAmount: number;
  windowRef: Ref<HTMLSpanElement>;
  onReview: () => void;
}

/** The customer's box, docked at the bottom once it has a donut in it. */
export default function BoxDock({ items, totalItems, totalAmount, windowRef, onReview }: BoxDockProps) {
  const units = boxUnits(items);
  const shown = units.slice(0, WINDOW_SLOTS);
  const extra = units.length - shown.length;

  return (
    <div className="box-dock" role="region" aria-label="Your box">
      <span ref={windowRef} className="box-window" aria-hidden="true">
        {shown.map((unit, index) => (
          <span key={`${unit.product_id}-${index}`} className="box-window-donut">
            <PatisserieDonut flavor={flavorOf(unit.name)} size={30} />
          </span>
        ))}
        {extra > 0 && <span className="box-window-more num">+{extra}</span>}
      </span>
      <p className="box-dock-summary">
        <span>{totalItems === 1 ? "1 donut" : `${totalItems} donuts`}</span>
        <strong className="num">{formatPeso(totalAmount)}</strong>
      </p>
      <button type="button" className="btn-primary box-dock-review" onClick={onReview}>
        Review box
      </button>
    </div>
  );
}
