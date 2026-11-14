import { useId } from "react";
import type { Flavor } from "@/lib/flavor";
import { paint, scatter } from "./paint";
import { Shadow, TreatPaint } from "./TreatPaint";

const PLEATS = [-16, -9, -2, 5, 12];

/** A muffin: paper liner and a golden domed top studded with berries or chips in the flavour colour. */
export default function Muffin({ flavor, size = 96 }: { flavor: Flavor; size?: number }) {
  const id = useId();
  const p = paint(id);
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" aria-hidden="true" className="treat-art">
      <TreatPaint id={id} flavor={flavor} />
      <Shadow cy={38} rx={28} />
      <path d="M-24 10 L24 10 L18 38 L-18 38 Z" fill="#f3e3cf" />
      {PLEATS.map(x => (
        <path key={x} d={`M${x * 1.2} 10 L${x * 0.9} 38`} stroke="#d9bfa0" strokeWidth="1.4" />
      ))}
      {/* Domed top spilling over the liner. */}
      <path d="M-31 12 Q-36 -2 -24 -12 Q-12 -26 4 -24 Q22 -24 30 -10 Q37 2 31 12 Q0 18 -31 12 Z" fill={p.crust} />
      {scatter(9, 0, -4, 24, 12).map((point, index) => (
        <circle key={index} cx={point.x} cy={point.y} r={index % 3 === 0 ? 3.2 : 2.4} fill={p.glaze} />
      ))}
      {scatter(12, 2, -2, 26, 12).map((point, index) => (
        <circle key={`c${index}`} cx={point.x + 3} cy={point.y - 2} r="0.8" fill="#f7d9a6" opacity="0.8" />
      ))}
      <path d="M-22 -10 Q-12 -20 2 -21" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" opacity="0.45" />
    </svg>
  );
}
