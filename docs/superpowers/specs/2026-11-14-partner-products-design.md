# Partner products (collabs) — design

Date: 14 November 2026 · Branch: `pre-launch-hardening` · Status: approved by the owner on 14 November 2026 (including recording payments to partners); built on 14 November 2026 (see the plan and README)

## Why

Rowszein's Delight wants to sell food made by collab partners (muffins, cakes, other baked goods) alongside its donuts, so customers find more in one order. Rowszein sells these items **for** the partner: the customer orders everything in one Messenger message, pays Rowszein, and gets everything in **one delivery**. Each partner sets their own price per item ("their price"); the owner adds a fixed charge on top, the **patong**. The shop price is their price plus the patong. For example, a muffin at ₱50 from the partner with a ₱10 patong sells for ₱60, and Rowszein owes the partner ₱50 for each one sold.

The whole order, partner items included, is recorded in the Sales register, so recorded sales match what the customer paid. The app works out the split.

The shop is online only. There is no physical counter; the Sales register is where the owner or staff record an order once it's confirmed on Messenger.

## Goals

1. The owner can add a partner and their items, and switch either on or off.
2. The public shop shows partner items, credited to the partner, and customers can add them to the same order as donuts.
3. Partner items can be recorded in the Sales register like any donut.
4. The owner can see exactly what is owed to each partner for any date range, item by item.
5. The owner can record payments to a partner and always see what is still to pay.
6. The profit report counts only Rowszein's share of partner sales.

## Non-goals (first version)

* Partners signing in or managing their own items.
* Tracking how many items a partner dropped off (stock counts). The owner switches an item off when it runs out, as with donuts.
* Percentage splits. Only a fixed amount per item.
* Partner items inside boxes.

## Anti-goals (would make this a failure even if it works)

* A partner item that silently lowers pantry stock, or a donut that skips it.
* The amount owed to a partner changing after the fact because an item's payout rate was edited.
* Profit shown as if Rowszein kept the whole price of a partner item.
* A shop that looks like a marketplace instead of Rowszein's pâtisserie, with partners in the lead.
* Payouts entered as shop expenses as well, which would subtract them twice. The UI must say payouts are already accounted for.

## Approaches considered

1. **Partner records linked to items (chosen).** A `Partner` model; a product optionally belongs to a partner and carries a fixed payout per item. Each recorded sale line keeps the payout in force at that moment. A Partners page reports the amount owed; profit subtracts payouts. Reason: it's the only option that produces a trustworthy record of what is owed.
2. **Each partner as a category.** Cheapest, but a category can't hold contact details. The amount owed would be worked out by hand, and boxes and recipes couldn't tell partner items apart. Rejected.
3. **A separate "partner item" model with its own order path.** Cleanest separation, but it duplicates products, shop listing, sales recording and reporting. Rejected as over-built.

## How it works today (relevant facts)

* `products.Product`: name (unique), price, image, required `category`, `is_available`, `is_featured`, `box_extra`. Used by sales, recipes and boxes.
* Recording a sale (`sales/services.execute_sale`) is an audited, idempotent command. Original lines are immutable `SaleItem` rows. The current lines of an edited sale live in `Sale.current_items` (JSON snapshot), and money is posted to the immutable `SaleFinancialEntry` ledger.
* **Every line of a new or changed sale must have a recipe**, which then lowers pantry stock (`"New consumption requires an available product and a recipe."`). Partner items have no recipe, so today they cannot be sold.
* Profit = ledger net sales − expenses (`dashboard/views.DashboardView`). Best sellers come from `current_items` by original sale date.
* The shop lists products by category, builds boxes on the client (`useBoxOrder.ts`), and sends the order as a Messenger message plus an order-card image.

## Design

### Data

New model `products.Partner`:

| Field | Notes |
| --- | --- |
| `name` | Unique, shown publicly ("Kape Lokal") |
| `blurb` | Optional, one short public line ("Muffins from Kape Lokal, Marikina") |
| `contact` | Owner-only: phone, Messenger or email, free text |
| `notes` | Owner-only |
| `is_active` | Off hides the partner and all their items from the shop and the register's catalog |
| `sort_order`, timestamps | Like `Category` |

