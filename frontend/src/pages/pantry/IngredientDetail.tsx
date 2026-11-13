import { Pencil } from "lucide-react";
import type { Ingredient } from "@/types/ingredient.types";
import { formatAmount, STOCK_STATUS_LABEL, stockLevel, stockStatus, unitLabel } from "@/lib/stockStatus";
import { formatPeso } from "@/pages/dashboard/report-format";
import JarGauge from "./JarGauge";
import { StockFoot, StockForm } from "./StockUpdater";
import { useStockUpdate } from "./useStockUpdate";

const changedFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Manila",
});

function Detail({ ingredient, headingId, onEdit }: { ingredient: Ingredient; headingId: string; onEdit: () => void }) {
  const stock = useStockUpdate(ingredient);
  const quantity = Number(ingredient.quantity);
  const minimum = Number(ingredient.minimum_stock);
  const status = stockStatus(ingredient);
  const level = stockLevel(quantity, minimum);
  const where = [ingredient.category_display, ingredient.supplier && `from ${ingredient.supplier}`]
    .filter(Boolean)
    .join(", ");

  return (
    <article className="pantry-detail" aria-labelledby={headingId}>
      <div className="pantry-detail-scroll">
        <header className="pantry-detail-head">
          <div className="min-w-0">
            <h2 id={headingId} className="pantry-detail-name">{ingredient.name}</h2>
            {where && <p className="pantry-detail-where">{where}</p>}
          </div>
          <button type="button" className="btn-secondary" onClick={onEdit}>
            <Pencil size={16} aria-hidden="true" />
            Edit
          </button>
        </header>

        <section className="pantry-level" aria-label="Stock level">
          <JarGauge fill={level.fill} mark={level.mark} status={status} size={84} />
          <div className="pantry-level-text">
            <p className={`pantry-status is-${status}`}>{STOCK_STATUS_LABEL[status]}</p>
            <p className="pantry-level-amount num">
              {quantity.toLocaleString("en-PH", { maximumFractionDigits: 3 })}
              <span>{unitLabel(ingredient.unit)}</span>
            </p>
            <p className="pantry-level-note">
              {minimum > 0
                ? `Restock when it drops to ${formatAmount(minimum, ingredient.unit)}.`
                : "No restock level set. Add one in Edit to get low-stock alerts."}
            </p>
          </div>
        </section>

        <StockForm state={stock} />

        <dl className="pantry-facts">
          <div>
            <dt>Cost per {unitLabel(ingredient.unit)}</dt>
            <dd className="num">{formatPeso(Number(ingredient.cost_per_unit))}</dd>
          </div>
          <div>
            <dt>Worth on the shelf</dt>
            <dd className="num">{formatPeso(quantity * Number(ingredient.cost_per_unit))}</dd>
          </div>
          <div>
            <dt>Last changed</dt>
            <dd>{changedFormatter.format(new Date(ingredient.updated_at))}</dd>
          </div>
        </dl>

        {ingredient.notes && <p className="pantry-notes">{ingredient.notes}</p>}
      </div>
      <StockFoot state={stock} />
    </article>
  );
}

/** Keyed by ingredient so a half-typed amount never carries over to a different ingredient. */
export default function IngredientDetail(props: { ingredient: Ingredient; headingId: string; onEdit: () => void }) {
  return <Detail key={props.ingredient.id} {...props} />;
}
