# Shop Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The owner edits delivery hours, days off, delivery towns, order lead time, pause, notice, payment methods and contact links on one page, and the public shop shows them.

**Architecture:**
- **Backend:** a new Django app `shop` holds four small models: a `ShopSettings` singleton, `DeliveryHours`, `DeliveryTown` and `DayOff`. There is one public read endpoint and one owner endpoint. The owner endpoint replaces the whole settings document in a transaction, guarded by a `revision` number.
- **Frontend:** pure helpers in `lib/shopSettings.ts` turn settings into shop text. An owner page at `/settings` edits the settings, and the shop reads them through a TanStack query that never blocks the pastry case.

**Tech Stack:** Django 5.2 + DRF, React 19 + TS + TanStack Query, lucide-react, node regression scripts, and a Playwright scratch check.

**Spec:** `docs/superpowers/specs/2026-11-14-shop-settings-design.md`

## Global Constraints

**Access**
- `shop.manage` is an owner-only capability. Staff and anonymous users can never read the manage endpoint or write.
- The public read uses the `'catalog.public'` business action.

**Time**
- `TIME_ZONE = "Asia/Manila"`. "Today" means `timezone.localdate()`.

**Field limits**
- `messenger_url` is required and must match `https://m.me/...` or `https://www.messenger.com/...`.
- `facebook_url` is blank, or `https://(www.|m.)facebook.com/...` or `https://fb.com/...`.
- `email` is blank or a valid email.
- `phone` is blank or matches `^[+0-9()\-\s]{7,20}$`.
- `notice` and `pause_message` are at most 160 chars. A day-off `note` is at most 80 chars. A town `name` is 1–60 chars, unique ignoring case.
- `notice`, `pause_message`, `note` and town `name` reject `<` and `>`.
- `lead_days` is 0–7.
- A town `fee` is null (meaning "confirmed when we reply") or 0–1000 with 2 decimals.
- `payment_methods` is a subset of `gcash`, `maya`, `bank_transfer`, `cod`, stored in that order with no duplicates.
- Hours are exactly 7 rows, weekdays 0 (Monday) to 6, each once. When a day is open, `opens < closes`.
- `show_hours` defaults to false, and the public API returns `hours: []` while it is off.

**Seed values**
- Messenger `https://m.me/rowszeinsdelight`, email `hello@rowszeinsdelight.com`.
- Towns: `Lucena City`, `Tayabas`, `Sariaya`, active, fee null.
- Hours: Mon–Sun open 09:00–18:00, with `show_hours=false`. `lead_days=1`, no cutoff.

**API behaviour**
- The public GET sends `Cache-Control: public, max-age=60`. It returns active towns only and days off with `ends >= today`, soonest first, at most 10. It never returns `updated_by`, `revision` or inactive towns.
- A stale `revision` on PUT returns 409 with the current manage document. Ended days off are dropped on save.
- Validation errors use `{"success": false, "error": {"<field>": ["msg"]}}`. Row errors are flattened to keys like `hours.2.closes`, `towns.1.name` and `days_off.0.ends`.
- Each save logs one INFO line on logger `shop.settings` with extras `actor_id`, `revision` and `changed` (field names only). Values are never logged.

**Shop copy**
- A ₱0 fee shows "Free delivery".
- A null fee shows "Fee confirmed when we reply".
- If every day is closed, the shop shows "Message us for delivery days".
- If the pause message is blank, the shop shows "We're not taking orders right now. Message us on Messenger for anything urgent."

**Shop loading and contact fallback**
- Settings never block the pastry case. Defaults apply only while settings are loading or have failed.
- Once settings load, a blank email, Facebook link or phone hides that link, and "Send by email" shows only when an email is set.
- While paused, the order sheet's Save card and Send on Messenger buttons are disabled with the message beside them. The cart and the contact form keep working.

**Quality bar**
- WCAG 2.2 AA, 44px targets, design tokens, and the motion tokens with reduced motion respected.
- CLS < 0.1. No new CSP origins.
- Text is rendered as React text, never HTML.
- Do not deploy.

## Review Focus

