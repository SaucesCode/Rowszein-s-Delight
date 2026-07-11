import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, ArrowDownRight, AlertCircle } from "lucide-react";

/* ─────────────────────────────────────────────
   TYPES
   ───────────────────────────────────────────── */
type Tone = "neutral" | "positive" | "negative" | "warning";

interface Delta {
  /** Signed or unsigned percentage — sign is inferred from `direction` if omitted */
  value: number;
  direction: "up" | "down" | "flat";
  /** e.g. "vs last month" */
  comparisonLabel: string;
  /**
   * Which direction counts as good news. Sales going up is good ("up-is-good",
   * the default). Expenses going up is bad — pass "down-is-good" so the pill
   * colors by business outcome, not literal arrow direction.
   */
  polarity?: "up-is-good" | "down-is-good";
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  /** Only affects the value color, delta pill, and card wash — never the whole card */
  tone?: Tone;
  delta?: Delta;
  /** Small trend line, most recent point last */
  sparkline?: number[];
  /** Fallback footer when there's no delta yet (e.g. "Needs attention") */
  badgeText?: string;
  action?: ReactNode;
}

/* ─────────────────────────────────────────────
   TONE MAP — semantic, not decorative
   ───────────────────────────────────────────── */
const TONE_STYLES: Record<
  Tone,
  {
    cardBg: string;
    cardBorder: string;
    labelColor: string;
    iconColor: string;
    valueColor: string;
    dividerColor: string;
  }
> = {
  neutral: {
    cardBg: "#FFFDFB",
    cardBorder: "#E8E6E1",
    labelColor: "#7C5A3D",
    iconColor: "#9B6644",
    valueColor: "#3D3A35",
    dividerColor: "#F0EAE0",
  },
  positive: {
    cardBg: "#FFF8F0",
    cardBorder: "#FFD6E7",
    labelColor: "#E5528A",
    iconColor: "#E5528A",
    valueColor: "#6B4226",
    dividerColor: "#FBDCE9",
  },
  negative: {
    cardBg: "#FFFDFB",
    cardBorder: "#F5CFCB",
    labelColor: "#9B4A3D",
    iconColor: "#B45447",
    valueColor: "#6B2E24",
    dividerColor: "#F5DAD6",
  },
  warning: {
    cardBg: "#FFFDFB",
    cardBorder: "#E8E6E1",
    labelColor: "#7C5A3D",
    iconColor: "#9B6644",
    valueColor: "#3D3A35",
    dividerColor: "#F0EAE0",
  },
};

const DELTA_STYLES = {
  up: { bg: "#EAF3DE", fg: "#27500A" },
  down: { bg: "#FCEBEB", fg: "#791F1F" },
  flat: { bg: "#F1EFE8", fg: "#5F5E5A" },
};

/* ─────────────────────────────────────────────
   SPARKLINE — small inline trend, no dependency
   ───────────────────────────────────────────── */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;

  const w = 52;
  const h = 20;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((d - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─────────────────────────────────────────────
   DELTA PILL
   ───────────────────────────────────────────── */
function DeltaPill({ delta }: { delta: Delta }) {
  const polarity = delta.polarity ?? "up-is-good";

  // Arrow always reflects what the number actually did.
  const Arrow = delta.direction === "down" ? ArrowDownRight : ArrowUpRight;
  const sign = delta.direction === "flat" ? "" : delta.direction === "down" ? "-" : "+";

  // Color reflects whether that movement is good or bad for the business —
  // these can disagree (e.g. expenses up = red, even though the arrow points up).
  const isGood =
    delta.direction === "flat"
      ? null
      : polarity === "down-is-good"
        ? delta.direction === "down"
        : delta.direction === "up";

  const style =
    isGood === null ? DELTA_STYLES.flat : isGood ? DELTA_STYLES.up : DELTA_STYLES.down;

  return (
    <span
      className="inline-flex items-center gap-1 font-body font-semibold"
      style={{
        background: style.bg,
        color: style.fg,
        fontSize: 12,
        padding: "2px 7px",
        borderRadius: 999,
      }}
    >
      {delta.direction !== "flat" && <Arrow size={12} aria-hidden="true" />}
      {sign}
      {Math.abs(delta.value).toFixed(1)}%
    </span>
  );
}

/* ─────────────────────────────────────────────
   STAT CARD
   ───────────────────────────────────────────── */
export default function StatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  delta,
  sparkline,
  badgeText,
  action,
}: StatCardProps) {
  const t = TONE_STYLES[tone];
  const sparklineColor = tone === "positive" || tone === "neutral" ? "#FF6FAE" : "#D4A373";

  return (
    <div
      className="transition-colors"
      style={{
        background: t.cardBg,
        border: `1px solid ${t.cardBorder}`,
        borderRadius: 16,
        padding: "20px 24px",
      }}
    >
      {/* Label row */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={16} style={{ color: t.iconColor, flexShrink: 0 }} aria-hidden="true" />
          <span
            className="font-body font-semibold uppercase truncate"
            style={{ fontSize: 11, letterSpacing: "0.06em", color: t.labelColor }}
          >
            {label}
          </span>
        </div>
        {action}
      </div>

      {/* Value */}
      <p
        className="font-heading font-bold"
        style={{
          fontSize: 28,
          color: t.valueColor,
          margin: 0,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.15,
        }}
      >
        {value}
      </p>

      {/* Divider */}
      <div style={{ borderTop: `1px dashed ${t.dividerColor}`, margin: "14px 0 10px" }} />

      {/* Footer: delta + sparkline, or badge fallback */}
      {delta ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <DeltaPill delta={delta} />
            <span className="font-body truncate" style={{ fontSize: 12, color: "#9B6644" }}>
              {delta.comparisonLabel}
            </span>
          </div>
          {sparkline && <Sparkline data={sparkline} color={sparklineColor} />}
          <span className="sr-only">
            {label} {delta.direction === "flat" ? "held steady" : `${delta.direction === "up" ? "increased" : "decreased"} ${Math.abs(delta.value).toFixed(1)} percent`} {delta.comparisonLabel}
          </span>
        </div>
      ) : badgeText ? (
        <span
          className="inline-flex items-center gap-1 font-body font-semibold"
          style={{
            background: "#FAEEDA",
            color: "#633806",
            fontSize: 12,
            padding: "2px 7px",
            borderRadius: 999,
          }}
        >
          <AlertCircle size={12} aria-hidden="true" />
          {badgeText}
        </span>
      ) : null}
    </div>
  );
}