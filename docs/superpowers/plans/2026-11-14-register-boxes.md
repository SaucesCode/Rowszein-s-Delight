# Boxes in the Sales Register Implementation Plan (with the flavour rule)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every box follows the owner's flavour rule (up to N flavours per size, filled evenly), and boxes can be recorded in the Sales register, priced and snapshotted, with pantry stock taken per donut and shown in history, exports and reports.

**Architecture:**
* `BoxSize.max_flavors` and one shared `even_split` / `follows_flavour_rule` in `products/boxes.py` are used by the server everywhere: ready-made boxes, shop readiness and register box lines. They're mirrored by `frontend/src/lib/boxRule.ts` for the shop, the builder and the register.
* `Sale.current_boxes` (JSON) holds box-line snapshots. `execute_sale` merges box contents into its per-product quantities, so the existing stock, ledger and audit logic handles boxes unchanged.

**Tech Stack:** Django 5.2 / DRF 3.18; React 19, TS, TanStack Query, Zod.

**Spec:** `docs/superpowers/specs/2026-11-14-register-boxes-design.md` (including "Revision: the flavour rule")

## Global Constraints

* **Backend tests:** `cd backend && .venv/Scripts/python.exe manage.py test --settings=backend.test_settings`. Frontend: `cd frontend && npx tsc -b && npx eslint src && npx vite build` plus every `node tests/regression/*.mjs`.
* **Flavour rule:**
  * `even_split(size, k)`: each flavour gets `size // k`, and the first `size % k` flavours (in pick order) one more.
  * A box is valid when it has 1 ≤ k ≤ `max_flavors` distinct donuts and its sorted quantities equal `sorted(even_split(size, k))`.
  * `max_flavors` is between 1 and min(size, 12). Migration defaults: size ≤ 8 → 2, ≤ 12 → 3, else 4.
  * Message: "A box of {size} takes up to {n} flavours, filled evenly."
* **Box price:** shop price = `box_size.price + Σ(product.box_extra × quantity)`. Staff must use the shop price; the owner may set any price > ₱0. The price is fixed at the sale.
* **Box contents:** no partner items; every donut must exist and be available; at most 50 boxes per sale. Staff need the size or ready-made box to be on sale; the owner doesn't. The flavour rule applies to everyone.
* **Saved boxes:** an edit keeps a box by `key` or drops it; a kept box's contents and price can't change.
* **A sale needs at least one item line or box:** "Add at least one item or box."
* **Money:** `Decimal` with 2 places, sent as text via `sales.inventory_math.money_text`. The frontend sums in centavos.
* **Copy:** "Add a box", "Add box to sale", "Cancel box", "Not in boxes", "This box takes up to {n} flavours", "Most flavours", "Doesn't follow the flavour rule: shop hides it", "Finish or cancel the box to add single items.", "boxes sold".
* **Process:** commit after each task; never push or deploy.

## Review Focus

1. **Remove the only box in an edit, with no items left:** 400 "Add at least one item or box." (Task 4)
2. **The same donut sold singly and inside a box:** stock comes off for both, and a cancel returns both. (Task 4)
3. **A PATCH that sends only `sale_items`** keeps every box unchanged. (Task 4)
4. **The owner lowers `max_flavors` after a ready-made box exists:** the shop hides it, the register refuses it, and the Boxes page flags it. (Tasks 1 and 3)
5. **An uneven box sent straight to the API** (7 + 1 in a Box of 8): refused for owner and staff alike. (Task 3)

---

### Task 1: The flavour rule on box sizes and ready-made boxes

**Files:**
- Modify: `backend/products/models.py` (`BoxSize.max_flavors = PositiveSmallIntegerField(default=2)` plus a check constraint `max_flavors >= 1`), `backend/products/boxes.py`, `backend/products/serializers.py` (`BoxSizeSerializer`, `AssortmentSerializer.validate`, `PublicBoxSizeSerializer`)
- Create: `backend/products/migrations/0007_boxsize_max_flavors.py` (add the field and a data step setting the defaults by size)
- Test: `backend/products/test_flavour_rule.py` (new)