1. **The Messenger link cleared, or pointed at another site.** Expect a 400 next to the field, nothing saved, and the owner's other edits still on screen. Tested in Task 2 and Task 4.
2. **Two towns differing only in case** ("Lucena City" and "lucena city"). Expect a 400 on the second row's name. Tested in Task 2.
3. **Settings slow (800 ms) or failing (500) on the shop.** The case still renders, the default Messenger and email appear, the notice arrives with CLS < 0.1, and the console stays clean. Tested in Task 5.
4. **A pause while the cart has items.** The cart is kept, send is disabled with the message, and the contact form still sends. Tested in Task 5.
5. **Days-off labels across months and years** (Dec 30 → Jan 2), and a single-day off. Expect readable labels like "Dec 30 – Jan 2" and "Nov 30". Tested in Task 3.

---

### Task 1: `shop` app, models, seed data and the `shop.manage` capability

**Files:**
- Create: `backend/shop/__init__.py`, `apps.py`, `models.py`, `admin.py` (empty registrations are fine to omit), `migrations/0001_initial.py`, `migrations/0002_seed_settings.py`, `tests.py`
- Modify: `backend/backend/settings.py` (`INSTALLED_APPS` += `'shop'`; `LOGGING.loggers` += `"shop.settings": {"level": "INFO", "filters": ["request_id"]}`)
- Modify: `backend/accounts/permissions.py`: `OWNER` gains `'shop.manage'`
- Modify: `frontend/src/lib/permissions.ts`: `OWNER` gains `"shop.manage"`, and `canVisit` gains `[/^\/settings\/?$/, "shop.manage"]`
- Test: `backend/shop/tests.py`, `tests/regression/test_permissions.mjs`

**Interfaces:**
- **Produces the models:**
  - `ShopSettings`: fields `messenger_url`, `facebook_url`, `email`, `phone`, `notice`, `orders_paused`, `pause_message`, `lead_days` (PositiveSmallInteger), `order_cutoff` (TimeField, null), `show_hours`, `payment_methods` (JSONField list), `revision` (PositiveInteger, default 1), `updated_at`, `updated_by` (FK User, null, SET_NULL). Includes the classmethod `ShopSettings.load() -> ShopSettings`, which returns the pk=1 row.
  - `DeliveryHours`: `weekday` (unique, 0–6), `is_open`, `opens`, `closes`.
  - `DeliveryTown`: `name`, `is_active`, `fee` (Decimal 7,2, null), `position`; ordered by `position`, `id`.
  - `DayOff`: `starts`, `ends`, `note`; ordered by `starts`.
- **Produces the database constraints:**
  - `shop_settings_singleton` (`pk=1`);
  - `delivery_hours_open_window` (if open, both times set and `opens < closes`);
  - `delivery_hours_weekday_range` (0–6);
  - `delivery_town_name_ci_unique` (UniqueConstraint on `Lower('name')`);
  - `delivery_town_fee_range` (null or 0–1000);
  - `day_off_order` (`starts <= ends`);
  - `shop_settings_lead_days` (0–7).

- [ ] **Step 1: Write failing tests** in `backend/shop/tests.py`:
  - `test_seed_creates_the_shop_defaults`: `ShopSettings.load()` has the seed Messenger and email, `show_hours is False`, `lead_days == 1`, `order_cutoff is None`, `revision == 1`. It has 7 `DeliveryHours` rows, all open 09:00–18:00. Towns are `["Lucena City", "Tayabas", "Sariaya"]`, all active with fee None.
  - `test_second_settings_row_is_rejected`: creating `ShopSettings(pk=2, ...)` raises `IntegrityError`.
  - `test_open_day_needs_closing_after_opening`: updating a row to `opens=18:00, closes=09:00, is_open=True` raises `IntegrityError`.
  - `test_town_names_are_unique_ignoring_case`: creating `"lucena city"` raises `IntegrityError`.
  - `test_day_off_cannot_end_before_it_starts` and `test_town_fee_over_1000_is_rejected` raise `IntegrityError`.
  - `test_only_the_owner_can_manage_shop_settings`: `can(owner, 'shop.manage')` is True; for staff it is False.

  Also add to `tests/regression/test_permissions.mjs`: owner `can(owner,'shop.manage')===true`, staff false, `canVisit(owner,'/settings')===true`, `canVisit(staff,'/settings')===false`.

