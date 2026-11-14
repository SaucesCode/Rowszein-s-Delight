import { useId } from "react";
import type { Flavor } from "@/lib/flavor";
import { paint } from "./paint";
import { Shadow, TreatPaint } from "./TreatPaint";

/** A wedge of layer cake seen from the cut side: two sponge layers, a cream line, flavour frosting on top and back. */
export default function CakeSlice({ flavor, size = 96 }: { flavor: Flavor; size?: number }) {
  const id = useId();
  const p = paint(id);
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" aria-hidden="true" className="treat-art">
      <TreatPaint id={id} flavor={flavor} />
      <Shadow cy={34} rx={40} />
      {/* Frosted back of the slice. */}
      <path d="M28 -10 L40 2 L40 30 L28 32 Z" fill={p.glaze} />
      {/* Cut side: sponge, filling and cream layers narrowing to the tip. */}
      <path d="M-38 12 L28 -10 L28 32 L-38 30 Z" fill={p.dough} />
      <path d="M-38 20 L28 6 L28 12 L-38 23 Z" fill={p.glaze} opacity="0.9" />
      <path d="M-38 23 L28 12 L28 15 L-38 25 Z" fill="#fffaf3" />
      <path d="M-38 12 L28 -10 L28 -4 L-38 15 Z" fill="#fffaf3" opacity="0.85" />
      {/* Frosted top. */}
      <path d="M-38 12 L28 -10 L40 2 Z" fill={p.glaze} />
      <circle cx="30" cy="-6" r="5" fill={p.cream} />
      <circle cx="31" cy="-10" r="3" fill="#c8344f" className="treat-detail treat-detail-bob" />
      <path d="M-30 9 L14 -6" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}
