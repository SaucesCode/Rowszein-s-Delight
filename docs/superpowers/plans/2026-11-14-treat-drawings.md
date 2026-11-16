# Drawn Treats for Partner Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Partner items without a photo are drawn as the right treat (whole cake, cake slice, cupcake, muffin, brownie, cookie, bread) in the donut's style, flavour-tinted, with the same movement, chosen per item with a name-based guess.

**Architecture:**
* `Product.shape` stores the choice (own items are always `donut`).
* `lib/treatShape.ts` guesses it from the name.
* Seven deterministic SVG components sit behind one `TreatArt` that replaces direct donut drawings wherever a product is drawn. Movement comes free from the existing animated containers.

**Tech Stack:** Django 5.2 / DRF; React 19 + TS; inline SVG; design tokens in `frontend/src/index.css`.

**Spec:** `docs/superpowers/specs/2026-11-14-treat-drawings-design.md`

## Global Constraints

* **Shapes:** `donut, whole_cake, cake_slice, cupcake, muffin, brownie, cookie, bread`. Labels: "Donut", "Whole cake", "Cake slice", "Cupcake", "Muffin", "Brownie", "Cookie", "Bread".
* **Own items:** `shape` must be `donut`, otherwise 400 "Only partner items can be shown as another treat." Moving a partner item back to own resets it to `donut`.
* **`guessShape` order:** roll cake → whole cake; cheesecake, slice → cake slice; cupcake; muffin; brownie, blondie → brownie; cookie, crinkle, polvoron → cookie; bread, loaf, pandesal, ensaymada, bun, roll, monay → bread; cake, torte → whole cake. Default: whole cake.
* **Drawings:** viewBox `0 0 96 96`; colours only from tokens (`--color-glaze-<flavor>`, `--color-glaze-<flavor>-tint` and the existing dough, cocoa and cream tokens that `PatisserieDonut` uses); no randomness; `aria-hidden="true"`; no new dependencies or image files.
* **Motion:** the hover detail uses transform and opacity only, takes 200 ms or less, and is off under `prefers-reduced-motion`.
* **Photos:** a photo always wins over a drawing.
* **Checks:** backend tests as before; frontend `tsc`, `eslint`, `build` and all regression scripts.
* **Process:** commit per task; never push or deploy.

## Review Focus

1. **A partner item switched back to own keeps a stale shape:** it must become `donut` (Task 1).
2. **A name that matches two shapes** ("Chocolate cake cookie", "Ube roll cake"): the earliest rule in the order wins, and the result is pinned in a test (Task 2).
3. **A tiny tile (32–44 px) in the management lists:** every shape stays recognisable at 32 px; checked in the gallery screenshot (Task 3).
4. **The fly-to-bag clone of a non-donut drawing:** it keeps its shape (the clone copies the art element) (Task 4, browser check).
5. **A screen reader on the shape picker:** each option is announced with its label, and arrow keys work (Task 4).

---

### Task 1: `Product.shape` on the server

