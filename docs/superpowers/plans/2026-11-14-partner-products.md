# Partner Products Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the owner list collab partners' food in the shop at "their price + patong", sell it in the same orders and deliveries, see what each partner is owed, record payments, and count only the patong as Rowszein's money.

**Architecture:**
* **Products:** a `Partner` and a `PartnerPayment` model in the `products` app; `Product` gains an optional `partner` and a `partner_payout` ("their price").
* **Sales:** the existing audited sale command skips recipes and stock for partner lines, and snapshots `partner` and `partner_payout` into `Sale.current_items`.
* **Reporting:** read-only functions in `sales/reporting.py` compute amounts owed and still to pay; the dashboard subtracts payouts from profit.
* **Frontend:** a new owner Partners page; small changes to the item form, Sales register, Recipe costing, Analytics and the shop.

**Tech Stack:**
* Backend: Django 5.2, DRF 3.18.
* Frontend: React 19, TS, TanStack Query, React Hook Form + Zod, Tailwind v4 tokens.

**Spec:** `docs/superpowers/specs/2026-11-14-partner-products-design.md`

## Global Constraints

* **Backend tests:** `cd backend && .venv\Scripts\python.exe manage.py test --settings=backend.test_settings` (in-memory SQLite; never `migrate` against a real DB).
* **Frontend checks:** `cd frontend && npx tsc -b && npx eslint src && npx vite build`, and `node tests/regression/<file>.mjs` from the repo root.
* **API envelope:** success `{success: true, data, message}`; failure `{success: false, error}`; 400 for validation, 409 for conflicts.
* **Money:** `DecimalField(max_digits=10, decimal_places=2)`; money text via `sales.storage_precision`/`financial_math` helpers (`money_text`, `signed_money_text`); never floats in stored values.
* **Never shown publicly or to staff:** `partner_payout`, `Partner.contact` and `Partner.notes`. Staff and public serializers must not contain them.
* **Patong:** `price − partner_payout`, never stored; it must be ≥ 0. `partner_payout > 0` when a partner is set, `= 0` otherwise.
* **Stays donut-only:** partner items never go in ready-made boxes, the shop's box filling, or recipes; `box_extra` is forced to 0.
* **Copy:**
  * "Their price", "Your patong", "Sells for ₱60.00 in the shop", "From our friends · {name}", "by {name}", "Not in boxes".
  * "Still to pay", "Paid ahead", "Your patong can't be less than ₱0".
  * "Counted by order date. Cancelled orders aren't included. Don't also enter these as shop expenses; profit already subtracts them."
* **UI:** design tokens from `frontend/src/index.css` only; 44px touch targets; every action has loading, error and success states; respect reduced motion; WCAG 2.2 AA (axe: 0 violations).
* **Process:** commit after each task; never push or deploy.

## Review Focus

1. **Staff reading a sale must not see `partner_payout`.** That includes the stored idempotent replay body, which is built by `sale_data`. Test lives in Task 4.
2. **A rate change must not change earlier lines.** Editing an old sale after a rate change keeps the old payout on its existing lines; a partner line newly added in that edit takes the current rate. Test in Task 4.
3. **Switching an item between "own" and "partner" must be refused when it conflicts.** An own item that has a recipe or is in a ready-made box can't become a partner item. A partner item can become own; old sale lines keep their snapshot. Test in Task 2.
4. **A switched-off partner disappears from the shop, but in-flight orders still record.** Its items vanish from the public listing; the owner can still record them; staff get a clear 400. Tests in Tasks 2 and 4.
5. **Payment edge cases.** Amount 0 or negative and future dates → 400; voiding twice → 409; overpaying shows "Paid ahead", not an error; a voided payment no longer reduces still to pay. Tests in Tasks 5 and 6.

---

### Task 1: Partner models, product fields, migration, capability

**Files:**
- Modify: `backend/products/models.py` (add `Partner`, `PartnerPayment`; `Product.partner`, `Product.partner_payout`, constraints)
- Create: `backend/products/migrations/0006_partners.py` (generate with `manage.py makemigrations products --name partners --settings=backend.test_settings`; only `migrate` is refused by those settings)
- Modify: `backend/accounts/permissions.py:7` and `frontend/src/lib/permissions.ts:3` (add `partners.pay` to OWNER)
- Test: `backend/products/test_partners.py` (new)

