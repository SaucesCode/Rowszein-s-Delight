# Boxes in the Sales register — design

Date: 14 November 2026 · Branch: `pre-launch-hardening` · Status: approved by the owner on 14 November 2026, including the flavour-rule revision; built on 14 November 2026

## Why

Customers order boxes online (Box of 8/12/24, filled by the customer, or a ready-made box), but the Sales register can only record single items. The owner and staff must be able to record a box **as a box**: its name, its price, and what's inside. The pantry must come down for every donut in it, and reports must be able to count boxes sold.

## Goals

1. Record box sales in the register: a size filled donut by donut, or a ready-made box in one tap. Boxes can sit alongside single donuts and partner items in the same sale.
2. A box keeps its price and contents as sold; later price or ready-made changes never alter recorded sales.
3. Pantry stock comes off for every donut inside a box, through the same recipe rules as single donuts.
4. Sale history, the receipt and the CSV/PDF exports show boxes with their contents.
5. Analytics shows boxes sold; best sellers count donuts inside boxes.

## Non-goals

* Changing what's inside a box on a saved sale (remove the box and add it again instead).
* Discount codes or box promotions beyond the owner editing a box's price.
* Partner items in boxes (already forbidden everywhere).

## Anti-goals

* A box that changes price or contents after it's recorded.
* A donut in a box that skips the pantry, or a cancelled box whose stock doesn't come back.
* A box price on a sale that disagrees with the money posted to the ledger.
* Staff able to record a box at a price other than the shop's.

## Approaches considered

1. **Box lines on the sale (chosen).** A sale holds item lines (as today) plus box lines. Each box line is a snapshot: name, size, price and contents. Stock is computed from singles plus box contents per donut. This is the only option that keeps boxes as boxes and gets the pantry right.
2. **Boxes as products.** Rejected: a "Box of 12" product doesn't know which donuts are inside, so the pantry can't come down.
3. **Unpack a box into donut lines with its price spread across them.** Rejected: the owner wants boxes kept as boxes, the price split is arbitrary, and a sale can hold each product only once, so a box and a single Glazed would collide.

## How it works today (relevant facts)

* `sales/services.execute_sale` is the only way to create, edit or cancel a sale: audited, idempotent, revision-checked.
  * It keeps original `SaleItem` rows and the current lines in `Sale.current_items` (JSON).
  * Money goes to `SaleFinancialEntry`; it checks that the posted ledger equals the current total.
* Stock: for every product whose quantity changed, it reverses old `SaleConsumption` allocations and allocates new ones through that product's recipe.
* The intent fingerprint (`_intent`) hashes the requested change for idempotency.
* `_items` refuses a sale with no item lines ("A sale requires unique product lines").
* Staff may only create sales, dated today in Manila, at catalog prices.
* Box pricing exists in `products/boxes.py`: size price plus each donut's `box_extra`; ready-made boxes are `Assortment` with items.
* Partner items: lines carry a `partner` and `partner_payout` snapshot and never touch stock.

## Revision: the flavour rule (owner's request, 14 November 2026)

Making a box where every donut is a different flavour is hard for the kitchen. So every box, wherever it's made, follows one rule:

* **A limit per size.** Each box size has a **most flavours** number the owner sets on the Boxes page. The migration starts existing sizes at: size ≤ 8 → 2, size ≤ 12 → 3, larger → 4. Allowed values: 1 up to the size, at most 12.
* **Even fill.** A box holds 1 to *most flavours* different donuts, and they fill the box **as evenly as possible**:
  * `even_split(size, k)` gives each flavour `size // k`, and the first `size % k` flavours (in the order picked) one more.
  * So a Box of 12 is 12, 6 + 6 or 4 + 4 + 4, and a Box of 10 with 3 flavours is 4 + 3 + 3.
  * A box is therefore always full the moment one flavour is picked.
* **Checking a box.** A box's contents are valid when:
  * the number of different donuts is between 1 and *most flavours*; and
  * the quantities, sorted from largest, equal `even_split(size, k)` sorted the same way.
* **Where it's checked.** The server checks it everywhere, so nothing can get round it:
  * register box lines (`new_box_line`);
  * ready-made boxes (the `AssortmentSerializer` refuses to save one that breaks it);
  * the shop's ready-made list (`is_shop_ready` hides a box that breaks the rule, for example after the owner lowers *most flavours*).