**Files:** Modify `backend/products/models.py`, `backend/products/serializers.py` (`ProductSerializer` gets `shape`; `OperationalProductSerializer` gets read-only `shape`; `validate` enforces the own-item rule and the reset). Create migration `0008_product_shape` (after the box task's `0007`). Test: `backend/products/test_partners.py` (`ProductShapeTests`).
- [ ] **Failing tests:**
  * `test_partner_item_stores_shape_and_public_sees_it`
  * `test_own_item_cannot_take_another_shape`: 400 on `shape` with the message above
  * `test_partner_to_own_resets_shape_to_donut`
  * `test_existing_products_default_to_donut`
- [ ] **Steps:** run (FAIL), implement, run (PASS) plus the full suite. **Commit:** `feat(treats): products remember how they're drawn`.

### Task 2: Shape guess and types

**Files:** Create `frontend/src/lib/treatShape.ts` (exporting `type Shape`, `SHAPES: {value: Shape; label: string}[]` and `guessShape(name: string): Shape`). Modify `frontend/src/types/product.types.ts` (`shape?: Shape` on `Product` and `ProductPayload`) and `services/product.service.ts` (append `shape`). Test: `tests/regression/test_treat_shape.mjs`.
- [ ] **Failing tests:**
  * every keyword in the order above
  * "Ube roll cake" → `whole_cake`
  * "Ube cheesecake slice" → `cake_slice`
  * "Pandesal" → `bread`
  * "Chocolate cake cookie" → `cookie`
  * an unknown name → `whole_cake`
- [ ] **Steps:** run (FAIL), implement, run (PASS) plus `tsc`. **Commit:** `feat(treats): guess the drawing from the item's name`.

### Task 3: The seven drawings

**Files:** Create `frontend/src/pages/shop/treats/` containing:
* `WholeCake.tsx`: layered cake, frosting in the flavour colour, a drip edge and a top garnish
* `CakeSlice.tsx`: a wedge with two sponge layers, a cream line and frosting on top
* `Cupcake.tsx`: a pleated liner, a frosting swirl and a cherry
* `Muffin.tsx`: a liner and a domed top with crumbs or berries in the flavour colour
* `Brownie.tsx`: a square with a crackled top, cocoa toned and flavour-tinted
* `Cookie.tsx`: round, with chips in the flavour colour
* `Bread.tsx`: a loaf with a scored top and a glossy crust
* `TreatArt.tsx`: `({shape, flavor, size}) => JSX`; `donut` renders `PatisserieDonut`

`frontend/src/pages/shop/shop.css` gets the hover details, `.treat-detail`, under `prefers-reduced-motion: no-preference`.
- [ ] **Step 1:** draw each shape to the constraints.
- [ ] **Step 2: Gallery check.** A scratch Playwright script renders the built app's shop with a simulated API returning one partner item per shape × flavour. Screenshot at 375 and 1440 px in Chromium and WebKit, and compare by eye against the donuts in style, line weight and light direction.
- [ ] **Step 3:** `tsc`, `eslint`, `build` pass. **Commit:** `feat(treats): drawn cakes, slices, cupcakes, muffins, brownies, cookies and bread`.

### Task 4: Use the drawings everywhere, and the shape picker

**Files:**
* **Modify the shop:** `pages/shop/PastryCase.tsx`, `OrderSheet.tsx`, `OrderDock.tsx` (singles window).
* **Modify management screens** to use `TreatArt` with `shape`: `pages/sales/Catalog.tsx`, `pages/ProductsPage.tsx`, `pages/RecipesPage.tsx` (partner rows), `pages/ProductFormPage.tsx` (preview plus the "Shown in the shop as" radio group).
* **Cart:** `frontend/src/hooks/useCart.ts` (`CartItem.shape?`, so the order sheet and bar draw singles correctly).

`pages/ProductFormPage.tsx` details:
* Form state `shape`, defaulting to `product.shape`, or `guessShape(name)` for a new partner item.
* The value follows `guessShape(name)` until the owner picks one (a `shapeTouched` flag).
* Own items send `shape: "donut"`.
* The picker is a `fieldset` with `legend`; each radio has a visible label and a 44 px target; arrow keys work natively.
- [ ] **Step 1:** implement.
- [ ] **Step 2: Browser check** (simulated API; Chromium 375 and 1440 px plus WebKit iPhone):
  * a cake slice and a muffin in the case;
  * hover lift and tilt; tap squish;
  * fly-to-bag keeps the shape;
  * order sheet and bar;
  * register tile;
  * item form: the guess follows the name, then a manual pick sticks, and the request sends `shape`;
  * reduced motion turns off the hover detail;
  * axe 0; CSP 0.
- [ ] **Step 3:** all checks pass. **Commit:** `feat(treats): partner items drawn as their treat everywhere`.

### Task 5: Finish

- [ ] Full suites and regression scripts; record the counts. README: a sentence under "How partner items work" about "Shown in the shop as". Spec status → built. **Commit:** `docs: drawn treats`. Then one whole-branch review and test-first fixes of its Critical and Important findings.
