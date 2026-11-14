import type { Ref } from "react";
import { BrandDonutIcon } from "@/pages/owner-home/OwnerHomeIcons";
import type { CartItem } from "@/hooks/useCart";
import { formatPeso } from "@/pages/dashboard/report-format";
import { formatOrderTime } from "./order";
import { boxPrice, describeBox, type BoxLine } from "./useBoxOrder";

interface OrderCardProps {
  cardRef: Ref<HTMLDivElement>;
  boxes: BoxLine[];
  singles: CartItem[];
  total: number;
  name: string;
  number: string;
  madeAt: Date;
}

/** The picture the customer saves and sends on Messenger. Rendered off screen only while saving. */
export default function OrderCard({ cardRef, boxes, singles, total, name, number, madeAt }: OrderCardProps) {
  return (
    <div className="order-card-stage" aria-hidden="true">
      <div ref={cardRef} className="order-card">
        <div className="order-card-brand">
          <BrandDonutIcon width={26} height={26} />
          <span>Rowszein's Delight</span>
        </div>
        <p className="order-card-title">Order for {name}</p>
        <p className="order-card-meta">{formatOrderTime(madeAt)} · Card {number}</p>
        <ul className="order-card-lines">
          {boxes.map(box => (
            <li key={box.key} className="order-card-box">
              <span>
                {box.name}
                <small>{describeBox(box.donuts)}</small>
              </span>
              <span className="num">{formatPeso(boxPrice(box))}</span>
            </li>
          ))}
          {singles.map(item => (
            <li key={item.product_id}>
              <span>{item.quantity} × {item.name}{item.partner ? ` (by ${item.partner})` : ""}</span>
              <span className="num">{formatPeso(item.price * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <p className="order-card-total">
          <span>Total</span>
          <strong className="num">{formatPeso(total)}</strong>
        </p>
        <p className="order-card-note">
          Not confirmed yet. Send this card to Rowszein's Delight on Messenger and we'll reply to confirm.
        </p>
      </div>
    </div>
  );
}