`Product` gains:
* `partner` — optional foreign key to `Partner` (`PROTECT`; a partner with items can't be deleted, only switched off).
* `partner_payout`: "their price", the amount paid to the partner per item sold, with 2 decimal places.
  * Required and greater than 0 when `partner` is set; must be 0 when not.
  * Must not exceed `price`, so the patong (`price − partner_payout`) is never negative.
  * Enforced by the serializer and a database check constraint.

The patong is not stored; it is always `price − partner_payout`, so the two can't disagree.

Partner items still have a `category` (for example "Muffins" or "Cakes"), because the field is required and categories stay useful for search. The owner creates those categories as needed.

New model `products.PartnerPayment` (money paid out to a partner):

| Field | Notes |
| --- | --- |
| `partner` | Foreign key, `PROTECT` |
| `date` | The date it was paid (Asia/Manila business date), not in the future |
| `amount` | Greater than 0, 2 decimal places (check constraint) |
| `note` | Optional, for example "GCash ref 1234" |
| `recorded_by` | The user who recorded it |
| `created_at` | Timestamp |
| `voided_at`, `voided_by`, `void_reason` | Set once to cancel a payment entered by mistake; the row is never deleted or edited otherwise |

A payment is never deleted; voiding needs a reason and can happen once. This mirrors how sales are kept.

Migration: one new `products` migration (two new tables, two new columns, constraints). Existing products get `partner = NULL`, `partner_payout = 0`.

### Rules for partner items

* **Boxes:** rejected in ready-made boxes (`AssortmentSerializer.validate`). The shop never offers them while filling a box.
* **Recipes:** a recipe can't be created for a partner item (recipe serializer validation; the Recipe form hides them).
* **Box extra:** forced to 0 and hidden on the item form for partner items.
* **Recording sales:** in `execute_sale`, lines for partner items **skip** the recipe and stock step entirely. Donut lines keep the existing rule unchanged. Partner lines don't create `ConsumptionBasis` or `SaleConsumption` rows and touch no ingredient.
* **Payout snapshot:** each line in `Sale.current_items` gains `partner` (id or null) and `partner_payout` (money text, "0.00" for donuts):
  * **New lines** take the product's current values.
  * **Lines kept or re-quantified in an edit** keep their earlier snapshot. The rate in force when the item was first sold stays, so editing the rate never changes what is owed.
  * **Older sales** without these keys count as payout 0, which is correct because partners didn't exist.

  `SaleItem` (immutable originals) is **not** changed; `current_items` is already the source the reports use.
* The request fingerprint (`_intent`) doesn't change: the payout is derived on the server, never sent by the client.

### What is owed, and profit

New read-only report function `sales/reporting.partner_payouts(date_from, date_to)`:
* It covers sales with `status='recorded'` whose **original sale date** is in range, the same basis as best sellers.
* It sums `quantity × partner_payout` from `current_items`, grouped by partner and item.
* Cancelled sales are excluded. A cancelled order is owed nothing because it wasn't delivered.

**Still to pay** per partner = owed on all recorded sales up to today − all payments that aren't voided. A negative result is shown as "Paid ahead". The figure follows edits and cancellations automatically, because "owed" is always recalculated from current sales.

Payments are **not** expenses and don't affect profit: profit already subtracts what's owed when the sale happens, so counting the payment too would subtract it twice.

Profit becomes **net sales − partner payouts − expenses**, in the totals, this month, and each month of the chart. The response gains `totals.partner_payouts` and per-month `payouts`.

*Known difference, accepted:* net sales are dated by when money was posted (an edit made on a later day posts on that day), while payouts are dated by the original sale date. For a whole month these agree unless an order is edited across a month end. The Partners page states which date it uses.

`ProfitMarginView`: for partner items, the "production cost" is their price (the payout), so the profit per unit is the patong; `has_recipe` stays false. A new `is_partner` flag lets the Recipe costing page show "Partner item · your patong ₱10" instead of "No recipe yet".

### API

* `GET/POST /api/products/partners/`, `GET/PATCH/DELETE /api/products/partners/<id>/`: owner manages, staff read (same permission pattern as box sizes).
* Product endpoints: `partner` (id) and `partner_payout` writable by the owner. Read responses add `partner: {id, name}`. `partner_payout` and `contact` are **never** in public or staff responses (supplier and cost data, per the review's control 8.12).
* Public product listing hides items whose partner is switched off (`partner__is_active`). It gains a `partner` filter (an id, or `none` for Rowszein's own) so the shop can ask for each section.
* `GET /api/products/partners/payouts/?date_from&date_to` (owner only, `finance.read`): amount owed per partner with an item breakdown and totals for the range, plus each partner's all-time **still to pay**.
* `GET/POST /api/products/partners/<id>/payments/` (owner only): the partner's payments, newest first, paginated, and recording a new one. `POST /api/products/partners/<id>/payments/<payment_id>/void/` with `reason` (owner only); voiding twice returns 409. No PATCH or DELETE.
* The dashboard response adds the payout fields described above.

### Owner screens

* **Partners** (new page under Donut collection, like Boxes): a list of partners with on/off switches, plus add and edit forms for name, public line, contact and notes. Each partner shows their items, with a link to add one.
* **Item form** (existing ProductFormPage): a "Made by" choice ("Rowszein's Delight", or a partner). Picking a partner swaps the single price field for "Their price" (what you pay the partner per item) and "Your patong" (your charge on top, ₱0 or more), with a live line "Sells for ₱60.00 in the shop". It also hides "Extra when in a box". The API still receives `price` (their price + patong) and `partner_payout` (their price). When the form loads, it shows patong as `price − partner_payout`.
* **Amount owed** (on the Partners page): a date range (this week, this month, last month, custom), then each partner's total with item lines (item, quantity sold, payout each, owed), plus a printable or CSV export using the existing export helper. The note reads: "Counted by order date. Cancelled orders aren't included. Don't also enter these as shop expenses; profit already subtracts them."
* **Payments** (on each partner): a "Still to pay ₱1,350" figure (or "Paid ahead ₱200"), a "Record a payment" form (date defaulting to today, amount, note) with inline validation, and the list of payments. A voided payment stays in the list, crossed out, showing its reason. "Void" asks for the reason in a dialog.
* **Profit & analytics:** the sentence becomes "kept, from ₱48,200 sold, ₱3,100 owed to partners and ₱21,000 spent".
* **Sales register:** partner items appear in the catalog under their partner's name, with a small "by Kape Lokal" on the ticket. Selling them works like donuts.

### Public shop

The look, layout and order flow stay as they are.
* **Display case:** after Rowszein's own categories, one section per active partner with items on sale. The heading reads "From our friends · Kape Lokal", with the partner's public line under it. Cards are the same as donut cards, minus box behaviour.
* **Filter chips:** after the category chips, one "From our friends" chip shows all partner sections.
* **While filling a box:** partner items stay visible but can't be tapped into the box. They're dimmed and show "Not in boxes", with that reason in the accessible label.
* **Order sheet, order card and Messenger text:** partner items are listed as single items, with "by Kape Lokal" under the name. In the Messenger text: "Banana muffin (by Kape Lokal) × 2".
* **Featured row:** partner items can be featured like donuts.

## Failure modes

* Partner switched off with orders still being recorded: the owner can still record sales for its items (history and in-flight Messenger orders), but they no longer show in the shop. Staff see them only while the partner is active.
* Payout rate changed: affects only new sale lines; existing lines keep their snapshot (tested).
* Negative patong (shop price below their price): rejected, with the message "Your patong can't be less than ₱0" shown next to the patong field.
* Partner deleted with items: refused (`PROTECT`); the owner switches it off instead.
* An item moved from a partner back to Rowszein: allowed only if it has no recipe conflict. Old sale lines keep their snapshot.

## Testing

* Backend TDD for:
  * partner CRUD and permissions
  * the payout validation rules and the database constraint
  * no recipe for partner items, and no partner items in boxes
  * `execute_sale` behaviour:
    * a mixed sale lowers stock only for donuts
    * a partner-only sale needs no recipe
    * an edit keeps payout snapshots
    * a rate change doesn't alter earlier lines
    * a cancellation drops the line from the amount owed
  * `partner_payouts` totals
  * payments:
    * recording, validation (amount > 0, no future date) and owner-only access
    * voiding once with a reason (twice returns 409)
    * no edit or delete
    * still to pay, including after a sale is edited or cancelled, and "paid ahead"
  * dashboard profit subtracting payouts
  * public listing hiding switched-off partners
  * payout and contact never appearing in public or staff responses
* Frontend:
  * type check, lint, regression scripts, and a regression test for order text and box rules with partner items
  * a browser check at 375 and 1440 px of the shop (partner section, box filling, order card), the Partners page, the item form and Profit & analytics
  * axe accessibility check: 0 WCAG 2.2 AA violations

## Left to the builder

Exact copy, icons and spacing within the existing design tokens. Partner sort order in the shop (by `sort_order`, then name). Whether "Amount owed" is a tab or a section of the Partners page.