**Interfaces:**
- Produces, in `products/boxes.py`:
  * `even_split(size: int, k: int) -> list[int]`
  * `follows_flavour_rule(size: int, max_flavors: int, quantities: list[int]) -> bool`
  * `flavour_rule_message(size: int, max_flavors: int) -> str`
  * `is_shop_ready` also requires `follows_flavour_rule`
  * `AssortmentSerializer` exposes `follows_rule: bool`
  * `BoxSizeSerializer` and `PublicBoxSizeSerializer` expose `max_flavors`
- [ ] **Step 1: Failing tests:**
  * `test_even_split`: (12, 3) → [4,4,4]; (10, 3) → [4,3,3]; (8, 1) → [8]; (24, 4) → [6,6,6,6]
  * `test_follows_rule`: [4,4] with max 2 → True; [7,1] → False; [3,3,2] in a Box of 8 with max 2 → False
  * `test_max_flavors_validated`: 0 → 400; 13 → 400; more than the size → 400, with message "Choose 1 to {n} flavours."
  * `test_ready_made_must_follow_rule`: 400 on `contents` with the rule message
  * `test_lowering_limit_hides_ready_made_from_shop_and_flags_it`: `follows_rule` becomes False and `/api/products/boxes/` omits it
  * `test_migration_defaults` (test the data function directly: 8→2, 12→3, 24→4, 6→2)
- [ ] **Step 2: Run** `manage.py test products.test_flavour_rule --settings=backend.test_settings`. Expected: FAIL.
- [ ] **Step 3: Implement.** **Step 4: Run** (PASS) plus the full suite. Existing box tests whose contents break the default rule must be updated to valid contents; record each change as a ruling.
- [ ] **Step 5: Commit:** `feat(boxes): flavour limit per box size, filled evenly`.

### Task 2: Sale box field and request validation

**Files:**
- Modify: `backend/sales/models.py` (`Sale.current_boxes = JSONField(null=True, blank=True, default=None)`), `backend/sales/serializers.py`
- Create: the migration via `makemigrations sales --name sale_current_boxes`
- Test: `backend/sales/test_register_boxes.py` (new; reuse `sales.test_partner_sales.PartnerSalesFixture`)

**Interfaces:**
- Produces:
  * `BoxContentInputSerializer(product: PK Product, quantity: Integer 1..48)`.
  * `SaleBoxInputSerializer`, fields:
    * `key`: Char, max 64, optional
    * `box_size`: PK BoxSize, optional
    * `assortment`: PK Assortment, optional
    * `contents`: list, max 12 entries, optional
    * `price`: Decimal(10, 2), > 0, optional
  * `SaleSerializer.boxes = SaleBoxInputSerializer(many=True, required=False, max_length=50)`; `sale_items` becomes `required=False`.
  * Validated entries reach the service as dicts (model instances for the primary keys; missing keys are absent).
- [ ] **Step 1: Failing tests** (`BoxRequestValidationTests`, posting to `/api/sales/` with the owner `SessionClient`):
  * `test_box_entry_needs_exactly_one_of_key_size_or_ready_made`: message "Choose a box size or a ready-made box."
  * `test_contents_only_with_a_box_size`: message "Only a box size takes contents."
  * `test_kept_box_cannot_be_repriced`: message "A saved box keeps its price."
  * `test_sale_needs_an_item_or_a_box`: message "Add at least one item or box."
  * `test_more_than_fifty_boxes_refused`
- [ ] **Steps 2–4:** run (FAIL), implement, run (PASS) plus the full suite.
- [ ] **Step 5: Commit:** `feat(boxes): box lines on sales — field and request validation`.

### Task 3: Box line pricing and validation

**Files:**
- Create: `backend/sales/box_lines.py`
- Test: `backend/sales/test_register_boxes.py` (`BoxLineTests`)

