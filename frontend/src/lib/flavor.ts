export type Flavor = "strawberry" | "blueberry" | "matcha" | "choco" | "ube" | "caramel" | "classic";

// Order matters: "blueberry" must be checked before the generic "berry".
const FLAVOR_WORDS: [Flavor, string[]][] = [
  ["blueberry", ["blueberry"]],
  ["strawberry", ["strawberry", "berry", "raspberry", "pink"]],
  ["choco", ["choco", "cocoa", "bavarian", "velvet", "mocha"]],
  ["matcha", ["matcha", "green tea", "pistachio"]],
  ["ube", ["ube", "taro", "purple"]],
  ["caramel", ["caramel", "cinnamon", "biscoff", "butterscotch", "maple", "dulce", "honey"]],
  ["classic", ["classic", "glazed", "sugar", "vanilla", "custard"]],
];

function match(text: string | undefined): Flavor | undefined {
  const lower = text?.toLowerCase();
  if (!lower) return undefined;
  return FLAVOR_WORDS.find(([, keys]) => keys.some((key) => lower.includes(key)))?.[0];
}

/**
 * Picks the illustration flavour for a donut. Its own name wins over its
 * category ("Strawberry Frosted" in "Glazed rings" is strawberry); strawberry
 * is the house default when nothing matches.
 */
export function flavorOf(name?: string, category?: string): Flavor {
  return match(name) ?? match(category) ?? "strawberry";
}

export const flavorTint = (flavor: Flavor) => `var(--color-glaze-${flavor}-tint)`;
