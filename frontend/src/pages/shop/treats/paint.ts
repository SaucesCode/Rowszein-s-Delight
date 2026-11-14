/** Gradient ids shared by the treat drawings (defined once per drawing by <TreatPaint>). */
export const paint = (id: string) => ({
  glaze: `url(#${id}-glaze)`,
  dough: `url(#${id}-dough)`,
  crust: `url(#${id}-crust)`,
  cocoa: `url(#${id}-cocoa)`,
  cream: `url(#${id}-cream)`,
});

/** The donut's sprinkle colours. */
export const SPRINKLES = ["#fffaf3", "var(--color-gilt-soft)", "var(--color-good-soft)", "var(--color-warn-soft)"];

/** Deterministic points for sprinkles, chips and crumbs, so every render matches. */
export const scatter = (count: number, cx: number, cy: number, rx: number, ry: number) =>
  Array.from({ length: count }, (_, index) => {
    const angle = index * 2.399963 + 0.4;
    const radius = 0.35 + ((index * 37) % 11) / 16;
    return { x: cx + rx * radius * Math.cos(angle), y: cy + ry * radius * Math.sin(angle), turn: (index * 47) % 180 };
  });
