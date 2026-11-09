/** Exact stock quanta for previews and request strings; never binary floats. */
const SCALE = 1_000_000_000n;
const MAX = 99_999_999_999_999_999_999n;

export function stockQuanta(text: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{1,9}))?$/.exec(text);
  if (!match) throw new Error("Use a decimal with at most nine fractional places.");
  const value = BigInt(match[2]) * SCALE + BigInt((match[3] ?? "").padEnd(9, "0"));
  if (value > MAX) throw new Error("Stock quantity is outside the supported range.");
  return match[1] ? -value : value;
}

export function stockText(value: bigint): string {
  const magnitude = value < 0n ? -value : value;
  return `${value < 0n ? "-" : ""}${magnitude / SCALE}.${String(magnitude % SCALE).padStart(9, "0")}`;
}