**Interfaces:**
- Produces:
  * `Partner(name: unique CharField(100), blurb: CharField(160, blank), contact: CharField(200, blank), notes: TextField(blank), is_active: bool=True, sort_order: PositiveIntegerField=0, created_at, updated_at)`. Meta ordering `['sort_order', 'name']`.
  * `Product.partner = ForeignKey(Partner, null=True, blank=True, on_delete=PROTECT, related_name='products')`.
  * `Product.partner_payout = DecimalField(10, 2, default=Decimal('0.00'))`.
  * `PartnerPayment(partner FK PROTECT related_name='payments', date: DateField, amount: Decimal(10,2), note: CharField(200, blank), recorded_by FK User PROTECT related_name='+', created_at auto, voided_at null, voided_by FK User null PROTECT related_name='+', void_reason: CharField(200, blank))`. Ordering `['-date', '-id']`.
  * Capability `'partners.pay'` (owner only).

- [ ] **Step 1: Write failing tests** in `products/test_partners.py`, class `PartnerModelTests(TestCase)`:
  * `test_partner_item_needs_a_positive_payout`: `Product(partner=p, partner_payout=0, price=60, …).save()` raises `IntegrityError`.
  * `test_own_item_has_no_payout`: `partner=None, partner_payout=5` raises `IntegrityError`.
  * `test_patong_is_never_negative`: `partner=p, partner_payout=61, price=60` raises `IntegrityError`.
  * `test_partner_with_items_cannot_be_deleted`: `p.delete()` raises `ProtectedError`.
  * `test_payment_amount_must_be_positive`: `PartnerPayment(amount=0)` raises `IntegrityError`.
  * Wrap each `IntegrityError` assertion in `transaction.atomic()`.
- [ ] **Step 2: Run** `manage.py test products.test_partners --settings=backend.test_settings` → FAIL (ImportError on `Partner`).
- [ ] **Step 3: Implement the models.** Check constraints:
  * `product_partner_payout_rule`: `(partner__isnull=True & partner_payout=0) | (partner__isnull=False & partner_payout__gt=0 & partner_payout__lte=F('price'))`
  * `partner_payment_amount_positive`: `amount__gt=0`
  * `partner_payment_void_complete`: all three void fields null/blank together, or `voided_at` and `voided_by` both set with a non-empty `void_reason`

  Then run `makemigrations products --name partners` and add `'partners.pay'` to both OWNER sets.
- [ ] **Step 4: Run** the same test → PASS; run the full backend suite → all pass (153 + new).
- [ ] **Step 5: Commit** `feat(partners): partner and payment models with payout rules`.

### Task 2: Partner API and partner fields on products

**Files:**
- Modify: `backend/products/serializers.py`, `backend/products/views.py`, `backend/products/urls.py`, `backend/backend/catalog_listing.py:39-58`
- Test: `backend/products/test_partners.py` (add `PartnerApiTests`, `PartnerProductTests`; sign in with `accounts.session_fixtures.SessionClient`)

**Interfaces:**
- Consumes: Task 1 models.
- Produces:
  * `PartnerSerializer` (owner): all fields plus `product_count`.
  * `OperationalPartnerSerializer` (staff and public): `id, name, blurb, is_active, sort_order`.
  * `ProductSerializer` gains `partner` (nested `OperationalPartnerSerializer`, read), `partner_id` (write, `PrimaryKeyRelatedField(queryset=Partner.objects.all(), allow_null=True, required=False, source='partner')`) and `partner_payout`.
  * `OperationalProductSerializer` gains `partner` (nested operational, read) only.
  * Routes:
    * `partners/` → `PartnerListCreateView` (GET `catalog.read`, POST `catalog.manage`)
    * `partners/<int:pk>/` → `PartnerDetailView` (GET `catalog.read`, PATCH/PUT/DELETE `catalog.manage`)

    Both reuse `BoxCatalogView` and add a `CatalogProjection`-style switch to the operational serializer for non-admins. DELETE of a partner with items → 409, error "Kape Lokal has items. Switch the partner off instead."
  * Listing: `products` kind accepts `partner` = positive id or `none`. The public (anonymous) product queryset also filters `Q(partner__isnull=True) | Q(partner__is_active=True)`.