- [ ] **Step 2: Run and see them fail**
  Run: `cd backend && .venv/Scripts/python.exe manage.py test shop --settings=backend.test_settings` and `node tests/regression/test_permissions.mjs`
  Expected: the backend fails with an import error for `shop` / no module; the node test fails on `shop.manage`.

- [ ] **Step 3: Implement the models, both migrations (generate 0001 with `makemigrations shop`, hand-write 0002 as a `RunPython` seed with a no-op reverse), settings, and both capability lists.**

- [ ] **Step 4: Run the tests, plus the whole backend suite and `test_permissions.mjs`**
  Expected: all pass. The backend total is 256 + the new tests, with 17 skipped.

- [ ] **Step 5: Apply to the local dev DB.** Run the scratch `django-migrate-all.cmd` (or `scripts/django-local.cmd`'s environment with `manage.py migrate shop`).
  Expected: `Applying shop.0001_initial... OK`, `Applying shop.0002_seed_settings... OK`.

- [ ] **Step 6: Commit**
  `git commit -m "feat(shop-settings): settings tables, seed and owner capability"`

---

### Task 2: Validation, save service and the two endpoints

**Files:**
- Create: `backend/shop/serializers.py`, `backend/shop/services.py`, `backend/shop/views.py`, `backend/shop/urls.py`
- Modify: `backend/backend/urls.py` (`path('api/shop/', include('shop.urls'))`)
- Modify: `backend/backend/log_format.py` (`ALLOWED_EXTRAS` += `"revision", "changed"`)
- Test: `backend/shop/tests.py` (new class `ShopSettingsApiTests`)

**Interfaces:**
- **Consumes:** the Task 1 models and `ShopSettings.load()`.
- **Produces the endpoints:**
  - `GET /api/shop/settings/` (public). Returns `{success, data: PublicShopSettings}`.
  - `GET /api/shop/settings/manage/` and `PUT /api/shop/settings/manage/` (owner). Return `{success, data: ManagedShopSettings}`.
- **Produces the shapes the frontend Task 3 types mirror:**
  - `PublicShopSettings = {messenger_url, facebook_url, email, phone, notice, orders_paused, pause_message, lead_days, order_cutoff: "HH:MM"|null, payment_methods: string[], hours: {weekday, is_open, opens: "HH:MM"|null, closes: "HH:MM"|null}[], towns: {id, name, fee: "50.00"|null}[], days_off: {starts: "YYYY-MM-DD", ends, note}[]}`
  - `ManagedShopSettings = PublicShopSettings & {show_hours: boolean, revision: number, updated_at: string, hours: (always 7 rows), towns: {id, name, is_active, fee}[], days_off: (all upcoming, uncapped)}`
  - The PUT body is the `ManagedShopSettings` fields minus `updated_at`. Towns have an optional `id`, and a town not in the body is deleted.
- **Produces `services.save_settings(actor, data: dict, revision: int) -> ShopSettings`.** It runs inside `transaction.atomic()` and uses `select_for_update` on the singleton. It raises `StaleRevision` when `revision` differs, and bumps `revision` by 1 on success.

- [ ] **Step 1: Write failing tests** (using an owner `APIClient`, staff, and anonymous, as in `products/test_partners.py`'s fixture):
  - **The public read is correct:**
    - `test_public_read_hides_hours_until_shown`: anonymous GET returns 200, `data.hours == []`, `Cache-Control` contains `max-age=60`, and the keys `revision`, `updated_by` and `show_hours` are absent.
    - `test_public_read_lists_active_towns_and_upcoming_days_off`: an inactive town is absent. A day off ending yesterday is absent; one ending today is present. With 12 future days off, 10 are returned, soonest first.
  - **Access is enforced:**
    - `test_staff_and_anonymous_cannot_manage`: staff GET manage gives 403, anonymous PUT gives 401 or 403, and staff PUT gives 403.
  - **A valid save works:**
    - `test_owner_saves_the_whole_document`: PUT a valid body with `show_hours=True`, Tuesday–Sunday open 09:00–18:00, Monday closed, towns Lucena City (fee "0.00") and Tayabas (fee null) with Sariaya removed, one day off, payment methods `["cod","gcash","gcash"]`, `revision=1`. The response is 200 with `revision == 2` and `payment_methods == ["gcash","cod"]`. Sariaya is deleted, and the public GET now shows 7 hours rows.
  - **Bad input gets a 400 with the right key:**
    - `test_messenger_link_is_required_and_must_be_messenger`: `""` and `"https://evil.example/x"` each give 400 with key `messenger_url`, and nothing is saved (revision still 1).
    - `test_row_errors_use_flat_keys`: Wednesday open with `closes < opens` gives a 400 key `hours.2.closes`. A second town `"lucena city"` gives `towns.1.name`. A day off with `ends < starts` gives `days_off.0.ends`. A notice containing `<b>` gives `notice`.
    - `test_hours_must_be_seven_distinct_weekdays`: 6 rows, or a repeated weekday, gives a 400 key `hours`.
  - **Conflicts and side effects:**
    - `test_stale_revision_is_a_conflict`: PUT with `revision=1` twice. The second is 409, `data.revision == 2`, and the first save's values are intact.
    - `test_ended_days_off_are_dropped_on_save`: a day off ending yesterday in the body is not stored.
    - `test_save_logs_changed_field_names_only`: `assertLogs('shop.settings', 'INFO')` records one line. Its `changed` includes `notice` and its `revision` is 2, and the email value does not appear in the record.

- [ ] **Step 2: Run and see them fail** (`manage.py test shop --settings=backend.test_settings`).
  Expected: 404s or import errors from the missing views.

- [ ] **Step 3: Implement.**
  - **Serializers:** use `ManagedSettingsSerializer` with nested `ListSerializer`s, and set `messenger_url` to `required=True, allow_blank=False`.
  - **Error flattening:** a small `flatten_errors(errors: dict) -> dict[str, list[str]]` turns DRF's nested list errors into `hours.2.closes`-style keys.
  - **Case-insensitive town uniqueness:** check it in the serializer so the error lands on the duplicate row.
  - **Views:**
    - `PublicShopSettingsView`: `business_actions = {'GET': 'catalog.public', 'OPTIONS': 'catalog.read'}`, and use `patch_cache_control(public=True, max_age=60)`.
    - `ManageShopSettingsView`: `{'GET': 'shop.manage', 'PUT': 'shop.manage', 'OPTIONS': 'shop.manage'}`.
  - **Response shape:** reuse the `{'success', 'data', 'message'}` / `{'success': False, 'error': ...}` shapes from `products/views._ok` and `_invalid`, with local copies in `shop/views.py`.
  - **Conflict response:** 409 returns `{'success': False, 'error': {'code': 'conflict', 'message': 'These settings were changed in another tab or by someone else.'}, 'data': <current manage doc>}`.
  - **Changed fields:** `changed` is computed by comparing the serialized manage document before and after (top-level keys).

- [ ] **Step 4: Run the shop tests, then the whole backend suite.**
  Expected: all pass, with 17 skipped.

- [ ] **Step 5: Commit**
  `git commit -m "feat(shop-settings): public and owner settings API"`

---

### Task 3: Frontend types, service, hooks and the text helpers

**Files:**
- Create: `frontend/src/types/shopSettings.types.ts` (mirrors the Task 2 shapes; `PaymentMethod = "gcash"|"maya"|"bank_transfer"|"cod"`)
- Create: `frontend/src/services/shopSettings.service.ts`, with:
  - `getPublic(signal?) -> PublicShopSettings`
  - `getManaged() -> ManagedShopSettings`
  - `save(payload: ShopSettingsPayload) -> ManagedShopSettings`
- Create: `frontend/src/hooks/useShopSettings.ts`, with:
  - `useShopSettings()`: key `["shop-settings","public"]`, `retry: false`, `staleTime: 60_000`
  - `useManagedShopSettings()`: key `["shop-settings","manage"]`
  - `useSaveShopSettings()`: on success, sets the manage data and invalidates the public key
- Create: `frontend/src/lib/shopSettings.ts` (pure, no React)
- Test: `tests/regression/test_shop_settings.mjs`

**Interfaces (all exported from `lib/shopSettings.ts`, produced for Tasks 4 and 5):**
- Constants:
  - `DEFAULT_CONTACT: Contact`, which is `{ messenger_url: SHOP_MESSENGER, email: SHOP_EMAIL, facebook_url: "", phone: "" }`. Import the constants from `pages/shop/order.ts`.
  - `DEFAULT_PAUSE_MESSAGE = "We're not taking orders right now. Message us on Messenger for anything urgent."`
  - `PAYMENT_LABELS: Record<PaymentMethod,string>`, which is GCash / Maya / Bank transfer / Cash on delivery.
- Functions:
  - `shopContact(settings?: PublicShopSettings): Contact`
  - `formatTime(hhmm: string): string`, for example `"15:00"` → `"3:00 PM"` and `"09:00"` → `"9:00 AM"`
  - `groupHours(hours): { days: string; time: string }[] | null`. It returns null when `hours` is empty, and `[]` when every day is closed. Consecutive equal days are grouped Monday→Sunday; closed groups read `time: "Closed"`.
  - `cutoffSentence(leadDays: number, cutoff: string|null): string`
  - `feeLabel(fee: string|null): string`
  - `dayOffLabel(day: {starts,ends,note}): string`

- [ ] **Step 1: Write the failing node tests** (in the style of `test_treat_shape.mjs`):
  - `shopContact(undefined)` deep-equals `DEFAULT_CONTACT`. `shopContact({...loaded, email: ""}).email === ""`, which means it does not fall back.
  - `formatTime`: `"00:00"` → `"12:00 AM"`, `"12:30"` → `"12:30 PM"`, `"15:00"` → `"3:00 PM"`.
  - `groupHours`:
    - Mon closed, Tue–Sun 09:00–18:00 gives `[{days:"Mon",time:"Closed"},{days:"Tue–Sun",time:"9:00 AM–6:00 PM"}]`.
    - All open with Sat 10:00–14:00 gives `Mon–Fri`, `Sat`, `Sun` groups.
    - `[]` gives `null`, and all closed gives `[]`.
  - `cutoffSentence` cases, exact strings:

    | Arguments | Result |
    |---|---|
    | `(0,null)` | `"Order today for same-day delivery."` |
    | `(0,"11:00")` | `"Order by 11:00 AM for same-day delivery."` |
    | `(1,null)` | `"Order a day ahead."` |
    | `(1,"15:00")` | `"Order by 3:00 PM for next-day delivery."` |
    | `(3,null)` | `"Order 3 days ahead."` |
    | `(3,"15:00")` | `"Order by 3:00 PM, 3 days before delivery."` |

  - `feeLabel`: `null` → `"Fee confirmed when we reply"`, `"0.00"` → `"Free delivery"`, `"50.00"` → `"₱50.00 delivery"`. Use the shop's `formatPeso`; assert against `formatPeso(50)` so the test doesn't hard-code its formatting.
  - `dayOffLabel`:
    - Dec 24–26 with note "Christmas break" gives `"Dec 24–26 · Christmas break"`.
    - A single day, Nov 30, with no note gives `"Nov 30"`.
    - Dec 30 → Jan 2 gives `"Dec 30 – Jan 2"`.
    - Use UTC-safe date parsing, so `"2026-11-30"` never shows as Nov 29.

- [ ] **Step 2: Run** `node tests/regression/test_shop_settings.mjs`.
  Expected: it fails because the module is not found.

- [ ] **Step 3: Implement the types, service, hooks and helpers.**

- [ ] **Step 4: Run the node test, then `npx tsc -b` and `npx eslint src` in `frontend/`.**
  Expected: all pass, with 0 errors.

- [ ] **Step 5: Commit**
  `git commit -m "feat(shop-settings): settings client and shop text helpers"`

---

### Task 4: Owner "Shop settings" page

**Files:**
- Create: `frontend/src/pages/ShopSettingsPage.tsx` (loads, holds the draft, saves, handles 409, warns on leave)
- Create: `frontend/src/pages/settings/HoursFields.tsx`, `TownsFields.tsx`, `DaysOffFields.tsx`, `draft.ts`, `settings.css`
  - `draft.ts` exports `toDraft(ManagedShopSettings)`, `toPayload(draft)` and `isDirty(a, b)`. These are pure and covered by the node test.
- Modify: `frontend/src/router/index.tsx` (a lazy `ShopSettingsPage` at `/settings` inside `OwnerLayout`)
- Modify: `frontend/src/config/navigation.ts`
  - Append `{ to: "/settings", title: "Shop settings", icon: Store, capability: "shop.manage" }`.
  - Change the comment's "six" to "seven".
- Test: `tests/regression/test_shop_settings.mjs` (draft round-trip), plus the browser check in Task 6

**Interfaces:**
- **Consumes:** the Task 3 hooks, types, `formatTime`, `cutoffSentence`, `PAYMENT_LABELS` and `DEFAULT_PAUSE_MESSAGE`; `apiFieldErrors` / `apiErrorMessage` from `lib/csrfTransport`; `ConfirmDialog` and the `useBlocker` pattern from `pages/ExpenseFormPage.tsx`; the toast used by other forms.
- **Produces:** the route `/settings`.

- [ ] **Step 1: Write the failing node tests for `draft.ts`.**
  - `toPayload(toDraft(doc))` deep-equals `doc` minus `updated_at`.
  - The fee input `""` maps to `null`, and `"0"` maps to `"0.00"`.
  - `isDirty` is false right after `toDraft` and true after changing one town's name.

- [ ] **Step 2: Run** the node test. Expected: FAIL (module missing).

- [ ] **Step 3: Implement `draft.ts` and the page.** The sections and their order are fixed by the spec's "Owner page" list:
  - **Hours**
    - The switch is labelled "Show delivery hours in the shop".
    - Each day row has an open/closed control and two `<input type="time">` fields.
    - Add the "Copy Monday to all open days" button.
  - **Days off**
    - Each row has from/to `type="date"` inputs and a note field.
    - Add the "Add days off" button.
  - **Delivery towns**
    - Each row has a name, an on/off control and a fee field.
    - The fee field is a numeric input with the hint "Leave blank until you decide."
    - Add the "Add town" button and a remove button per row.
  - **Ordering**
    - Lead days are a select with these choices: Same day, 1 day ahead, … 7 days ahead.
    - Add an optional cutoff time.
    - Show a live preview line under them, using `cutoffSentence`.
    - Add the "Pause orders" switch with its message field (placeholder: `DEFAULT_PAUSE_MESSAGE`), and the notice field with a character counter showing /160.
  - **Payment methods:** four checkboxes.
  - **Contact:** Messenger (required), Facebook, email and phone.
  - **Errors:** a field error from `apiFieldErrors` shows next to the field whose key matches (for example `hours.2.closes`), and focus moves to the first error.
  - **Conflict (409):** keep the draft, and show a banner with the server message and a "Reload their version" button that replaces the draft from `error.response.data.data`.
  - **Save button:** "Save settings". While saving it shows a loading state and is disabled; on success it shows a toast ("Shop settings saved").
  - **Leave warning:** when `isDirty`, leaving opens the "Leave without saving?" dialog, using the `useBlocker` and `ConfirmDialog` pattern from `ExpenseFormPage`.
  - **Save service:** `save_settings` also sets `updated_by` to the owner who saved.
  - **Page states:** a skeleton while loading, and `RecordLoadError` with retry on a load failure.
  - **Accessibility:** every control is labelled, each row-level remove button names its row (for example "Remove Tayabas"), and every target is ≥44px.

- [ ] **Step 4: Run** the node test, `npx tsc -b`, `npx eslint src` and `npx vite build`. Expected: all pass.

- [ ] **Step 5: Commit**
  `git commit -m "feat(shop-settings): owner Shop settings page"`

---

### Task 5: The public shop reads the settings

**Files:**
- Create: `frontend/src/pages/shop/NoticeBar.tsx`, `frontend/src/pages/shop/DeliveryInfo.tsx`
- Modify: `frontend/src/pages/shop/ShopPage.tsx`, `ContactSection.tsx`, `OrderSheet.tsx`, `ShopHero.tsx`, `BoxHero.tsx`, `shop.css`
  - The point is that every `SHOP_MESSENGER` / `SHOP_EMAIL` use goes through `shopContact`.
- Test: the Task 6 browser check, plus `tests/regression/test_shop_settings.mjs` (already covers the text)

**Interfaces:**
- **Consumes:** `useShopSettings`, `shopContact`, `groupHours`, `cutoffSentence`, `feeLabel`, `dayOffLabel`, `PAYMENT_LABELS` and `DEFAULT_PAUSE_MESSAGE`.
- **Produces these component props:**
  - `ContactSection({ contact: Contact })`
  - `OrderSheet` gains `paused: string | null` (the message, or null when taking orders)
  - `DeliveryInfo({ settings?: PublicShopSettings })`
  - `NoticeBar({ text: string })`

- [ ] **Step 1: Wire the shop.**
  - **Loading:** `ShopPage` calls `useShopSettings()` once, renders the case without waiting, and passes `shopContact(data)` down.
  - **Notice bar:** `NoticeBar` renders only when `data?.notice` is non-empty, and must not shift content. Any technique that doesn't push the case or hero down is fine; for example, a top overlay that `position: fixed` keeps out of flow, sitting under the header, dismissible for the session.
  - **Paused**
    - A banner showing `pause_message || DEFAULT_PAUSE_MESSAGE` appears near the order dock.
    - `OrderSheet` disables Save card and Send on Messenger, and shows the message with `aria-describedby` on both buttons.
    - Cart state is untouched.
  - **Delivery block:** `DeliveryInfo` sits beside the contact section, in this order:
    1. **Hours:** `groupHours` (hidden when null; "Message us for delivery days" when `[]`).
    2. **Days off:** up to the first 3 labels.
    3. **Towns:** each with its `feeLabel`.
    4. **Cutoff:** the `cutoffSentence`.
    5. **Payment methods:** their labels; hidden when empty.

    If settings failed to load, show only the default towns line, "We deliver in Lucena City, Tayabas and Sariaya.", and a Messenger link.
  - **Contact links:** in the contact section and footer, Facebook, email and phone each render only when set. Phone uses `tel:` with spaces stripped. "Send by email" renders only when an email is set.

- [ ] **Step 2: Grep for leftovers.**
  Run: `grep -rn "SHOP_MESSENGER\|SHOP_EMAIL" frontend/src --include=*.tsx`
  Expected: no matches. The constants are used only in `order.ts`'s export and `lib/shopSettings.ts`.

- [ ] **Step 3: Run** `npx tsc -b`, `npx eslint src`, `npx vite build` and all `node tests/regression/*.mjs`. Expected: all pass.

- [ ] **Step 4: Commit**
  `git commit -m "feat(shop-settings): shop shows delivery info, notice, pause and contact links"`

---

### Task 6: Browser check, docs

**Files:**
- Modify: the scratch Playwright check `partners_check.py` (session scratchpad; not committed). Add `/api/shop/settings/` and `/api/shop/settings/manage/` mocks and the scenarios below.
- Modify: `README.md`
  - Add a "Shop settings" section.
  - Add `shop 0001_initial, 0002_seed_settings` to the deployment migrations list.
  - Update the backend test count.

- [ ] **Step 1: Run the scenarios** (Chromium at 375 and 1440, plus WebKit at iPhone 13):
  - **`settings_page`**
    - The owner opens `/settings`.
    - Clearing Messenger and saving shows the field error and keeps the other edits.
    - A mocked 409 shows the conflict banner and "Reload their version".
    - A valid save shows the toast.
    - axe reports 0 violations.
  - **`shop_settings`**
    - The public shop with a notice, paused, `show_hours` on, a ₱0 town, a null-fee town, a day off and payment methods shows the matching texts.
    - Save card and Send on Messenger are disabled while the cart keeps its items.
    - The contact form's Messenger button still works.
    - axe reports 0 violations, and there are 0 CSP errors.
  - **`shop_settings_slow` / `shop_settings_fail`**
    - The settings mock is delayed by 800 ms, or answers 500.
    - The case is visible before the settings arrive, and the default Messenger link and email show on failure.
    - Measured CLS (PerformanceObserver `layout-shift`, no recent input) is < 0.1.
    - The console has no errors.
  - Take screenshots at 375 and 1440 of the settings page and the shop delivery block, and look at them.
  Expected: every report value matches, and axe, CSP and console all report 0.

- [ ] **Step 2: Run the full verification.**
  - Backend: `manage.py test --settings=backend.test_settings`.
  - Frontend: `npx tsc -b && npx eslint src && npx vite build`, then every `node tests/regression/*.mjs`.
  Expected: all green.

- [ ] **Step 3: Commit**
  `git commit -m "docs: shop settings"`
