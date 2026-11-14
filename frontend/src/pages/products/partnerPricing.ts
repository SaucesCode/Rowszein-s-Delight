const cents = (value: number) => Math.round(value * 100);

/** The shop price of a partner item: their price plus the owner's patong, in whole centavos. */
export function joinPartnerPrice(their: number, patong: number): number {
  return (cents(their) + cents(patong)) / 100;
}

/** A saved partner item back into the two amounts the owner edits. */
export function splitPartnerPrice(price: string | number, payout: string | number): { their: number; patong: number } {
  return { their: cents(Number(payout)) / 100, patong: (cents(Number(price)) - cents(Number(payout))) / 100 };
}
