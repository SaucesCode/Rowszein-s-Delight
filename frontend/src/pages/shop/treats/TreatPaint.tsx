import type { Flavor } from "@/lib/flavor";

/** The donut's glaze and dough gradients, plus a baked crust, cocoa and cream for the other treats. Lit from the upper left. */
export function TreatPaint({ id, flavor }: { id: string; flavor: Flavor }) {
  const glaze = `var(--color-glaze-${flavor})`;
  return (
    <defs>
      <linearGradient id={`${id}-glaze`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style={{ stopColor: `color-mix(in oklab, ${glaze} 62%, white)` }} />
        <stop offset="0.55" style={{ stopColor: glaze }} />
        <stop offset="1" style={{ stopColor: `color-mix(in oklab, ${glaze} 82%, black)` }} />
      </linearGradient>
      <radialGradient id={`${id}-dough`} cx="38%" cy="32%" r="75%">
        <stop offset="0" stopColor="#f7d9a6" />
        <stop offset="0.55" stopColor="#e6b071" />
        <stop offset="1" stopColor="#c4843f" />
      </radialGradient>
      <linearGradient id={`${id}-crust`} x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0" stopColor="#eab06a" />
        <stop offset="0.6" stopColor="#c9813c" />
        <stop offset="1" stopColor="#9c5a26" />
      </linearGradient>
      <linearGradient id={`${id}-cocoa`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#8a5f49" />
        <stop offset="0.55" stopColor="#64402f" />
        <stop offset="1" stopColor="#452a1f" />
      </linearGradient>
      <linearGradient id={`${id}-cream`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style={{ stopColor: `color-mix(in oklab, ${glaze} 18%, #fffaf3)` }} />
        <stop offset="1" style={{ stopColor: `color-mix(in oklab, ${glaze} 34%, #f6e7d4)` }} />
      </linearGradient>
    </defs>
  );
}

/** The soft shadow every treat sits on, the same tone as the donut's. */
export function Shadow({ cy = 36, rx = 38 }: { cy?: number; rx?: number }) {
  return <ellipse cx="2" cy={cy} rx={rx} ry="6" fill="rgb(59 31 43 / 0.14)" />;
}