- [ ] **Step 1: Write failing tests:**
  * `test_owner_creates_and_lists_partners` (201, then listed with `product_count`).
  * `test_staff_sees_partner_without_contact_or_notes` (keys absent).
  * `test_staff_cannot_create_partner` (403).
  * `test_public_listing_hides_items_of_switched_off_partner`.
  * `test_listing_filters_by_partner_and_none`.
  * `test_partner_item_payout_never_in_public_or_staff_product_responses` (assert `'partner_payout' not in` each item, anonymous and staff).
  * `test_owner_creates_partner_item_with_patong` (`price=60, partner_payout=50` → 201, response `partner.name`).
  * `test_negative_patong_rejected_with_field_message` (`price=50, partner_payout=60` → 400, `error['partner_payout'] == ["Your patong can't be less than ₱0."]`).
  * `test_partner_item_requires_payout` (400 on `partner_payout`).
  * `test_partner_item_box_extra_forced_to_zero`.
  * `test_own_item_with_recipe_cannot_become_partner_item` (400 on `partner_id`: "This item has a recipe, so it's made here.").
  * `test_item_in_a_ready_made_box_cannot_become_partner_item` (400: "This item is in a ready-made box. Take it out first.").
  * `test_deleting_partner_with_items_returns_409`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** serializers, views, URLs and the listing filter. `ProductSerializer.validate(attrs)` merges with the instance to enforce: the payout rule, the patong message, `box_extra = 0` for partner items, and the recipe and box conflicts.
- [ ] **Step 4: Run** `products` tests → PASS; full suite → PASS.
- [ ] **Step 5: Commit** `feat(partners): partner API and partner fields on items`.

### Task 3: Keep partner items out of boxes and recipes

**Files:**
- Modify: `backend/products/serializers.py` (`AssortmentSerializer.validate`), `backend/recipes/serializers.py:53` (`validate_product`)
- Test: `backend/products/test_partners.py` (`PartnerExclusionTests`)

- [ ] **Step 1: Failing tests:**
  * `test_ready_made_box_rejects_partner_item`: 400 on `contents`, message "Banana muffin is a partner item and can't go in a box."
  * `test_recipe_rejected_for_partner_item`: 400 on `product`, message "Partner items are made by the partner, so they have no recipe."
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** both validations. **Step 4: Run** full suite → PASS.
- [ ] **Step 5: Commit** `feat(partners): keep partner items out of boxes and recipes`.

### Task 4: Record partner items in sales, with payout snapshots

**Files:**
- Modify: `backend/sales/services.py` (`_items`, `sale_data`, the recipe loop at lines 212-224, the staff policy at 196-200)
- Test: `backend/sales/test_partner_sales.py` (new; copy the `setUp` pattern from `sales/tests.py:30-33`, using `SessionClient`)

**Interfaces:**
- Produces: each `current_items` line includes `partner` (int | None) and `partner_payout` (money text, `"0.00"` for own items).
  * `sale_data(sale)` returns lines **without** `partner_payout` (it stays only in storage).
  * New helper `payout_lines(sale) -> list[dict]` returns `current_items(sale)` lines with `partner` and `Decimal partner_payout` (missing keys → `None`, `Decimal('0.00')`), for reporting.

- [ ] **Step 1: Failing tests:**
  * `test_partner_only_sale_needs_no_recipe_and_moves_no_stock`: 201; no `SaleConsumption` rows; ingredient quantities unchanged.
  * `test_mixed_sale_lowers_stock_only_for_donuts`.
  * `test_sale_snapshots_partner_payout`: stored `current_items` line has `partner_payout == "50.00"`.
  * `test_staff_never_sees_payout_in_sale_or_replay`: GET sale as staff, and replay the same POST with the same Idempotency-Key; `partner_payout` appears in neither body.
  * `test_rate_change_keeps_old_lines_and_new_line_uses_new_rate`: sell at 50; change the payout to 55; edit the sale to add 1 to the existing muffin line and add a second partner item → muffin keeps 50, the new item gets its current rate.
  * `test_staff_cannot_sell_items_of_switched_off_partner`: 400 with message "Kape Lokal is switched off."
  * `test_owner_can_still_record_switched_off_partner_items`: 201.
