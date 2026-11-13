export type Flavor = "strawberry" | "matcha" | "choco" | "ube" | "classic";

const FLAVOR_WORDS: [Flavor, string[]][] = [
  ["strawberry", ["strawberry", "berry", "raspberry", "pink"]],
  ["choco", ["choco", "cocoa", "bavarian", "velvet", "mocha"]],
  ["matcha", ["matcha", "green tea", "pistachio"]],
  ["ube", ["ube", "taro", "purple"]],
  ["classic", ["classic", "glazed", "cinnamon", "sugar", "vanilla", "custard"]],
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
