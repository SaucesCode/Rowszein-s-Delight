# Boxes in the Sales Register Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record boxes (a filled size or a ready-made box) on sales: priced, snapshotted, with pantry stock taken per donut, shown in history, exports and reports.

**Architecture:**
* `Sale.current_boxes` (JSON) holds box-line snapshots next to `current_items`.
* A new `sales/box_lines.py` prices and validates new boxes.
* `execute_sale` merges box contents into its per-product quantities, so the existing stock, ledger and audit machinery handles boxes unchanged.
* On the frontend, pure box-ticket helpers drive a box chooser, an open-box panel and box lines in the existing register.

**Tech Stack:** Django 5.2 / DRF 3.18; React 19, TS, TanStack Query, Zod.

**Spec:** `docs/superpowers/specs/2026-11-14-register-boxes-design.md`

## Global Constraints

* **Backend tests:** `cd backend && .venv/Scripts/python.exe manage.py test --settings=backend.test_settings`. Frontend: `cd frontend && npx tsc -b && npx eslint src && npx vite build` and every `node tests/regression/*.mjs`.
* **Money:** `Decimal` with 2 places, serialized as text via `sales.inventory_math.money_text`. Frontend sums in centavos.
* **Box price:** shop price = `box_size.price + Σ(product.box_extra × quantity)`. Staff must use exactly the shop price. The owner may set any price > ₱0. The price is fixed at the sale.
* **Box contents:** must total exactly the size; no partner items; every donut must exist and be available; at most 48 donuts per box; at most 50 boxes per sale. Staff need the size or ready-made box to be on sale (`is_available`); the owner doesn't.
* **Saved boxes:** never change after they're recorded. An edit may keep a box by `key` or drop it; new boxes are added; contents of a kept box can't change.
* **A sale needs at least one item line or box:** "Add at least one item or box."
* **Copy:** "Add a box", "Add box to sale", "Cancel box", "Not in boxes", "Finish or cancel the box to add single items.", "7 of 12", "boxes sold".
* **Partner payouts:** never in staff responses (unchanged).
* **Process:** commit after each task; never push or deploy.

## Review Focus