- [ ] **Step 2: Run** `manage.py test sales.test_partner_sales …` → FAIL.
- [ ] **Step 3: Implement:**
  * `_items(data, products, originals, snapshots)`, where `snapshots: dict[int, tuple[int | None, str]]` is built from `old_items` (a missing key → `(None, "0.00")`). Kept products use their snapshot; new ones use `(product.partner_id, money_text(product.partner_payout))`.
  * The recipe loop iterates only over `product.partner_id is None` products. Partner lines still require `product.is_available`.
  * The staff check adds the inactive-partner refusal.
  * `sale_data` drops `partner_payout` from each line.
  * Leave `_intent` unchanged.
- [ ] **Step 4: Run** `sales` tests and the full suite → PASS (existing sales tests unchanged).
- [ ] **Step 5: Commit** `feat(partners): sell partner items without recipes, snapshot payouts`.

### Task 5: What's owed, still to pay, and profit

**Files:**
- Modify: `backend/sales/reporting.py`, `backend/dashboard/views.py` (`DashboardView`, `ProfitMarginView`)
- Test: `backend/sales/test_partner_sales.py` (`PartnerReportingTests`), `backend/dashboard/tests.py`

**Interfaces:**
- Consumes: `payout_lines(sale)` from Task 4; `PartnerPayment` from Task 1.
- Produces:
  * `partner_payouts(date_from: date, date_to: date) -> dict` with shape:
    ```
    {partners: [{id, name, owed, items: [{product, product_name, quantity, payout, owed}]}],
     total, by_month: {"YYYY-MM": total}}
    ```
    All money is text. It covers `status='recorded'` sales by `Sale.date`.
  * `still_to_pay(partner_id: int, today: date) -> Decimal`: owed on all recorded sales with `date ≤ today`, minus non-voided payments.
  * The dashboard adds `totals.partner_payouts` and `this_month.partner_payouts`, and `payouts` in each `chart_data` row. `net_profit` and each month's `profit` subtract payouts.
  * `ProfitMarginView` adds `is_partner`; for partner items, `production_cost` is the payout.

- [ ] **Step 1: Failing tests:**
  * `test_payouts_grouped_by_partner_and_item`
  * `test_cancelled_sale_owes_nothing`
  * `test_payouts_counted_by_order_date`
  * `test_still_to_pay_follows_edits_and_ignores_voided_payments`
  * `test_overpayment_gives_negative_still_to_pay` (paid ahead)
  * `test_dashboard_profit_subtracts_partner_payouts`: one ₱520 sale with 2 muffins at payout 50 → `partner_payouts == "100.00"`; `net_profit == 420.0 - expenses`
  * `test_profit_margin_marks_partner_item_with_patong`
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** full suite → PASS.
- [ ] **Step 5: Commit** `feat(partners): amounts owed, still to pay, profit after payouts`.

### Task 6: Payouts report and payments API

**Files:**
- Modify: `backend/products/views.py`, `backend/products/urls.py`, `backend/products/serializers.py`
- Test: `backend/products/test_partners.py` (`PartnerPaymentApiTests`)

**Interfaces:**
- Produces:
  * `GET partners/payouts/?date_from&date_to` (`finance.read`; dates parsed with `backend.date_filters.report_date_bounds`) → `partner_payouts(...)` plus `still_to_pay` per partner.
  * `GET/POST partners/<id>/payments/` (GET `finance.read`, POST `partners.pay`; paginated like other lists; newest first).
  * `POST partners/<id>/payments/<payment_id>/void/` (`partners.pay`, body `{reason}`) → 200; already voided → 409 "This payment is already voided."; `reason` blank → 400.
  * `PartnerPaymentSerializer` fields: `id, date, amount, note, recorded_by_name, created_at, voided_at, void_reason`.
  * Validation: `amount > 0` ("Enter an amount above ₱0."); `date ≤` today in Asia/Manila ("The payment date can't be in the future.").
  * No PATCH or DELETE (405).

- [ ] **Step 1: Failing tests:**
  * `test_owner_records_payment_and_still_to_pay_drops`
  * `test_staff_cannot_see_or_record_payments` (403 both)
  * `test_zero_amount_and_future_date_rejected`
  * `test_void_needs_reason_and_happens_once`
  * `test_payments_cannot_be_edited_or_deleted` (405)
  * `test_payouts_endpoint_totals_and_still_to_pay`
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** full suite → PASS.
- [ ] **Step 5: Commit** `feat(partners): payouts report and partner payments`.