* **Premium extras** still count per donut. Price = size price + Σ(`box_extra` × quantity).
* **The same rule applies to the owner** (my call: the limit is about what the kitchen can make; to allow a special order, raise *most flavours* for that size).

What this changes in the screens:

* **Boxes page:** each size row gets a "Most flavours" number. A ready-made box that breaks the rule is flagged "Doesn't follow the flavour rule: shop hides it".
* **Ready-made box builder:** the owner picks flavours (up to the size's limit) and the box fills evenly, the same way as the shop.
* **Shop, "Fill it yourself":**
  * The customer taps donuts to **pick or unpick flavours**. The box fills evenly as they go ("4 Glazed · 4 Ube · 4 Choco Dip").
  * Once the limit is reached, the other donuts dim with "This box takes up to 3 flavours".
  * Partner items stay "Not in boxes".
  * "Add box" works as soon as one flavour is picked.
  * A box order saved in the browser under the old format is cleared on load rather than shown wrong.
* **Register:** the same flavour picking replaces "tap each donut, then + and −". Pick the size, tap the flavours from the Messenger order card, then "Add box to sale".

The register sections below are read with this revision: wherever they say "tap a donut tile puts one in the box" or "− and +", read it as "tap to pick or unpick a flavour; the box fills evenly".

## Design

### Data

* `Sale.current_boxes`: a new nullable JSONField (migration), the current box lines (null and `[]` both mean no boxes).
* Each box line holds:
  * `key`: a server-generated id.
  * `box_size_id` and `size`.
  * `assortment_id`: null unless the box is ready-made.
  * `name`: "Box of 12" or the ready-made box's name.
  * `price`: money text, the price the customer paid for this box.
  * `contents`: a list of `{product, product_name, quantity, box_extra}`, sorted by product.
* No new table. As today with `current_items`, the history of every change lives in the audit log (`InventoryOperation` before-snapshots and response bodies).

### The sale command (`execute_sale`)

* **Payload:** the sale payload gains an optional `boxes` list. Each entry is one of:
  * `{key}`: keep an existing box unchanged.
  * `{box_size, contents: [{product, quantity}], price?}`: a new box the owner filled.
  * `{assortment, price?}`: a new ready-made box. The server copies the ready-made box's contents at that moment.
* **Unknown keys:** a key that isn't one of the sale's current boxes is a 400.
* **Validation of new boxes:**
  * the contents must add up exactly to the size;
  * no partner items;
  * every donut must exist and be available;
  * the size, or the ready-made box and its size, must exist; staff also need them on sale;
  * quantities are positive integers;
  * at most 48 donuts per box (the size limit);
  * at most 50 boxes per sale.
* **Price:**
  * The shop price is size price plus the sum of `box_extra × quantity`, worked out on the server.
  * Staff can't send a price, or must send exactly the shop price, otherwise 400 "Staff must use the shop's box price."
  * The owner may send any price above ₱0 (a discount).
  * The price is then fixed in the snapshot.
* **Totals:** sale total = item lines plus box prices. Both the old and new amounts include boxes, so the ledger check and the postings (create, adjustment, cancellation) cover box money.
* **Stock:** donut quantities for consumption are single lines plus box contents, per product.
  * Old quantities come from the old items plus the old boxes; new quantities from the new items plus the new boxes.
  * The rest of the stock logic (allocations, reversals, the partner/own rule) runs unchanged on these combined quantities.
  * A donut in a box always counts as Rowszein's own (partner items can't be in boxes).
* **A sale needs at least one line,** an item or a box ("Add at least one item or box."). A boxes-only sale is valid.
* **Idempotency:** `_intent` includes the requested boxes (keys for kept boxes, and size or ready-made id, contents and price for new ones), so a retried request with the same key replays and a different one conflicts.
* **Original record:** on create, `SaleItem` rows are written for item lines only (as today), and `current_boxes` holds the boxes. Older sales have null `current_boxes`.
* **Responses:** `sale_data` returns `boxes` (the current box lines) alongside `sale_items`, plus `total_amount` including boxes.

### Reports

