import type { Ingredient } from "@/types/ingredient.types";
import { stockLevel, stockStatus } from "@/lib/stockStatus";

/** Compact stock level with a notch where the ingredient needs restocking. */
export default function LevelBar({ ingredient }: { ingredient: Pick<Ingredient, "quantity" | "minimum_stock" | "is_low_stock"> }) {
  const level = stockLevel(Number(ingredient.quantity), Number(ingredient.minimum_stock));
  return (
    <span className={`level-bar is-${stockStatus(ingredient)}`} aria-hidden="true">
      <span className="level-bar-fill" style={{ transform: `scaleX(${level.fill})` }} />
      {level.mark !== null && <span className="level-bar-mark" style={{ left: `${level.mark * 100}%` }} />}
    </span>
  );
}