### Task 7: Frontend data layer

**Files:**
- Create: `frontend/src/types/partner.types.ts`, `frontend/src/services/partner.service.ts`, `frontend/src/hooks/usePartners.ts`
- Modify: `frontend/src/types/product.types.ts` (`Product.partner?: PartnerSummary | null`, `partner_payout?: string`, `ProductPayload.partner_id?: number | null`, `partner_payout?: number`), `frontend/src/services/dashboard.service.ts` (payout fields), `frontend/src/lib/permissions.ts` (route `/products/partners` → `catalog.manage`)
- Test: `tests/regression/test_permissions.mjs` (add a case: owner may visit `/products/partners`, staff may not)

**Interfaces:**
- Produces:
  * Types:
    * `PartnerSummary {id, name, blurb, is_active, sort_order}`
    * `Partner extends PartnerSummary {contact, notes, product_count}`
    * `PartnerPayment {id, date, amount, note, recorded_by_name, created_at, voided_at, void_reason}`
    * `PartnerPayouts {partners: {id, name, owed, still_to_pay, items: {product, product_name, quantity, payout, owed}[]}[], total}`
  * `partnerService`: `list()`, `create(p)`, `update(id, p)`, `remove(id)`, `payouts(range)`, `payments(id, page)`, `pay(id, {date, amount, note})`, `void(id, paymentId, reason)`.
  * Hooks: `usePartners()`, `usePartnerPayouts(range)`, `usePartnerPayments(id)`. Mutations invalidate `["partners"]`, `["partner-payouts"]`, `["dashboard"]`. Follow `useBoxes.ts` patterns and `useOperationIdentity` for idempotent POSTs where `useSales` does.
- [ ] Steps: test → fail → implement → `node tests/regression/test_permissions.mjs` and `npx tsc -b` pass → commit `feat(partners): frontend types, services and hooks`.

### Task 8: Owner Partners page

**Files:**
- Create: `frontend/src/pages/PartnersPage.tsx`, `frontend/src/pages/partners/PartnerForm.tsx`, `frontend/src/pages/partners/PartnerPayments.tsx`, `frontend/src/pages/partners/AmountOwed.tsx`, `frontend/src/pages/partners/partners.css`
- Modify: `frontend/src/router/index.tsx` (route `/products/partners`), `frontend/src/pages/ProductsPage.tsx:128` (a "Partners" link next to "Boxes")

- [ ] **Step 1:** Build to the spec's "Owner screens":
  * **Partner list:** on/off switch, item count, "Add an item" link to `/products/new?partner=<id>`.
  * **Add/edit form:** RHF + Zod; inline errors from the API's field errors.
  * **Payments panel:**
    * the "Still to pay ₱…" / "Paid ahead ₱…" figure
    * the record form, with date defaulting to today Manila
    * the list, with voided rows struck through and their reason shown
    * void through a `<dialog>` that asks for the reason, traps focus and returns focus on close
  * **Amount owed:** date range (This week, This month, Last month, Custom) via `lib/dateRanges.ts`; per-partner table; CSV export via `services/export.service.ts`; the exact note copy from Global Constraints.
  * **States:** skeletons while loading, empty states ("No partners yet. Add one to sell their food in the shop."), error with retry, toasts on success.
  * Match `BoxesPage.tsx` layout and tokens.
- [ ] **Step 2:** `npx tsc -b && npx eslint src && npx vite build` pass.
- [ ] **Step 3:** Browser check with the API simulated (scratch Playwright script; never real credentials):
  * screenshots at 375 and 1440 px of the list, the form, payments, void dialog and amount owed
  * keyboard-only run through recording and voiding a payment
  * axe: 0 violations

  Fix anything found.
- [ ] **Step 4: Commit** `feat(partners): owner Partners page with payments and amount owed`.

### Task 9: Item form "Made by", their price and patong

**Files:** Modify `frontend/src/pages/ProductFormPage.tsx`.

- [ ] **Step 1: "Made by" select** ("Rowszein's Delight" + active partners; preselected from the `?partner=` query).
  * **When a partner is chosen:** replace Price with "Their price" and "Your patong", show the live "Sells for ₱X in the shop", and hide "Extra when in a box".
  * **Submit:** `price = their + patong`, `partner_payout = their`.
  * **Load:** `patong = price − partner_payout`.
  * **Zod:** their > 0, patong ≥ 0 ("Your patong can't be less than ₱0").
  * **Server errors:** `partner_payout` errors appear under "Your patong" (patong message) or "Their price".
