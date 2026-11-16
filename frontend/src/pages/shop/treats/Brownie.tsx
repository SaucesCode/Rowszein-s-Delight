import { useId } from "react";
import type { Flavor } from "@/lib/flavor";
import { paint } from "./paint";
import { Shadow, TreatPaint } from "./TreatPaint";

/** A fudgy brownie square: crackled cocoa top with a flavour drizzle, darker cut sides. */
export default function Brownie({ flavor, size = 96 }: { flavor: Flavor; size?: number }) {
  const id = useId();
  const p = paint(id);
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" aria-hidden="true" className="treat-art">
      <TreatPaint id={id} flavor={flavor} />
      <Shadow cy={34} rx={40} />
      {/* Front and right sides. */}
      <path d="M-34 4 L16 18 L16 34 L-34 20 Z" fill="#4a2f24" />
      <path d="M16 18 L36 0 L36 16 L16 34 Z" fill="#5d3b2c" />
      {/* Crackled top. */}
      <path d="M-34 4 L-14 -14 L36 0 L16 18 Z" fill={p.cocoa} />
      <path d="M-22 0 L-8 -6 L4 -2 M-6 8 L8 2 L20 6 M6 -8 L18 -4" fill="none" stroke="#a37a62" strokeWidth="1" strokeLinecap="round" opacity="0.8" />
      <path d="M-26 6 Q-14 -2 -2 2 Q10 6 22 -2 Q28 -6 32 -2" fill="none" stroke={p.glaze} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M-28 2 L-14 -10" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
    </svg>
  );
}
