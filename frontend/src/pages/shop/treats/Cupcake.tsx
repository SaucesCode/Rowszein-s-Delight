import { useId } from "react";
import type { Flavor } from "@/lib/flavor";
import { paint, scatter, SPRINKLES } from "./paint";
import { Shadow, TreatPaint } from "./TreatPaint";

const PLEATS = [-18, -11, -4, 3, 10, 17];

/** A cupcake: pleated paper liner, a flavour frosting swirl and a cherry on top. */
export default function Cupcake({ flavor, size = 96 }: { flavor: Flavor; size?: number }) {
  const id = useId();
  const p = paint(id);
  const sprinkled = flavor === "strawberry" || flavor === "ube" || flavor === "blueberry";
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" aria-hidden="true" className="treat-art">
      <TreatPaint id={id} flavor={flavor} />
      <Shadow cy={38} rx={26} />
      <path d="M-25 6 L25 6 L18 38 L-18 38 Z" fill="#f3e3cf" />
      {PLEATS.map(x => (
        <path key={x} d={`M${x * 1.15} 6 L${x * 0.85} 38`} stroke="#d9bfa0" strokeWidth="1.4" />
      ))}
      <ellipse cx="0" cy="5" rx="29" ry="9" fill={p.dough} />
      <ellipse cx="0" cy="0" rx="27" ry="9" fill={p.glaze} />
      <ellipse cx="0" cy="-9" rx="20" ry="8" fill={p.glaze} />
      <ellipse cx="0" cy="-17" rx="12" ry="6.5" fill={p.glaze} />
      <path d="M-5 -21 Q0 -30 5 -21 Z" fill={p.glaze} />
      <path d="M-24 -1 Q0 6 24 -1 M-17 -10 Q0 -4 17 -10" fill="none" stroke="rgb(59 31 43 / 0.16)" strokeWidth="1.2" />
      {sprinkled &&
        scatter(10, 0, -6, 20, 10).map((point, index) => (
          <rect key={index} x={point.x - 2} y={point.y - 0.7} width="4" height="1.4" rx="0.7"
            fill={SPRINKLES[index % SPRINKLES.length]} transform={`rotate(${point.turn} ${point.x} ${point.y})`} />
        ))}
      <g className="treat-detail treat-detail-bob">
        <path d="M1 -30 Q3 -37 8 -40" fill="none" stroke="#5f7a4a" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="0" cy="-27" r="5" fill="#c8344f" />
        <circle cx="-1.8" cy="-28.8" r="1.4" fill="#fff" opacity="0.7" />
      </g>
      <path d="M-20 -4 Q-14 -9 -6 -10" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}
