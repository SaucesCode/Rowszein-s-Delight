/**
 * The box flavour rule, the same as the server's (products/boxes.py): a box holds up to its
 * size's "most flavours", filled as evenly as possible. The first flavours picked get any extra one.
 */
export function evenSplit(size: number, k: number): number[] {
  const base = Math.floor(size / k);
  const extra = size % k;
  return Array.from({ length: k }, (_, index) => (index < extra ? base + 1 : base));
}

export function fillEvenly<T>(size: number, flavours: T[]): { item: T; quantity: number }[] {
  if (flavours.length === 0) return [];
  const split = evenSplit(size, flavours.length);
  return flavours.map((item, index) => ({ item, quantity: split[index] }));
}

export const canPickMore = (maxFlavors: number, picked: number) => picked < maxFlavors;