**Interfaces:**
- Consumes: Task 1 (`follows_flavour_rule`, `flavour_rule_message`, `is_complete`), Task 2 entries.
- Produces:
  * `shop_box_price(box_size: BoxSize, contents: list[tuple[Product, int]]) -> Decimal`
  * `new_box_line(entry: dict, products: dict[int, Product], role: str) -> dict`, returning a snapshot of the form:
    ```
    {key: uuid4().hex, box_size_id, size, assortment_id | None,
     name: "Box of 12" | assortment.name,
     price: money text,
     contents: [{product, product_name, quantity, box_extra: money text}]}   # contents sorted by product
    ```
    It raises `ValidationError({'boxes': message})`.
  * `box_quantities(boxes: list[dict]) -> dict[int, int]`
  * `boxes_total(boxes: list[dict]) -> Decimal`
- [ ] **Step 1: Failing tests:**
  * `test_shop_price_adds_premium_extras`: a Box of 12 at ₱400 with 4 Ube at ₱10 extra → `Decimal('440.00')`
  * `test_uneven_or_too_many_flavours_refused_for_owner_and_staff` (Review Focus 5), with the rule message
  * `test_partner_item_refused`: "Banana muffin is a partner item and can't go in a box."
  * `test_unavailable_donut_refused`: "Test donut isn't available."
  * `test_donut_listed_twice_refused`: "List each donut once."
  * `test_staff_must_use_shop_price`: "Staff must use the shop's box price."
  * `test_staff_cannot_use_off_sale_size`: "That box isn't on sale."
  * `test_owner_may_discount_and_use_off_sale_size`
  * `test_ready_made_copies_contents_and_price`
  * `test_ready_made_breaking_rule_refused` (Review Focus 4): "That ready-made box doesn't follow the flavour rule. Fix it on the Boxes page."
  * `test_box_quantities_and_total_merge_boxes`
- [ ] **Steps 2–4:** run (FAIL), implement (look content products up in the locked `products` map), run (PASS) plus the full suite.
- [ ] **Step 5: Commit:** `feat(boxes): price and validate box lines`.

### Task 4: Boxes in the sale command

**Files:**
- Modify: `backend/sales/services.py` (`_items`, `_intent`, `sale_data`, `execute_sale`)
- Test: `backend/sales/test_register_boxes.py` (`BoxSaleTests`)

**Interfaces:**
- Produces:
  * `sale_data(sale)` adds `'boxes': current_boxes(sale)`. `total_amount` is items plus boxes (for `current_items is None` it stays `sale.total_amount`).
  * `current_boxes(sale) -> list[dict]`
- [ ] **Step 1: Failing tests** (Box of 12, `max_flavors` 3, at ₱400; donuts with recipes; Ube `box_extra` ₱10):
  * `test_box_only_sale_posts_money_and_takes_stock_per_donut`
  * `test_mixed_sale_items_box_and_partner_item`
  * `test_same_donut_single_and_in_box_both_take_stock_and_cancel_returns_both` (Review Focus 2)
  * `test_edit_keeping_box_by_key_leaves_snapshot_and_stock`
  * `test_patch_with_only_items_keeps_boxes` (Review Focus 3)
  * `test_edit_removing_box_returns_its_stock_and_posts_adjustment`
  * `test_removing_the_only_line_refused` (Review Focus 1)
  * `test_unknown_box_key_refused`: "This box is no longer on the sale. Reload and try again."
  * `test_box_price_fixed_after_size_extra_and_ready_made_change`
  * `test_idempotent_replay_of_box_sale_and_conflict_on_different_box`
  * `test_staff_box_sale_today_at_shop_price`
  * `test_legacy_sale_refuses_boxes` (409)
- [ ] **Step 3: Implement:**
  * **Locking:** add box content product ids (old and new) to `product_ids` before locking.
  * **`_items`:** returns `[]` when there are no lines.
  * **Box lists:** build `new_boxes`. Kept keys copy the old snapshot; new entries go through `new_box_line`; omitted means keep the old boxes; a cancel uses `[]` for quantities and amounts.
  * **Quantities:** item quantities plus `box_quantities`. Use `old_partner.get(pk)`.
  * **Amounts:** add `boxes_total`.
  * **Empty sale:** a non-cancel with no lines is refused.
  * **Saving:** save `current_boxes` on create and update.
  * **`_intent`:** includes boxes.
  * **Legacy branch:** refuses `boxes`.
