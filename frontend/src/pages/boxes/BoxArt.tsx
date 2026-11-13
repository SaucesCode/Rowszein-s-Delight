import type { CSSProperties } from "react";
import { flavorOf } from "@/lib/flavor";
import PatisserieDonut from "@/pages/shop/PatisserieDonut";
import "./box-art.css";

export interface BoxUnit {
  name: string;
  category?: string;
  image_url: string | null;
}

const COLUMNS: Record<number, number> = { 8: 4, 12: 4, 24: 6 };

/** A pink box seen from above: one slot per donut, filled in order. */
export default function BoxArt({ size, units, compact = false }: { size: number; units: BoxUnit[]; compact?: boolean }) {
  const columns = COLUMNS[size] ?? Math.ceil(Math.sqrt(size));
  return (
    <div
      className={`box-art${compact ? " is-compact" : ""}`}
      style={{ "--box-columns": columns } as CSSProperties}
      aria-hidden="true"
    >
      {Array.from({ length: size }, (_, index) => {
        const unit = units[index];
        return (
          <span key={index} className={`box-art-slot${unit ? " is-filled" : ""}`} style={{ "--slot-i": index } as CSSProperties}>
            {unit &&
              (unit.image_url ? (
                <img src={unit.image_url} alt="" />
              ) : (
                <PatisserieDonut flavor={flavorOf(unit.name, unit.category)} size={compact ? 22 : 44} />
              ))}
          </span>
        );
      })}
    </div>
  );
}