1. **Remove the only box in an edit, with no items left:** 400 "Add at least one item or box." Test lives in Task 3.
2. **The same donut sold singly and inside a box:** stock comes off for both; cancel returns both; editing the single line leaves the box's share alone. Task 3.
3. **A PATCH that sends only `sale_items`** (boxes omitted) keeps every box unchanged. Task 3.
4. **A kept box sent with a price or contents:** 400 at the serializer (a kept box can't be re-priced through the API). Task 1.
5. **A ready-made box that isn't full at sale time:** refused. One edited or deleted after the sale still shows its snapshot. Tasks 2 and 3.

---

### Task 1: Box field and request validation

**Files:**
- Modify: `backend/sales/models.py` (`Sale.current_boxes = models.JSONField(null=True, blank=True, default=None)`), `backend/sales/serializers.py`
- Create: `backend/sales/migrations/<next>_sale_current_boxes.py` via `makemigrations sales --name sale_current_boxes --settings=backend.test_settings`
- Test: `backend/sales/test_register_boxes.py` (new; reuse `sales.test_partner_sales.PartnerSalesFixture`)

**Interfaces:**
- Produces:
  * `BoxContentInputSerializer(product: PK Product, quantity: Integer 1..48)`.
  * `SaleBoxInputSerializer`, fields:
    * `key`: Char, max 64, optional
    * `box_size`: PK BoxSize, optional
    * `assortment`: PK Assortment, optional
    * `contents`: list of `BoxContentInputSerializer`, max 48 entries, optional
    * `price`: Decimal(10, 2), > 0, optional
  * `SaleSerializer.boxes = SaleBoxInputSerializer(many=True, required=False, max_length=50)`; `sale_items` becomes `required=False`.
  * Validated box entries reach the service as dicts with `key` (str), `box_size` (BoxSize), `assortment` (Assortment), `contents` (list of `{product: Product, quantity: int}`) and `price` (Decimal); absent fields are missing keys.
- [ ] **Step 1: Failing tests** (`BoxRequestValidationTests`, posting to `/api/sales/` with the owner's `SessionClient`):
  * `test_box_entry_needs_exactly_one_of_key_size_or_ready_made`: 400 on `boxes`, message "Choose a box size or a ready-made box."
  * `test_contents_only_with_a_box_size`: 400, message "Only a box size takes contents."
  * `test_kept_box_cannot_be_repriced`: `{key, price}` gives 400, message "A saved box keeps its price."
  * `test_sale_needs_an_item_or_a_box`: `{"date", "sale_items": []}` gives 400, message "Add at least one item or box."
  * `test_more_than_fifty_boxes_refused`: 400.
- [ ] **Step 2: Run** `manage.py test sales.test_register_boxes --settings=backend.test_settings`. Expected: FAIL.
- [ ] **Step 3: Implement** the field, migration and serializers.
  * `SaleSerializer.validate(attrs)`: when not partial, require items or boxes.
  * `validate_sale_items` keeps only the duplicate check.
- [ ] **Step 4: Run** the same tests (PASS) and the full suite (PASS).
- [ ] **Step 5: Commit:** `feat(boxes): box lines on sales — field and request validation`.

### Task 2: Box pricing and validation module

**Files:**
- Create: `backend/sales/box_lines.py`
- Test: `backend/sales/test_register_boxes.py` (`BoxLineTests`, calling the module directly)

**Interfaces:**
- Consumes: Task 1's validated entry dicts.
- Produces:
  * `shop_box_price(box_size: BoxSize, contents: list[tuple[Product, int]]) -> Decimal`
  * `new_box_line(entry: dict, products: dict[int, Product], role: str) -> dict`. It returns a snapshot of the form:
    ```
    {key: uuid4().hex, box_size_id, size, assortment_id | None,
     name: "Box of 12" | assortment.name,
     price: money text,
     contents: [{product, product_name, quantity, box_extra: money text}]}   # contents sorted by product
    ```
    It raises DRF `ValidationError({'boxes': message})`.
  * `box_quantities(boxes: list[dict]) -> dict[int, int]` (donuts per product across boxes)
  * `boxes_total(boxes: list[dict]) -> Decimal`
- [ ] **Step 1: Failing tests:**
  * `test_shop_price_adds_premium_extras`: size ₱400 with 4 Ube at extra ₱10 gives `Decimal('440.00')`.
  * `test_contents_must_fill_the_box`: message "A box of 12 needs exactly 12 donuts; this one has 11."
  * `test_partner_item_refused`: message "Banana muffin is a partner item and can't go in a box."
  * `test_unavailable_donut_refused`: message "Test donut isn't available."
  * `test_donut_listed_twice_refused`: message "List each donut once."
  * `test_staff_must_use_shop_price`: message "Staff must use the shop's box price."
  * `test_staff_cannot_use_off_sale_size`: message "That box isn't on sale."
  * `test_owner_may_discount_and_use_off_sale_size`
  * `test_ready_made_copies_contents_and_price`
  * `test_ready_made_that_isnt_full_refused`: message "That ready-made box isn't full."
  * `test_box_quantities_and_total_merge_boxes`
- [ ] **Step 2: Run.** Expected: FAIL (ImportError). **Step 3: Implement.** `products` is the locked product map from `execute_sale`; look up every content product there, not on the entry. **Step 4: Run** (PASS) plus the full suite.
- [ ] **Step 5: Commit:** `feat(boxes): price and validate box lines`.

### Task 3: Boxes in the sale command

**Files:**
- Modify: `backend/sales/services.py` (`_items`, `_intent`, `sale_data`, `execute_sale`)
- Test: `backend/sales/test_register_boxes.py` (`BoxSaleTests`)

**Interfaces:**
- Consumes: Task 2's functions.
- Produces:
  * `sale_data(sale)` adds `'boxes': sale.current_boxes or []`. `total_amount` is items plus boxes (for sales with `current_items is None`, it stays `sale.total_amount`).
  * `current_boxes(sale) -> list[dict]`, returning `sale.current_boxes or []`, for reports.
- [ ] **Step 1: Failing tests** (fixture: box size 12 at ₱400, own donuts with recipes, Ube with `box_extra` ₱10):
  * `test_box_only_sale_posts_money_and_takes_stock_per_donut`
  * `test_mixed_sale_items_box_and_partner_item`: total and ledger equal items + box + partner; stock only for donuts.
  * `test_same_donut_single_and_in_box_both_take_stock_and_cancel_returns_both` (Review Focus 2)
  * `test_edit_keeping_box_by_key_leaves_snapshot_and_stock`
  * `test_patch_with_only_items_keeps_boxes` (Review Focus 3)
  * `test_edit_removing_box_returns_its_stock_and_posts_adjustment`
  * `test_removing_the_only_line_refused` (Review Focus 1)
  * `test_unknown_box_key_refused`: message "This box is no longer on the sale. Reload and try again."
  * `test_box_price_fixed_after_size_extra_and_ready_made_change`, which also deletes the ready-made box afterwards (Review Focus 5)
  * `test_idempotent_replay_of_box_sale_and_conflict_on_different_box`
  * `test_staff_box_sale_today_at_shop_price`
  * `test_legacy_sale_refuses_boxes`: 409, same as items.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement:**
  * **Locking:** add old-box and new-box content product ids to `product_ids` before the products are locked.
  * **`_items`:** returns `[]` for no lines.
  * **Box lists:** build `new_boxes`. Kept keys copy the old snapshot; new entries go through `new_box_line`; `None` (omitted) keeps `old_boxes`; on cancel, `new_boxes = []` for quantities and amounts.
  * **Quantities:** `old_quantities` and `new_quantities` are the item quantities plus `box_quantities`. Use `old_partner.get(pk)` (box-only products have no item line).
  * **Amounts:** `old_amount` and `new_amount` add `boxes_total`.
  * **Empty sale:** a non-cancel with no items and no boxes is refused ("Add at least one item or box.").
  * **Saving:** save `current_boxes` on create and update (not on cancel).
  * **`_intent`:** gains `boxes`:
    * a kept box as `{key}`;
    * a new size box as `{box_size, contents: sorted [{product, quantity}], price?}`;
    * a ready-made box as `{assortment, price?}`.
  * **Legacy branch:** refuses `boxes` the same way it refuses `sale_items`.
- [ ] **Step 4: Run** the box tests and the full suite. Expected: PASS, with every existing sales and partner test unchanged.
- [ ] **Step 5: Commit:** `feat(boxes): record boxes in the sale command`.

### Task 4: Reports and exports

**Files:**
- Modify: `backend/sales/reporting.py`, `backend/dashboard/views.py` (product mix, new `boxes`), `backend/sales/views.py` (CSV and PDF)
- Test: `backend/sales/test_register_boxes.py` (`BoxReportTests`)

**Interfaces:**
- Produces:
  * `boxes_summary(date_from, date_to) -> {'count': int, 'revenue': str}`, over recorded sales by order date.
  * The dashboard adds `data['boxes']`.
  * `describe_sale_lines(sale_payload: dict) -> str`, the shared export text, e.g. `"Glazed Original x2, Box of 12 (4 Glazed Original, 4 Ube Cream, 4 Choco Dip)"`.
- [ ] **Step 1: Failing tests:**
  * `test_boxes_summary_counts_recorded_boxes_by_order_date`: a cancelled sale is excluded.
  * `test_best_sellers_include_donuts_inside_boxes`
  * `test_csv_lists_boxes_with_contents`
  * `test_pdf_uses_current_lines` (the PDF builds from `sale_data`; test through `describe_sale_lines` and a 200 response)
- [ ] **Step 2: Run** (FAIL). **Step 3: Implement.** **Step 4: Run** (PASS) plus the full suite. **Step 5: Commit:** `feat(boxes): boxes in reports and exports`.

### Task 5: Frontend box ticket model

**Files:**
- Create: `frontend/src/pages/sales/boxTicket.ts`
- Modify: `frontend/src/types/sale.types.ts`, `frontend/src/pages/sales/useTicket.ts`, `frontend/src/services/dashboard.service.ts` (`boxes`)
- Test: `tests/regression/test_register_boxes.mjs` (new)

**Interfaces:**
- Produces:
  * **Types:**
    * `SaleBox {key, box_size_id, size, assortment_id, name, price: string, contents: {product, product_name, quantity, box_extra: string}[]}`
    * `Sale.boxes?: SaleBox[]`
    * `SaleBoxPayload = {key} | {box_size, contents: {product, quantity}[], price?} | {assortment, price?}`
    * `SalePayload.boxes?`
  * **`boxTicket.ts`:**
    * `TicketBox {key?, boxSizeId?, assortmentId?, name, size, price: number, shopPrice: number, contents: BoxDonut[], saved: boolean}`
    * `OpenBox {boxSizeId, size, basePrice, name, contents: BoxDonut[]}`
    * `BoxDonut {product, name, quantity, boxExtra}`
    * `openBoxCount(box) -> number`
    * `openBoxPrice(box) -> number` (centavo-exact)
    * `addToOpenBox(box, product) -> OpenBox | { error: string }`. It returns errors "Not in boxes" for partner items and "This box is full" when full.
    * `changeInOpenBox(box, productId, delta) -> OpenBox`, clamped between 0 and the space left.
    * `closeOpenBox(box) -> TicketBox`, only callable when full.
    * `readyMadeBox(assortment) -> TicketBox`
    * `boxPayload(box: TicketBox) -> SaleBoxPayload`. It sends `price` only when it differs from `shopPrice`.
    * `savedBox(box: SaleBox) -> TicketBox`
  * **`useTicket`:** gains `boxes`, `openBox`, `startBox(size)`, `addToBox(product)`, `changeInBox(productId, delta)`, `finishBox()`, `cancelBox()`, `addReadyMade(assortment)`, `removeBox(index)` and `setBoxPrice(index, price)`. `totals.amount` includes boxes, and `totals.boxes` is the box count.
- [ ] **Step 1: Failing regression tests** (`test_register_boxes.mjs`):
  * price with extras: 4 Ube at ₱10 on ₱400 gives 440;
  * cannot overfill; partner refused; `−` to 0 removes the row;
  * `boxPayload`: a saved box gives `{key}`; a discounted filled box gives a payload with `price`; an unchanged ready-made box gives `{assortment}` only.
- [ ] **Step 2: Run** `node tests/regression/test_register_boxes.mjs`. Expected: FAIL. **Step 3: Implement.** **Step 4: Run** (PASS) plus `npx tsc -b`. **Step 5: Commit:** `feat(boxes): register box ticket model`.

### Task 6: Register box UI

**Files:**
- Create: `frontend/src/pages/sales/RegisterBoxChooser.tsx`, `frontend/src/pages/sales/OpenBoxPanel.tsx`
- Modify: `frontend/src/pages/SaleFormPage.tsx`, `frontend/src/pages/sales/TicketPanel.tsx`, `frontend/src/pages/sales/Catalog.tsx`, `frontend/src/pages/sales/sales.css`
- [ ] **Step 1: Build to the spec's Register section.**
  * **Chooser:** a `<dialog>` with focus trap and return, using `useBoxSizes()` and `useAssortments()` from `hooks/useBoxes.ts`. It lists on-sale sizes and complete ready-made boxes; the owner also sees off-sale ones labelled "Off sale".
  * **Open-box panel:** at the top of the ticket, with ± rows, "7 of 12", "Add box to sale" and "Cancel box" (with a confirm when it isn't empty).
  * **Catalog:** while a box is open, a tile tap adds to the box; partner tiles show "Not in boxes" and `aria-disabled`; a live announcement says what happened.
  * **Ticket box lines:** contents, owner-editable price, and remove.
  * **Count:** "1 box, 3 donuts", via the existing `countLabel` extended with a box count.
  * **Edit:** a sale loads `sale.boxes` as saved boxes.
  * **Phones:** the open box sits in the order drawer, and the register's dock shows "Box of 12 · 7 of 12" instead of the total while a box is open.
  * **Zod payload:** allows empty `sale_items` when boxes exist ("Add at least one item or box.").
- [ ] **Step 2:** frontend checks pass.
- [ ] **Step 3: Browser check** against the simulated API, extending the scratch `partners_check.py` with a `registerboxes` scenario:
  * Chromium at 375 and 1440 px, and WebKit (iPhone 13);
  * fill a box with ±, try a partner tile, add a ready-made box, edit the price as owner, submit, and assert the POST payload;
  * keyboard-only run;
  * axe: 0 violations; no CSP violations.
- [ ] **Step 4: Commit:** `feat(boxes): add boxes in the Sales register`.

### Task 7: Receipt, history and Analytics

**Files:** Modify `frontend/src/pages/sales/Receipt.tsx`, `frontend/src/pages/SalesPage.tsx` (search matches box names and contents), `frontend/src/pages/DashboardPage.tsx` ("18 boxes sold · ₱7,200.00", only when the count > 0).
- [ ] **Step 1: Implement**, with browser checks of the receipt, history search and Analytics at 375 and 1440 px.
- [ ] **Step 2:** checks pass. **Commit:** `feat(boxes): boxes on receipts, history and analytics`.

### Task 8: Finish

- [ ] **Step 1:** full backend suite, all frontend checks and regression scripts, a WebKit run of the box scenario, and local manual setup notes. Record the counts.
- [ ] **Step 2:** README: replace "Selling boxes at the counter … is not built yet." with a "Boxes in the Sales register" paragraph. Set the spec status to "built".
- [ ] **Step 3: Commit:** `docs: boxes in the Sales register`. Then run the single whole-branch review (one reviewer), and fix its Critical and Important findings test-first.