* **Best sellers** (dashboard product mix): quantity includes donuts inside boxes. Revenue stays single-line revenue only, because a box's price can't be split fairly between donuts (my call).
* **Boxes sold:** the dashboard gains `boxes: {count, revenue}` for recorded sales with an order date in the range. Analytics shows "18 boxes sold · ₱7,200.00".
* **Exports:**
  * The CSV item summary adds box lines as "Box of 12 (4 Glazed Original, 4 Ube Cream, 4 Choco Dip)".
  * The PDF lists boxes the same way. It currently reads original `SaleItem` rows, so it moves to the current lines (`sale_data`) so boxes and edits appear.

### Register (frontend)

* An **"Add a box"** button above the catalog opens a small chooser:
  * box sizes that are on sale ("Box of 12 · ₱400");
  * ready-made boxes that are complete ("Classic dozen · ₱420").
  * The owner also sees switched-off sizes, labelled "Off sale".
* **Ready-made:** the box is added to the ticket in one tap.
* **A size:** the register enters box mode. A box panel at the top of the ticket shows "Box of 12 · 7 of 12".
  * Tapping a donut tile puts one in the box.
  * Each flavour row in the panel has − and + (+ is disabled when the box is full) and shows "+₱10 each" for premium donuts.
  * Partner tiles are dimmed with "Not in boxes".
  * "Add box to sale" is enabled only when the box is full; "Cancel box" asks first if any donuts are in.
  * While a box is open, single-item tapping is paused: the panel says "Finish or cancel the box to add single items."
* **Ticket box line:** name, contents summary, price (editable by the owner, as with item prices), and a remove button. Totals and the count ("1 box, 3 donuts") include boxes.
* **Editing a saved sale:** existing boxes are listed and can be removed; new boxes can be added. Contents of a saved box are read-only.
* **Receipt and sale history:** boxes are shown with contents, and the history search matches box names and contents.
* **Phones:** the box panel sits in the order drawer. While a box is open, the dock shows "Box of 12 · 7 of 12" instead of the order total.

## Failure modes

* **Price changes:** a box size's price or a donut's `box_extra` changes after a sale. The snapshot keeps the old price.
* **A donut in a box is switched off** ("resting"). Kept boxes are unaffected; new boxes can't include it.
* **A ready-made box is edited or deleted after a sale.** The snapshot keeps the contents; `assortment_id` may then point nowhere, so names come from the snapshot.
* **Cancelling a sale with boxes:** every donut in every box returns to the pantry, and the full box money is reversed.
* **Edit races:** an edit sent against a stale revision gets 409, as today.

## Testing

* **Backend (TDD) for `execute_sale`:**
  * a box-only sale;
  * a mixed sale (items, a box, a partner item): stock comes off only for donuts, including the box contents, and the total and ledger posting include the box;
  * a ready-made box copies its contents and price;
  * contents that don't fill the box, partner items in a box, and unavailable donuts are refused;
  * staff price override is refused, and staff can't use an off-sale size;
  * the owner's discount price is kept;
  * the box price stays fixed after size, extra or ready-made changes;
  * an edit that keeps a box leaves its snapshot and stock untouched;
  * an edit that removes a box returns its stock and posts an adjustment;
  * cancellation returns all stock and money;
  * an unknown box key is refused;
  * idempotent replay of a box sale, and a different box under the same key conflicts;
  * staff never see partner payouts (unchanged);
  * old sales with null boxes still work.
* **Backend reports:** boxes sold and best sellers including box donuts; CSV/PDF contents.
* **Frontend:**
  * regression tests for the box-filling state (add, take out, can't overfill, partner refused, price with extras) and the ticket totals;
  * browser checks at 375 and 1440 px, keyboard-only and axe;
  * a WebKit run.

**Flavour rule tests:**

* `even_split`: 12/3 → [4,4,4]; 10/3 → [4,3,3]; 8/1 → [8].
* A box over the flavour limit is refused, and so is an uneven box (7 + 1 in a Box of 8).
* A ready-made box that breaks the rule can't be saved, and one broken by a later limit change is hidden from the shop and refused in the register.
* The migration defaults for existing sizes.
* Shop and register flavour picking (regression tests on the pure helpers, plus browser checks).

## Left to the builder

Exact copy within the existing register voice, icons, and the panel's spacing within design tokens.
