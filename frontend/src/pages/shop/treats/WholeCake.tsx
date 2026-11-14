import { useId } from "react";
import type { Flavor } from "@/lib/flavor";
import { paint, SPRINKLES } from "./paint";
import { Shadow, TreatPaint } from "./TreatPaint";

// Frosting drips hanging off the front rim of the top.
const DRIPS = "M-34 -4 Q-30 6 -26 2 Q-22 12 -17 4 Q-12 9 -7 5 Q-1 15 4 6 Q9 10 14 5 Q19 13 23 4 Q28 8 34 -4 Z";

/** A whole frosted cake on a plate: cream sides, flavour frosting with drips, a garnish on top. */
export default function WholeCake({ flavor, size = 96 }: { flavor: Flavor; size?: number }) {
  const id = useId();
  const p = paint(id);
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" aria-hidden="true" className="treat-art">
      <TreatPaint id={id} flavor={flavor} />
      <Shadow cy={34} rx={42} />
      <ellipse cx="0" cy="30" rx="44" ry="9" fill="#fffaf3" stroke="var(--color-gilt-soft)" strokeWidth="1" />
      <path d="M-34 -4 L-34 24 A34 9 0 0 0 34 24 L34 -4 Z" fill={p.cream} />
      <path d="M-34 14 A34 9 0 0 0 34 14" fill="none" stroke="#fffaf3" strokeWidth="1.4" opacity="0.7" />
      <path d={DRIPS} fill={p.glaze} />
      <ellipse cx="0" cy="-4" rx="34" ry="10" fill={p.glaze} />
      {[-20, -7, 7, 20].map((x, index) => (
        <g key={x}>
          <circle cx={x} cy={-6 + (index % 2) * 2} r="3.4" fill="#fffaf3" />
          <circle cx={x + 0.6} cy={-8 + (index % 2) * 2} r="1.8" fill={SPRINKLES[(index + 1) % SPRINKLES.length]} />
        </g>
      ))}
      <g className="treat-detail treat-detail-bob">
        <path d="M2 -16 Q4 -24 9 -27" fill="none" stroke="#5f7a4a" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="1" cy="-12" r="5" fill="#c8344f" />
        <circle cx="-0.8" cy="-13.8" r="1.4" fill="#fff" opacity="0.7" />
      </g>
      <path d="M-26 -9 A30 8 0 0 1 -6 -13" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}
