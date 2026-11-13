import { Star } from "lucide-react";

/** A pastry box, used for the customer's box everywhere on the shop. */
export function BoxIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9Z" />
      <path d="M3 9l2-4h14l2 4" />
      <path d="M9 13h6" strokeLinecap="round" />
    </svg>
  );
}

const SCALLOPS = 30;
const OUTER = 96;

/** Scalloped outline for the doily, built once: a semicircle bump between each pair of points on a circle. */
const DOILY_EDGE = (() => {
  const point = (index: number) => {
    const angle = (index / SCALLOPS) * Math.PI * 2;
    return [100 + OUTER * Math.cos(angle), 100 + OUTER * Math.sin(angle)];
  };
  const bump = Math.sin(Math.PI / SCALLOPS) * OUTER;
  const [x0, y0] = point(0);
  let path = `M${x0.toFixed(2)} ${y0.toFixed(2)}`;
  for (let index = 1; index <= SCALLOPS; index += 1) {
    const [x, y] = point(index);
    path += ` A${bump.toFixed(2)} ${bump.toFixed(2)} 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return `${path} Z`;
})();

/** Paper doily the hero donut sits on. */
export function Doily({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="-4 -4 208 208" aria-hidden="true">
      <path d={DOILY_EDGE} className="doily-paper" />
      <circle cx="100" cy="100" r="84" className="doily-perforation" />
      <circle cx="100" cy="100" r="74" className="doily-ring" />
    </svg>
  );
}

/** Gilt divider: two hairlines meeting at a small donut, used between shop sections. */
export function Ornament({ className }: { className?: string }) {
  return (
    <svg className={className} width="168" height="16" viewBox="0 0 168 16" fill="none" aria-hidden="true">
      <path d="M0 8h66M102 8h66" stroke="currentColor" strokeWidth="1" />
      <path d="M70 8l4-3 4 3-4 3z M90 8l4-3 4 3-4 3z" fill="currentColor" />
      <circle cx="84" cy="8" r="5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="84" cy="8" r="1.6" fill="currentColor" />
    </svg>
  );
}

/**
 * A donut's name with the best-seller star tied to its last word, so the star
 * never wraps onto a line of its own.
 */
export function DonutName({ name, bestSeller, starSize = 13 }: { name: string; bestSeller: boolean; starSize?: number }) {
  if (!bestSeller) return <>{name}</>;
  const split = name.lastIndexOf(" ");
  return (
    <>
      {split > 0 && `${name.slice(0, split)} `}
      <span className="donut-name-tail">
        {name.slice(split + 1)}
        <span className="donut-star" title="Best seller">
          <Star size={starSize} strokeWidth={2} aria-hidden="true" />
          <span className="sr-only">, best seller</span>
        </span>
      </span>
    </>
  );
}