- [ ] **Step 2:** Checks pass. Browser check at 375 and 1440 px, keyboard and axe; no lost input on a server error.
- [ ] **Step 3: Commit** `feat(partners): their price and patong on the item form`.

### Task 10: Register, Recipe costing and Analytics

**Files:** Modify `frontend/src/pages/sales/Catalog.tsx`, `frontend/src/pages/sales/TicketPanel.tsx`, `frontend/src/pages/RecipesPage.tsx`, `frontend/src/pages/RecipeFormPage.tsx` (exclude partner items from the product choice), `frontend/src/pages/DashboardPage.tsx:39`.

- [ ] **Step 1: Changes:**
  * **Register:** "by {name}" under partner items in the catalog and on ticket lines.
  * **Recipe costing:** the partner row shows "Partner item · your patong ₱10" instead of "No recipe yet".
  * **Analytics sentence:** "kept, from ₱X sold, ₱Y owed to partners and ₱Z spent". Omit the partners clause when Y is 0.
- [ ] **Step 2:** Checks pass; browser check of the register, Recipe costing and Analytics at 375 and 1440 px.
- [ ] **Step 3: Commit** `feat(partners): partner items in the register, recipe costing and analytics`.

### Task 11: The shop

**Files:**
- Modify:
  * `frontend/src/pages/shop/shelves.ts`: `Shelf` becomes `{id: string, title: string, blurb?: string, partner: boolean, items}`. Own items get one shelf per category; then one shelf per active partner by `sort_order`, then name, titled "From our friends · {name}".
  * `frontend/src/pages/shop/PastryCase.tsx`: shelf heading and blurb. While filling, partner items are dimmed and non-addable, labeled "Not in boxes" in text and in `aria-label` and `aria-disabled`.
  * `frontend/src/pages/shop/ShopPage.tsx`: a "From our friends" chip after the category chips; it filters to partner shelves.
  * `frontend/src/pages/shop/useBoxOrder.ts`: refuse to put a partner item in a box.
  * `frontend/src/pages/shop/OrderSheet.tsx` and `OrderCard.tsx`: "by {name}" under partner items.
  * `frontend/src/pages/shop/order.ts`: Messenger line `"{name} (by {partner}) × {n}"`.
  * `frontend/src/pages/shop/ShopHero.tsx` and `BoxHero.tsx`: draw featured items as donuts in a box, so use own items only. A featured partner item appears only in its partner shelf.
- Test: `tests/regression/test_partner_shop.mjs` (new):
  * `toShelves` puts partner shelves after own categories, in partner order.
  * `orderText` writes "Banana muffin (by Kape Lokal) × 2".
  * The box-filling add rejects a partner item.
  * The hero's donut picks never include a partner item.

- [ ] **Step 1:** Write `test_partner_shop.mjs` → run `node tests/regression/test_partner_shop.mjs` → FAIL.
- [ ] **Step 2:** Implement → test passes, plus all other regression scripts.
- [ ] **Step 3:** Browser check with the API simulated:
  * shop at 375, 768 and 1440 px
  * partner section and chip
  * filling a box with a partner item shown
  * order sheet, saved order card and Messenger text
  * the Content-Security-Policy check script from fix 9: 0 violations
  * axe: 0 violations
- [ ] **Step 4: Commit** `feat(partners): partner sections in the shop`.

### Task 12: Finish

- [ ] **Step 1:** Full backend suite, all frontend checks and all regression scripts pass; record the counts.
- [ ] **Step 2:** README: an "Online shop" bullet for partner items; a "Management app" bullet for Partners (patong, amount owed, payments); a "How partner items work" section mirroring "How boxes work". Spec status: "built".
- [ ] **Step 3:** Run `/security-review`-style checks by hand:
  * `partner_payout`, `contact` and `notes` are absent from every staff and public response (grep the serializers)
  * payments require `partners.pay`
  * no new public write endpoints
- [ ] **Step 4: Commit** `docs: partner products`, then report to the owner. The migration must run on Render on the next deploy.
