import { useId } from "react";

import type { Flavor } from "@/lib/flavor";

const SPRINKLES = [
  { x: 17, y: 14, r: 25 },
  { x: 27, y: 15, r: -30 },
  { x: 31, y: 25, r: 45 },
  { x: 15, y: 27, r: 10 },
  { x: 22, y: 33, r: -15 },
];

/** Hand-drawn glazed donut used wherever a product has no photo. */
export default function DonutArt({
  flavor,
  size = 88,
}: {
  flavor: Flavor;
  size?: number;
}) {
  const glaze = `var(--color-glaze-${flavor})`;
  const sprinkled = flavor === "strawberry" || flavor === "ube";
  const holeId = useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <mask id={holeId}>
        <rect width="48" height="48" fill="white" />
        <circle cx="24" cy="24" r="6.5" fill="black" />
      </mask>
      <g mask={`url(#${holeId})`}>
        <circle cx="24" cy="24" r="19" fill="var(--color-dough)" />
        <path
          d="M24 6.5c5 0 9.6 2.2 12.7 5.9 1.2 1.4.4 2.9 1.3 4.4 1 1.7 2.7 2.7 2.7 5.2 0 2.3-1.6 3.4-1.9 5.3-.3 2.2.9 3.8-.4 6-2.9 5-8.4 8.2-14.4 8.2-6.3 0-11.8-3.5-14.6-8.7-1-1.9.2-3.5-.2-5.4-.4-1.8-1.9-2.9-1.9-5.3 0-2.6 1.8-3.6 2.8-5.4.8-1.5 0-2.9 1.3-4.3C14.6 8.7 19.1 6.5 24 6.5Z"
          fill={glaze}
        />
        <circle
          cx="24"
          cy="24"
          r="7.5"
          stroke="var(--color-dough)"
          strokeWidth="2"
        />
        <path
          d="M14 15.5c1.6-1.6 3.6-2.7 5.8-3.2"
          stroke="var(--color-surface)"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.7"
        />
        {sprinkled &&
          SPRINKLES.map(({ x, y, r }) => (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="3.6"
              height="1.4"
              rx="0.7"
              fill="var(--color-surface)"
              opacity="0.9"
              transform={`rotate(${r} ${x} ${y})`}
            />
          ))}
      </g>
    </svg>
  );
}
