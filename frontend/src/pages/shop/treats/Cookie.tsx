import { useId } from "react";
import type { Flavor } from "@/lib/flavor";
import { paint, scatter } from "./paint";
import { Shadow, TreatPaint } from "./TreatPaint";

/** A round baked cookie with chunky chips in the flavour colour and a golden edge. */
export default function Cookie({ flavor, size = 96 }: { flavor: Flavor; size?: number }) {
  const id = useId();
  const p = paint(id);
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" aria-hidden="true" className="treat-art">
      <TreatPaint id={id} flavor={flavor} />
      <Shadow cy={32} rx={38} />
      <ellipse cx="1.5" cy="3" rx="39" ry="33" fill="#b97a3a" />
      <ellipse cx="0" cy="0" rx="38" ry="32" fill={p.dough} />
      <path d="M-18 -12 Q-10 -6 -14 2 M8 10 Q14 4 20 10 M4 -20 Q10 -16 8 -10" fill="none" stroke="#c4843f" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
      {scatter(8, 0, 0, 28, 23).map((point, index) => (
        <rect key={index} x={point.x - 3.2} y={point.y - 2.6} width="6.4" height="5.2" rx="1.8"
          fill={p.glaze} transform={`rotate(${point.turn} ${point.x} ${point.y})`} />
      ))}
      <path d="M-28 -12 A32 27 0 0 1 -10 -27" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}