- [ ] **Steps 2 and 4:** run (FAIL), then the box tests plus the full suite (PASS, existing tests unchanged).
- [ ] **Step 5: Commit:** `feat(boxes): record boxes in the sale command`.

### Task 5: Reports and exports

**Files:** Modify `backend/sales/reporting.py`, `backend/dashboard/views.py`, `backend/sales/views.py`. Test: `BoxReportTests`.

**Interfaces:**
- Produces:
  * `boxes_summary(date_from, date_to) -> {'count': int, 'revenue': str}`; the dashboard adds `data['boxes']`.
  * Best sellers include donuts in boxes (quantity only).
  * `describe_sale_lines(sale_payload: dict) -> str`, e.g. `"Glazed Original x2, Box of 12 (4 Glazed Original, 4 Ube Cream, 4 Choco Dip)"`, used by the CSV and PDF. The PDF builds its lines from `sale_data`.
- [ ] **Tests:**
  * `test_boxes_summary_counts_recorded_boxes_by_order_date` (cancelled excluded)
  * `test_best_sellers_include_donuts_inside_boxes`
  * `test_csv_lists_boxes_with_contents`
  * `test_pdf_uses_current_lines`
- [ ] **Steps:** run (FAIL), implement, run (PASS) plus the full suite. **Commit:** `feat(boxes): boxes in reports and exports`.

### Task 6: Frontend flavour rule and box ticket model

**Files:**
- Create: `frontend/src/lib/boxRule.ts`, `frontend/src/pages/sales/boxTicket.ts`
- Modify: `frontend/src/types/sale.types.ts`, `frontend/src/types/box.types.ts` (`max_flavors`, `follows_rule`), `frontend/src/pages/sales/useTicket.ts`, `frontend/src/services/dashboard.service.ts`
- Test: `tests/regression/test_register_boxes.mjs` (new)

**Interfaces:**
- Produces:
  * **`boxRule.ts`:**
    * `evenSplit(size, k) -> number[]`
    * `fillEvenly(size, flavours: T[]) -> {item: T, quantity: number}[]`, in pick order
    * `canPickMore(maxFlavors, picked) -> boolean`
  * **Types:**
    * `SaleBox` (mirrors the snapshot)
    * `Sale.boxes?`
    * `SaleBoxPayload = {key} | {box_size, contents, price?} | {assortment, price?}`
    * `SalePayload.boxes?`
  * **`boxTicket.ts`:**
    * `OpenBox {boxSizeId, size, maxFlavors, basePrice, name, flavours: Flavour[]}`
    * `Flavour {product, name, boxExtra}`
    * `toggleFlavour(box, product) -> OpenBox | {error}`, with errors "Not in boxes" and "This box takes up to {n} flavours"
    * `openBoxContents(box) -> BoxDonut[]` (via `fillEvenly`)
    * `openBoxPrice(box)` (centavo-exact)
    * `TicketBox {key?, boxSizeId?, assortmentId?, name, size, price, shopPrice, contents: BoxDonut[], saved}`
    * `closeOpenBox`, `readyMadeBox`, `savedBox`
    * `boxPayload(box) -> SaleBoxPayload` (sends `price` only when it differs from the shop price)
  * **`useTicket`** gains `boxes`, `openBox`, `startBox`, `toggleInBox`, `finishBox`, `cancelBox`, `addReadyMade`, `removeBox`, `setBoxPrice`. `totals` includes boxes and a `boxes` count.
- [ ] **Failing regression tests:**
  * `evenSplit` cases, matching the backend
  * a toggle up to the limit, then the limit error
  * a partner item refused
  * unpicking a flavour refills evenly
  * price with extras = 440
  * `boxPayload`: a saved box sends `{key}`; a discounted box sends `price`; an unchanged ready-made box sends `{assortment}` only
- [ ] **Steps:** run (FAIL), implement, run (PASS) plus `tsc`. **Commit:** `feat(boxes): flavour rule and register box model`.

