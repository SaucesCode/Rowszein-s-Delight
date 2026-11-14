/** How the shop draws an item without a photo. Rowszein's own items are always donuts. */
export type Shape = "donut" | "whole_cake" | "cake_slice" | "cupcake" | "muffin" | "brownie" | "cookie" | "bread";

/** The treats a partner item can be drawn as, in the order the item form offers them. */
export const SHAPES: { value: Exclude<Shape, "donut">; label: string }[] = [
  { value: "whole_cake", label: "Whole cake" },
  { value: "cake_slice", label: "Cake slice" },
  { value: "cupcake", label: "Cupcake" },
  { value: "muffin", label: "Muffin" },
  { value: "brownie", label: "Brownie" },
  { value: "cookie", label: "Cookie" },
  { value: "bread", label: "Bread" },
];

// Checked in order; the first match wins ("roll cake" is a cake, a plain "roll" is bread).
const RULES: [Exclude<Shape, "donut">, string[]][] = [
  ["whole_cake", ["roll cake"]],
  ["cake_slice", ["cheesecake", "slice"]],
  ["cupcake", ["cupcake"]],
  ["muffin", ["muffin"]],
  ["brownie", ["brownie", "blondie"]],
  ["cookie", ["cookie", "crinkle", "polvoron"]],
  ["bread", ["bread", "loaf", "pandesal", "ensaymada", "bun", "roll", "monay"]],
  ["whole_cake", ["cake", "torte"]],
];

/** A first guess at the drawing from the item's name; the owner can change it. */
export function guessShape(name: string): Exclude<Shape, "donut"> {
  const lower = name.toLowerCase();
  return RULES.find(([, words]) => words.some(word => lower.includes(word)))?.[0] ?? "whole_cake";
}

/**
 * Where the item form's picker starts. A saved partner item keeps the drawing the owner chose; one
 * saved as a donut (from before drawings existed; the picker never offers a donut) starts on the guess.
 */
export function savedShapeChoice(product?: { partner?: unknown; shape?: Shape }): { shape: Exclude<Shape, "donut">; touched: boolean } {
  const shape = product?.partner ? product.shape : undefined;
  return shape && shape !== "donut" ? { shape, touched: true } : { shape: "whole_cake", touched: false };
}
