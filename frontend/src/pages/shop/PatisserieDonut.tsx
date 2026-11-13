import { useId } from "react";
import type { Flavor } from "@/lib/flavor";

/** Glaze outline with a few gentle drips, drawn once as points around the ring. */
function ringPath(radius: (angle: number) => number, steps: number): string {
  let path = "";
  for (let step = 0; step <= steps; step += 1) {
    const angle = (step / steps) * Math.PI * 2;
    const r = radius(angle);
    path += `${step === 0 ? "M" : "L"}${(r * Math.cos(angle)).toFixed(2)} ${(r * Math.sin(angle)).toFixed(2)}`;
  }
  return `${path}Z`;
}

const DRIPS = [0.6, 1.9, 3.1, 4.4, 5.5];
const drip = (angle: number) =>
  DRIPS.reduce((sum, centre) => {
    const distance = Math.atan2(Math.sin(angle - centre), Math.cos(angle - centre));
    return sum + 3.4 * Math.exp(-(distance * distance) / 0.018);
  }, 0);

const GLAZE_OUTER = ringPath(angle => 35.5 + 1.6 * Math.sin(5 * angle + 0.6) + 1 * Math.sin(9 * angle + 1.3) + drip(angle), 160);
const GLAZE_INNER = ringPath(angle => 17 + 0.7 * Math.sin(7 * angle), 60);

/** Points spread around the glaze ring, deterministic so every render matches. */
const SCATTER = Array.from({ length: 16 }, (_, index) => {
  const angle = index * 2.399963 + 0.4;
  const radius = 21 + ((index * 37) % 11);
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle), turn: (index * 47) % 180 };
});

const SPRINKLE_COLORS = ["#fffaf3", "var(--color-gilt-soft)", "var(--color-good-soft)", "var(--color-warn-soft)"];

const DRIZZLE = "M-31 -6 L-18 -24 L-14 8 L-2 -30 L3 6 L14 -26 L18 10 L30 -14";

function Toppings({ flavor }: { flavor: Flavor }) {
  switch (flavor) {
    case "strawberry":
    case "ube":
      return (
        <g>
          {SCATTER.map((point, index) => (
            <rect
              key={index}
              x={point.x - 2.6}
              y={point.y - 0.8}
              width="5.2"
              height="1.6"
              rx="0.8"
              fill={SPRINKLE_COLORS[index % SPRINKLE_COLORS.length]}
              transform={`rotate(${point.turn} ${point.x} ${point.y})`}
            />
          ))}
        </g>
      );
    case "choco":
      return <path d={DRIZZLE} fill="none" stroke="#a87458" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />;
    case "matcha":
      return <path d={DRIZZLE} fill="none" stroke="#fffaf3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.92" />;
    case "caramel":
      return (
        <g>
          <path d={DRIZZLE} fill="none" stroke="#f6dcae" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          {SCATTER.slice(0, 9).map((point, index) => (
            <rect key={index} x={point.x} y={point.y} width="1.6" height="1.6" fill="#fffaf3" transform={`rotate(${point.turn} ${point.x} ${point.y})`} />
          ))}
        </g>
      );
    case "blueberry":
      return (
        <g>
          {SCATTER.slice(0, 7).map((point, index) => (
            <g key={index}>
              <circle cx={point.x} cy={point.y} r="3" fill="#4d4785" />
              <circle cx={point.x - 0.9} cy={point.y - 0.9} r="0.8" fill="#fff" opacity="0.7" />
            </g>
          ))}
        </g>
      );
    default:
      return (
        <g fill="#fffaf3" opacity="0.85">
          {SCATTER.map((point, index) => (
            <circle key={index} cx={point.x} cy={point.y} r={index % 3 === 0 ? 0.9 : 0.6} />
          ))}
        </g>
      );
  }
}

/**
 * The shop's donut: shaded dough, a glossy glaze with drips and flavour
 * toppings. Shown wherever a donut has no photo yet.
 */
export default function PatisserieDonut({ flavor, size = 96 }: { flavor: Flavor; size?: number }) {
  const id = useId();
  const glaze = `var(--color-glaze-${flavor})`;

  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" aria-hidden="true" className="patisserie-donut">
      <defs>
        <radialGradient id={`${id}-dough`} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#f7d9a6" />
          <stop offset="0.55" stopColor="#e6b071" />
          <stop offset="1" stopColor="#c4843f" />
        </radialGradient>
        <linearGradient id={`${id}-glaze`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: `color-mix(in oklab, ${glaze} 62%, white)` }} />
          <stop offset="0.55" style={{ stopColor: glaze }} />
          <stop offset="1" style={{ stopColor: `color-mix(in oklab, ${glaze} 82%, black)` }} />
        </linearGradient>
        <mask id={`${id}-hole`}>
          <rect x="-50" y="-50" width="100" height="100" fill="#fff" />
          <circle r="12.5" fill="#000" />
        </mask>
      </defs>

      <circle cx="1.5" cy="3" r="45" fill="rgb(59 31 43 / 0.14)" mask={`url(#${id}-hole)`} />
      <circle r="45" fill={`url(#${id}-dough)`} mask={`url(#${id}-hole)`} />
      <circle r="13.6" fill="none" stroke="#b97a3a" strokeWidth="2" opacity="0.45" />

      <path d={`${GLAZE_OUTER}${GLAZE_INNER}`} fillRule="evenodd" fill={`url(#${id}-glaze)`} />
      <Toppings flavor={flavor} />

      <path d="M-24 -18 A30 30 0 0 1 -6 -29" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" opacity="0.55" />
      <circle cx="-28" cy="-8" r="1.6" fill="#fff" opacity="0.6" />
    </svg>
  );
}