### Task 7: Shop and Boxes page follow the flavour rule

**Files:**
- Modify:
  * `frontend/src/pages/shop/useBoxOrder.ts`: `filling` becomes `{size, boxPrice, maxFlavors, flavours}`. Donuts are derived with `fillEvenly`. Toggling a flavour replaces tap-to-add. Stored orders of the old shape are cleared on load.
  * `FillingDock.tsx`, `PastryCase.tsx`: at the limit, tiles not picked are dimmed with "This box takes up to {n} flavours" in text and `aria-disabled`; picked tiles show ✓ and can be unpicked.
  * `ShopPage.tsx`
  * `frontend/src/pages/BoxesPage.tsx`: a "Most flavours" input per size, and the ready-made status "Doesn't follow the flavour rule: shop hides it".
  * `frontend/src/pages/AssortmentFormPage.tsx`: pick flavours up to the limit; the box fills evenly.
- Test: extend `tests/regression/test_partner_shop.mjs` (or a new `test_box_order.mjs`) with the old-storage reset, toggle and derived donuts.
- [ ] **Failing tests → implement → pass.**
- [ ] **Browser check** (simulated API; Chromium 375 and 1440 px, plus WebKit iPhone):
  * Shop: fill a Box of 8 with 2 flavours (4 + 4); the third flavour is dimmed; unpicking refills.
  * Boxes page: set the limit; a rule-breaking ready-made box is flagged.
  * Builder: flavour picking.
  * axe 0; CSP 0.
- [ ] **Commit:** `feat(boxes): shop and box builder follow the flavour rule`.

### Task 8: Register box UI

**Files:**
- Create: `frontend/src/pages/sales/RegisterBoxChooser.tsx`, `frontend/src/pages/sales/OpenBoxPanel.tsx`
- Modify: `frontend/src/pages/SaleFormPage.tsx`, `TicketPanel.tsx`, `Catalog.tsx`, `sales.css`
- [ ] **Build to the spec:**
  * **Chooser:** a `<dialog>` with focus trap and return, listing on-sale sizes and ready-made boxes that are complete and follow the rule. The owner also sees off-sale ones ("Off sale").
  * **Open-box panel:** picked flavours with their even counts, "7 of 12" (always full once picked), "Add box to sale", and "Cancel box" (confirm).
  * **Catalog:** while a box is open, a tap toggles a flavour; at the limit, other tiles show the limit text; partner tiles show "Not in boxes". Taps are announced.
  * **Ticket box lines:** contents, an owner-editable price, and remove.
  * **Count:** "1 box, 3 donuts".
  * **Edit:** loads `sale.boxes`.
  * **Zod:** allows a boxes-only sale.
  * **Phone dock:** "Box of 12 · 3 flavours" while open.
- [ ] **Browser check** (Chromium 375 and 1440 px, plus WebKit):
  * fill with flavours; hit the limit; try a partner; add a ready-made box; owner discount; submit; assert the POST payload;
  * keyboard-only;
  * axe 0; CSP 0.
- [ ] **Commit:** `feat(boxes): add boxes in the Sales register`.

### Task 9: Receipt, history and Analytics

**Files:** Modify `frontend/src/pages/sales/Receipt.tsx`, `frontend/src/pages/SalesPage.tsx` (search matches box names and contents), `frontend/src/pages/DashboardPage.tsx` ("18 boxes sold · ₱7,200.00" when count > 0).
- [ ] **Implement**, with a browser check at 375 and 1440 px. **Commit:** `feat(boxes): boxes on receipts, history and analytics`.

### Task 10: Finish

- [ ] Full backend suite, frontend checks and regression scripts, a WebKit run. Record the counts.
- [ ] README: replace "Selling boxes at the counter … is not built yet." with a "Boxes in the Sales register" paragraph and the flavour rule in "How boxes work". Set the spec status to "built". Remind the owner that local and live databases need migrations `products/0007` and the sales box migration.
- [ ] **Commit:** `docs: boxes in the Sales register and the flavour rule`. Then one whole-branch review and test-first fixes of its Critical and Important findings.
