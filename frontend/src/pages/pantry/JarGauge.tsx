import { useId } from "react";
import type { StockStatus } from "@/lib/stockStatus";

const BODY = { x: 14, y: 30, width: 92, height: 122 };

/** A glass jar that fills to the current stock, with a dashed line at the restock level. */
export default function JarGauge({
  fill,
  mark,
  status,
  size = 132,
}: {
  fill: number;
  mark: number | null;
  status: StockStatus;
  size?: number;
}) {
  const clipId = useId();
  const markY = mark === null ? null : BODY.y + BODY.height * (1 - mark);

  return (
    <svg
      className={`jar is-${status}`}
      width={size}
      height={(size * 164) / 120}
      viewBox="0 0 120 164"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <rect {...BODY} rx="24" />
        </clipPath>
      </defs>
      <rect x="26" y="12" width="68" height="16" rx="7" className="jar-lid" />
      <rect x="20" y="24" width="80" height="8" rx="4" className="jar-neck" />
      <rect {...BODY} rx="24" className="jar-glass" />
      <g clipPath={`url(#${clipId})`}>
        <rect {...BODY} className="jar-fill" style={{ transform: `scaleY(${fill})` }} />
      </g>
      {markY !== null && (
        <line x1={BODY.x + 6} x2={BODY.x + BODY.width - 6} y1={markY} y2={markY} className="jar-mark" />
      )}
      <rect {...BODY} rx="24" className="jar-outline" />
      <path d="M30 52c0-6 3-10 8-12" className="jar-shine" />
    </svg>
  );
}
