import type { Ref } from "react";
import PatisserieDonut from "./PatisserieDonut";
import type { CartItem } from "@/hooks/useCart";
import { flavorOf } from "@/lib/flavor";
import { formatPeso } from "@/pages/dashboard/report-format";
import { boxUnits, orderSummary } from "./order";
import type { BoxLine } from "./useBoxOrder";
import { BoxIcon } from "./ShopIcons";

const WINDOW_SLOTS = 5;

interface OrderDockProps {
  boxes: BoxLine[];
  singles: CartItem[];
  singleCount: number;
  total: number;
  windowRef: Ref<HTMLSpanElement>;
  onReview: () => void;
}

/** The customer's order, docked at the bottom once something is in it. */
export default function OrderDock({ boxes, singles, singleCount, total, windowRef, onReview }: OrderDockProps) {
  const units = boxUnits(singles);
  const shown = units.slice(0, Math.max(0, WINDOW_SLOTS - boxes.length));
  const hidden = units.length - shown.length;

  return (
    <div className="box-dock" role="region" aria-label="Your order">
      <span ref={windowRef} className="box-window" aria-hidden="true">
        {boxes.slice(0, WINDOW_SLOTS).map(box => (
          <span key={box.key} className="box-window-box">
            <BoxIcon size={18} />
            <span className="num">{box.size}</span>
          </span>
        ))}
        {shown.map((unit, index) => (
          <span key={`${unit.product_id}-${index}`} className="box-window-donut">
            <PatisserieDonut flavor={flavorOf(unit.name)} size={30} />
          </span>
        ))}
        {hidden > 0 && <span className="box-window-more num">+{hidden}</span>}
      </span>
      <p className="box-dock-summary">
        <span>{orderSummary(boxes.length, singleCount, singles.some(item => item.partner))}</span>
        <strong className="num">{formatPeso(total)}</strong>
      </p>
      <button type="button" className="btn-primary box-dock-review" onClick={onReview}>
        Review order
      </button>
    </div>
  );
}
