import { useId } from "react";
import type { Flavor } from "@/lib/flavor";
import { paint } from "./paint";
import { Shadow, TreatPaint } from "./TreatPaint";

/** A glossy loaf with scored top and a light flavour glaze; a wisp of steam lifts on hover. */
export default function Bread({ flavor, size = 96 }: { flavor: Flavor; size?: number }) {
  const id = useId();
  const p = paint(id);
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" aria-hidden="true" className="treat-art">
      <TreatPaint id={id} flavor={flavor} />
      <Shadow cy={32} rx={42} />
      <path d="M-40 26 L-40 4 Q-40 -20 -14 -24 Q0 -27 14 -24 Q40 -20 40 4 L40 26 Q0 32 -40 26 Z" fill={p.crust} />
      <path d="M-36 0 Q-30 -16 -12 -20 Q0 -22 12 -20 Q30 -16 36 0" fill="none" stroke={p.glaze} strokeWidth="4" strokeLinecap="round" opacity="0.75" />
      {[-18, -2, 14].map(x => (
        <path key={x} d={`M${x - 6} -6 Q${x} -16 ${x + 8} -14`} fill="none" stroke="#f3d29b" strokeWidth="3" strokeLinecap="round" />
      ))}
      <path d="M-30 -8 Q-24 -18 -10 -21" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" opacity="0.5" />
      <g className="treat-detail treat-detail-steam" fill="none" stroke="#fffaf3" strokeWidth="2" strokeLinecap="round" opacity="0">
        <path d="M-8 -30 Q-12 -36 -8 -42" />
        <path d="M6 -30 Q2 -37 6 -44" />
      </g>
    </svg>
  );
}
