# Online Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Customers send orders from the shop into the app, the owner is emailed and confirms each one into a sale in one tap, and the customer can check the order's status.

**Architecture:**
- **Backend:** a new Django app `orders` holds `OnlineOrder` (a server-priced snapshot of the order) and `OrderEmail` (an outbox).
  - Public endpoints place an order and read its status by token.
  - Owner endpoints list, confirm and decline orders. Confirming calls the existing `sales.services.execute_sale` with the snapshot.
  - Email goes through Resend's HTTPS API after commit, with retries.
- **Frontend:** the shop's order sheet gains a checkout step and a confirmation screen, there is a public `/order/:token` page, and the owner app gets an Orders section with a badge and a Home card.

**Tech Stack:** Django 5.2 + DRF, React 19 + TS + TanStack Query, Resend HTTPS API (stdlib `urllib`), node regression scripts, Playwright scratch check.

**Spec:** `docs/superpowers/specs/2026-11-15-online-orders-design.md`

## Global Constraints

**Statuses**
- Stored statuses are `waiting`, `confirmed` and `declined`.
- The shown status is `cancelled` when the linked sale's `status == 'cancelled'`. It is read from the sale, never stored.

**Order number and token**
- Number: `RD-YYMMDD-XXXX`, using the Manila date. The alphabet is `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. Regenerate on collision.
- Token: `secrets.token_urlsafe(24)`.
- The status page shows the customer's first name only, and never the phone, address or note.

**Customer fields**
- Phone: `09XXXXXXXXX` or `+639XXXXXXXXX`, stored as `+639XXXXXXXXX`.
- Name 1–80 characters, address 1–200, note 0–300, owner message 1–300.
- `<` and `>` are rejected in name, address, note and owner message.

**Order limits**
- Items: 1–50 lines, quantity 1–99, no duplicate product.
- Boxes: 0–20.
- The order needs at least one item or box.

**Delivery date**
- The earliest day is Manila today + `lead_days`, plus 1 day if `order_cutoff` is set and Manila time is past it.
- The latest day is earliest + 30 days.
- Not inside a day off.
- When `show_hours` is on, only weekdays with `is_open`.

**Abuse protection**
- Rate limit: scope `OS`, 5 orders per 600 s per client address. It can be overridden by `AUTH_RATE_LIMITS["OS"]`, and uses that default when the key is absent.
- Honeypot field `website`: when it is non-empty, reply 201 with a decoy body and save nothing.

**Confirming an order**
- Sales command key: `online-order-<id>`.
- Sale date: `delivery_date`.
- Notes: `Online order <number>, <name>, <town>; delivery fee: <₱fee | to confirm>`.
- Box prices and donuts come from the snapshot. A ready-made box is sent as `{assortment, price}` only when its current donuts equal the snapshot; otherwise as `{box_size, contents, price}`.

**Email**
- Resend `POST https://api.resend.com/emails`, timeout 10 s.
- Environment variables: `RESEND_API_KEY`, `ORDER_EMAIL_FROM` (default `Rowszein's Delight <onboarding@resend.dev>`) and `APP_URL`.
- Without a key: log "would send" and mark the row `sent`.
- Retry rows that are `pending` or `failed`, older than 5 minutes, with `attempts < 5`.
- The email never contains the phone, address or note.
- Logs record `order_id`, `attempt` and `outcome` only.

**Privacy**
- Clear phone, address and note 90 days after `delivery_date`, and set `contact_cleared_at`.

**Access**
- `orders.manage` is an owner-only capability, in both permission lists.

**Shop settings**
- `ShopSettings.order_email` is private, blank allowed, and uses the same plain-email rule as `email`. It is never in the public document.

**Customer-facing messages (exact)**
- "Orders are paused right now."
- "<Name> sold out a moment ago. Remove it to send your order."
- "We don't deliver on <Mon D>. Pick another day."
- "Enter a mobile number like 0917 123 4567."
- "Too many orders from this connection. Try again in a few minutes."

**Quality**
- TDD throughout.
- SQLite suite plus `python scripts/test_postgres.py`.
- Browser checks at 375 and 1440 in Chromium and WebKit, axe 0, CSP 0, CLS < 0.1.
- Design tokens, WCAG 2.2 AA, 44px targets, reduced motion respected.
- Do not deploy.

## Review Focus

1. **A product sells out or changes price after the customer loaded the shop.** The server prices from the catalog. A missing or unavailable product gives the sold-out message on `items.N.product`. The customer's input is kept. Tested in Task 2.
2. **Ordering at the cutoff, or from a phone set to another time zone.** Allowed days are computed in Manila time on both ends. The server rejects a day the browser offered by mistake with the "We don't deliver" message. Tested in Tasks 2 and 5.
3. **A double tap, or a retry after a network timeout.** The same `client_key` gives one order, and the replay returns 200 with the same number. Tested in Task 2.
4. **Confirming when stock is short, or confirming twice at once.** The sales command's message comes back, the order stays waiting, and no partial sale exists. A second confirm gets a 409 or the replay, never a second sale. Tested in Task 4.
5. **No API key, no recipient, or Resend down.** The order is still saved, the outbox row is failed or sent according to the rules above, the Orders page banner shows, and a later list call retries. Tested in Tasks 3 and 4.

---

### Task 1: Data, settings field, capability, limiter scope

**Files:**
- Create: `backend/orders/__init__.py`, `apps.py`, `models.py`, `migrations/0001_initial.py`, `tests/__init__.py`, `tests/test_models.py`
- Modify: `backend/backend/settings.py` (`LOCAL_APPS` += `"orders"`; `LOGGING.loggers` += `"orders"` at INFO with the `request_id` filter)
- Modify: `backend/shop/models.py`, `serializers.py`, plus `backend/shop/migrations/0003_shopsettings_order_email.py` for `order_email`
- Modify: `backend/accounts/permissions.py` and `frontend/src/lib/permissions.ts`
  - add `orders.manage` to OWNER;
  - in the frontend `canVisit`, map `/^\/orders(?:\/\d+)?\/?$/` to `orders.manage`.
- Modify: `backend/accounts/session_policy.py` (`SCOPES['OS'] = (5, 600)`) and `backend/accounts/login_limiter.py` (`limit()` uses the `SCOPES` default when the scope is `'OS'` and absent from `AUTH_RATE_LIMITS`; every other scope stays fail-closed)
- Test: `backend/orders/tests/test_models.py`, `backend/shop/test_api.py`, `tests/regression/test_permissions.mjs`

**Interfaces:**
- **Produces the models:**
  - `orders.models.OnlineOrder`, with the fields from the spec's data table plus the constraints:
    - `online_order_status_valid`;
    - `online_order_sale_only_when_confirmed`: `sale` is set only when the status is confirmed;
    - `online_order_total_not_negative`.
  - `OnlineOrder.shown_status` (a property) returns `'cancelled' | stored status`.
  - `orders.models.OrderEmail` (`status` is `pending|sent|failed`).
  - `orders.models.STATUSES = ('waiting', 'confirmed', 'declined')`.
- **Produces the setting:** `shop.ShopSettings.order_email`. It is in the managed document and the PUT body, and absent from the public one.

- [ ] **Step 1: Write the failing tests.**
  - `test_confirmed_order_needs_its_sale_and_others_have_none`: an `IntegrityError` for `waiting` with a sale, and for `confirmed` without one.
  - `test_shown_status_reads_a_cancelled_sale`: a confirmed order whose sale is cancelled shows `cancelled`.
  - `test_number_and_token_are_unique`.
  - Shop: `test_order_email_is_private_and_checked`. The public GET has no `order_email`. The managed document has it. A PUT with `'"?bcc=x"@a.com'` gives a 400 keyed `order_email`, and a valid one saves.
  - Limiter: `test_order_scope_defaults_when_not_configured`. `limit('OS') == 5` when `AUTH_RATE_LIMITS` lacks `OS`, and `limit('LA')` still raises `AuthUnavailable` when `LA` is missing.
  - Node: owner `can(owner,'orders.manage')`, staff false; `canVisit(owner,'/orders')` and `canVisit(owner,'/orders/7')` are true.

- [ ] **Step 2: Run** `cd backend && .venv/Scripts/python.exe manage.py test orders shop accounts --settings=backend.test_settings` and `node tests/regression/test_permissions.mjs`.
  Expected: they fail (no `orders` app, no field, no capability).

- [ ] **Step 3: Implement**, generate both migrations, and apply them locally with the scratch `django-migrate-all.cmd`.
- [ ] **Step 4: Run** the same commands.
  Expected: pass. The whole SQLite suite is green.
- [ ] **Step 5: Commit**
  `feat(orders): order tables, private order email, owner capability, order rate limit`

---

### Task 2: Placing an order and reading its status (public)

**Files:**
- Create: `backend/orders/delivery.py`, `pricing.py`, `limits.py`, `services.py`, `serializers.py`, `views.py`, `urls.py`, `tests/test_place.py`
- Modify: `backend/backend/urls.py` (`path('api/orders/', include('orders.urls'))`)

**Interfaces:**
- **Consumes:** the Task 1 models; `shop.models.ShopSettings`, `DeliveryHours`, `DeliveryTown`, `DayOff`; `products.boxes.shop_box_sizes`, `shop_assortments`, `follows_flavour_rule`, `flavour_rule_message`; `sales.box_lines.shop_box_price`; `accounts.login_limiter` internals (`keys`, `identity`, `allocate`, `locked`, `check`, `append`, `database_time`, `set_transaction_bounds`).
- **Produces, in `orders.delivery`:**
  - `earliest_delivery_date(now: datetime) -> date`
  - `delivery_date_problem(day: date, now: datetime) -> str | None`
- **Produces, in `orders.pricing`:** `price_order(items: list[dict], boxes: list[dict]) -> dict`. It returns `{items, boxes, subtotal}`; each box carries `{box_size, contents, price, name, assortment?, contents_named}`. It raises `ValidationError` with flat keys.
- **Produces, in `orders.limits`:** `admit_order(request) -> None`. It raises DRF `Throttled` with the exact message.
- **Produces, in `orders.services`:** `place_order(data: dict) -> tuple[OnlineOrder, bool]`, where the bool is "created". It creates the `OrderEmail` row in the same transaction.
- **Produces the endpoints:** `POST /api/orders/` (201 on create, 200 on replay) and `GET /api/orders/status/<token>/`.
  - Both use `business_actions = {'POST' or 'GET': 'catalog.public', 'OPTIONS': 'catalog.read'}`.
  - The response bodies follow the spec exactly.

- [ ] **Step 1: Write the failing tests** in `test_place.py`. Fix "now" with `unittest.mock.patch('django.utils.timezone.now')`.
  - `test_places_an_order_priced_by_the_server`: the client sends no prices. The response has the number pattern `^RD-\d{6}-[A-HJ-NP-Z2-9]{4}$`, `subtotal` equals the sum of catalog prices plus `shop_box_price`, `total == subtotal` when the town fee is null, and one `OrderEmail` row is `pending`.
  - `test_same_client_key_returns_the_same_order`: the second POST is 200, has the same number, and there is still 1 order.
  - `test_unavailable_product_is_named`: the product is switched off, giving a 400 with key `items.0.product` and the message "<name> sold out a moment ago. Remove it to send your order."
  - `test_box_must_follow_the_flavour_rule_and_be_on_sale`: a bad split gives `boxes.0.contents`; a box size that is not available gives `boxes.0.box_size`.
  - `test_delivery_day_rules`: lead days, the cutoff (Manila 15:00 with now at 15:01 shifts the earliest day by one), a day off, a closed weekday with `show_hours` on, the same weekday allowed with `show_hours` off, and +31 days rejected. Each rejection uses the key `delivery_date` and the message "We don't deliver on <Mon D>. Pick another day." (or "Pick a delivery day from <Mon D>." when the day is too early).
  - `test_paused_shop_refuses`: 400, key `non_field_errors`, "Orders are paused right now."
  - `test_phone_is_normalised_and_checked`: `0917 123 4567` is stored as `+639171234567`; `12345` gives the key `phone` with the exact message.
  - `test_inactive_town_and_unknown_payment_are_refused`.
  - `test_honeypot_saves_nothing`: `website='x'` gives 201 with 0 orders.
  - `test_rate_limit_after_five`: the sixth POST from the same address within 600 s gives 429 with the exact message.
  - `test_status_page_shows_first_name_only`: no `phone`, `address` or `note` keys, and `customer_first_name == 'Ana'` for "Ana Cruz". An unknown token gives 404.

- [ ] **Step 2: Run** `manage.py test orders.tests.test_place --settings=backend.test_settings`.
  Expected: FAIL (404s or import errors).
- [ ] **Step 3: Implement.** Do the pricing and saving inside `transaction.atomic()` with `select_for_update` on the products and the settings row. A `client_key` replay returns the existing order before any validation of the cart.
- [ ] **Step 4: Run** the orders tests, then the full SQLite suite.
  Expected: pass.
- [ ] **Step 5: Commit**
  `feat(orders): customers place orders and check their status`

---

### Task 3: Order emails through Resend

**Files:**
- Create: `backend/orders/emails.py`, `backend/orders/management/commands/send_order_emails.py`, `tests/test_emails.py`
- Modify: `backend/backend/settings.py` (`RESEND_API_KEY`, `ORDER_EMAIL_FROM`, `APP_URL` from the environment with the defaults above); `backend/.env.example` (the three keys with placeholders); `backend/orders/services.py` (after commit, call `queue_delivery(email_id)`)

**Interfaces:**
- **Produces, in `orders.emails`:**
  - `post_to_resend(payload: dict) -> None`. It raises on a non-2xx response or a timeout, and is the only network call.
  - `deliver(email_id: int) -> str`, returning `'sent' | 'failed' | 'skipped'`.
  - `send_due_emails(now: datetime | None = None, limit: int = 10) -> int`.
  - `queue_delivery(email_id: int) -> None`. It starts a daemon thread that calls `deliver`, or calls it inline when the setting `ORDER_EMAIL_INLINE = True`, which the tests use.
- **Produces the email text:** subject `New order <number> for <Mon D>`; the body lists the number, first name, town, delivery day, each line with its price, the total, and `<APP_URL>/orders/<id>`.

- [ ] **Step 1: Write the failing tests.** Patch `orders.emails.post_to_resend`.
  - `test_sends_to_the_private_address_without_contact_details`: the payload `to` is `[order_email]`; the subject and link match; the phone, address and note text are absent from the payload; the row becomes `sent` with `attempts == 1`.
  - `test_no_recipient_marks_failed`: `last_error == 'No email address set'`.
  - `test_without_api_key_logs_and_marks_sent`: `assertLogs('orders', 'INFO')` contains "would send" and not the email address.
  - `test_failure_is_retried_later_and_capped`: the first send raises, so the row is `failed`. `send_due_emails` before 5 minutes sends nothing. After 5 minutes it is `sent`. Once `attempts` reaches 5 the row is never picked again.
  - `test_order_is_saved_even_when_sending_fails`: the place endpoint returns 201 while `post_to_resend` raises.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The HTTP call uses `urllib.request.Request` with the JSON body, the headers `Authorization: Bearer`, `Content-Type: application/json` and `User-Agent: rowszein-delight`, and `timeout=10`.
  - `last_error` is the exception class name plus at most 120 characters, never the key.
- [ ] **Step 4: Run** the orders tests and the full suite. Expected: pass.
- [ ] **Step 5: Commit**
  `feat(orders): email the owner about each new order`

---

### Task 4: Owner endpoints: list, detail, confirm, decline

**Files:**
- Create: `backend/orders/owner.py` (owner-side services), `backend/orders/management/commands/clear_old_order_contacts.py`, `tests/test_owner.py`
- Modify: `backend/orders/views.py`, `urls.py`, `serializers.py`

**Interfaces:**
- **Consumes:** `sales.services.execute_sale`, `sales.services.Conflict`; the Task 3 `send_due_emails`.
- **Produces, in `orders.owner`:**
  - `confirm_order(order_id: int, actor) -> OnlineOrder`
  - `decline_order(order_id: int, actor, message: str) -> OnlineOrder`
  - `clear_old_contacts(today: date) -> int`
  - `sale_payload(order: OnlineOrder) -> dict`, which builds the `execute_sale` data from the snapshot
- **Produces the endpoints**, all with `business_actions` set to `orders.manage`:
  - `GET /api/orders/manage/?status=&page=`. It returns `{results, count, next, previous, waiting_count, email_problem}`, where `email_problem` is true when the latest outbox row failed with no recipient. Page size 20.
  - `GET /api/orders/manage/<id>/`, which includes `sale: {id, status} | null` and `shown_status`.
  - `POST /api/orders/manage/<id>/confirm/`
  - `POST /api/orders/manage/<id>/decline/` with body `{message}`
- **After responding,** the list view calls `send_due_emails()` and `clear_old_contacts(today)` through `transaction.on_commit`, or after the response is built.

- [ ] **Step 1: Write the failing tests.**
  - `test_only_the_owner_can_manage_orders`: staff and anonymous get 403 or 401 on every manage URL.
  - `test_confirm_records_the_sale_from_the_snapshot`:
    - Change the item price and the box size price after ordering.
    - Confirm returns 200 with status `confirmed`.
    - `Sale.date == delivery_date`.
    - The sale's line prices and box price equal the snapshot.
    - The notes start with `Online order RD-`.
    - Stock moved as for a counter sale.
  - `test_ready_made_box_changed_after_ordering_keeps_the_customers_donuts`: the sale's box contents equal the snapshot.
  - `test_confirm_refused_by_stock_keeps_the_order_waiting`: the sales command's message comes back with its status code, the order is `waiting`, and the sale count is unchanged.
  - `test_second_confirm_is_a_conflict`: 409, still one sale.
  - `test_decline_needs_a_message_and_shows_it`: a blank message gives 400 `message`; then 200, the status page shows `declined` and the message.
  - `test_cancelled_sale_shows_cancelled`: cancel through `execute_sale(action='sale_cancel', ...)`; the list, the detail and the public status all show `cancelled`.
  - `test_list_counts_waiting_and_retries_due_emails`.
  - `test_old_contacts_are_cleared`: a delivery date 91 days ago clears the phone, address and note and sets `contact_cleared_at`; one 89 days ago is untouched.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `confirm_order` locks the order row (`select_for_update`), checks that it is `waiting`, and calls `execute_sale` inside the same `transaction.atomic()`.
  - On a `ValidationError` or `Conflict` from sales it re-raises unchanged, so the transaction rolls back.
- [ ] **Step 4: Run** the orders tests, the full SQLite suite, and `python scripts/test_postgres.py orders sales`.
  Expected: all pass.
- [ ] **Step 5: Commit**
  `feat(orders): owner confirms or declines orders`

---

### Task 5: Frontend client, checkout helpers

**Files:**
- Create: `frontend/src/types/order.types.ts`, `services/order.service.ts`, `hooks/useOrders.ts`, `lib/orderCheckout.ts`
- Test: `tests/regression/test_order_checkout.mjs`

**Interfaces:**
- **Produces, in `lib/orderCheckout.ts`:**
  - `allowedDeliveryDates(settings: PublicShopSettings, now: Date, count = 14): string[]`. The `YYYY-MM-DD` dates are computed in Manila time with the Global Constraints rules.
  - `normalisePhone(raw: string): string | null`
  - `checkoutErrors(form: CheckoutForm, settings: PublicShopSettings, now: Date): Partial<Record<CheckoutField, string>>`
  - `orderPayload(cart: CartItem[], boxes: BoxLine[], sizes: {id: number; size: number}[], form: CheckoutForm, clientKey: string)`. Size boxes map `size` to the `box_size` id; ready-made boxes send `{assortment}`.
  - `rememberLastOrder({number, token}): void` and `lastOrder(): {number, token} | null`, using `localStorage` wrapped in try/catch.
  - `CheckoutField = "customer_name" | "phone" | "town" | "address" | "delivery_date" | "payment_method" | "note"`
- **Produces, in `order.service`:** `place`, `status(token, signal)`, `list(params)`, `get(id)`, `confirm(id)`, `decline(id, message)`.
  - The public calls use `fetch` with credentials omitted, as `shopSettingsService.getPublic` does.
  - The owner calls use `api`.
- **Produces, in `useOrders`:**
  - `useOrderStatus(token)`, with refetch on focus;
  - `useOrders(status, page)`, with `refetchInterval: 60_000`;
  - `useOrder(id)`, `useConfirmOrder()`, `useDeclineOrder()`;
  - `useWaitingCount()`, which reads `waiting_count`, is enabled only with `orders.manage`, and refetches every 60 s.

- [ ] **Step 1: Write the failing node tests.**
  - Allowed dates:
    - Manila 14:00 with lead 1 and cutoff 15:00 gives tomorrow first; 15:01 gives the day after.
    - A browser time of 23:30 UTC is already the next Manila day.
    - Days off and closed weekdays are skipped when hours are shown.
    - Every weekday is allowed when `hours` is `[]`.
    - Nothing is more than 30 days past the earliest day.
  - Phone: `"0917 123 4567"` → `"+639171234567"`, `"+63 917 123 4567"` → the same, `"12345"` → null.
  - `checkoutErrors` gives the exact messages, and is empty for a valid form.
  - `orderPayload`: the box of 6 with `size 6` maps to its id; a ready-made box sends `{assortment: id}`; no prices are sent; quantities come from the cart.
  - `lastOrder` returns null when storage throws.
- [ ] **Step 2: Run** `node tests/regression/test_order_checkout.mjs`. Expected: FAIL (the module is missing).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the node test, `npx tsc -b` and `npx eslint .` in `frontend/`. Expected: pass.
- [ ] **Step 5: Commit**
  `feat(orders): checkout helpers and order client`

---

### Task 6: Shop checkout, confirmation and status page

**Files:**
- Create: `frontend/src/pages/shop/CheckoutForm.tsx`, `OrderSent.tsx`, `frontend/src/pages/OrderStatusPage.tsx`, `frontend/src/pages/shop/checkout.css`
- Modify: `frontend/src/pages/shop/OrderSheet.tsx`
  - It now has three views: review, then details, then sent.
  - Its actions are **Continue to delivery details** (primary) and a secondary "Or message us on Messenger" link.
  - The order card is offered on the sent view with the real number.
- Modify: `frontend/src/pages/shop/ShopPage.tsx` (passes the sizes and settings; shows a "Your last order RD-…" link when `lastOrder()` exists)
- Modify: `frontend/src/router/index.tsx` (a public route `/order/:token` beside `/`)

**Interfaces:**
- **Consumes:** the Task 5 helpers and hooks; `useShopSettings`, `shopContact`, `feeLabel`, `PAYMENT_LABELS`, `formatTime`.

- [ ] **Step 1: Implement the three views.** Each one must have:
  - inline errors from `checkoutErrors`, then server field errors mapped onto the same fields;
  - focus moving to the first error;
  - one `client_key` per checkout, kept across retries and replaced after success;
  - a network failure showing "Couldn't send. Check your connection and try again." with the input kept;
  - the privacy notice text: "We use your name, number and address only to confirm and deliver this order. We clear them 90 days after delivery.";
  - the fee line using `feeLabel`, and the total;
  - a paused state disabling Continue with the pause message.
- [ ] **Step 2: The status page.**
  - It is a single card: number, a status pill (Waiting / Confirmed / Declined / Cancelled), delivery day, town, lines, totals, the owner's message, and a Messenger link.
  - It has skeleton, not-found and error states.
- [ ] **Step 3: Run** `npx tsc -b`, `npx eslint .`, `npx vite build` and every regression script. Expected: pass.
- [ ] **Step 4: Commit**
  `feat(orders): shop checkout and order status page`

---

### Task 7: Owner Orders section, badge, Home card, settings field

**Files:**
- Create: `frontend/src/pages/OrdersPage.tsx`, `frontend/src/pages/orders/OrderDetail.tsx`, `DeclineDialog.tsx`, `orders.css`
- Modify:
  - `frontend/src/config/navigation.ts`: `Orders` is first, with the icon `Inbox`, capability `orders.manage`, and an optional `badge` key read by `OwnerLayout`.
  - `frontend/src/layouts/OwnerLayout.tsx`: renders the badge count from `useWaitingCount`, with an accessible label such as "Orders, 3 waiting".
  - `frontend/src/pages/OwnerHomePage.tsx` or its `HubParts`: a "New orders" card linking to `/orders` when the waiting count is above 0.
  - `frontend/src/pages/ShopSettingsPage.tsx` and `settings/draft.ts`: the "New-order emails go to (only you see this)" field.
  - `frontend/src/router/index.tsx`: `/orders` and `/orders/:id`.

- [ ] **Step 1: Implement the list.**
  - Tabs: Waiting / Confirmed / Declined / All.
  - Each row shows the number, name, town, delivery day, total and shown status.
  - The list has skeleton, empty and error states and pagination.
  - It shows the email-problem banner ("New-order emails can't be sent: set the address in Shop settings.") when `email_problem` is true.
- [ ] **Step 2: Implement the detail page.**
  - Contact details with `tel:` and `sms:` links; when cleared, "Contact details cleared after 90 days."
  - Lines and totals.
  - Confirm (loading state) and Decline (dialog with a required message and counter /300).
  - A link to the sale when one exists.
  - After an action, a toast, then the page refreshes. A 409 shows the current state.
- [ ] **Step 3: Update the node draft test** for `order_email` in `test_shop_settings.mjs`. Watch it fail first, then pass.
- [ ] **Step 4: Run** `npx tsc -b`, `npx eslint .`, `npx vite build` and every regression script. Expected: pass.
- [ ] **Step 5: Commit**
  `feat(orders): owner Orders section`

---

### Task 8: Browser check, docs

**Files:**
- Modify: the scratch `partners_check.py` (mocks for `/api/orders/…` and a new scenario `orders`).
- Modify: `README.md`
  - Add an "Online orders" section.
  - Add `orders 0001`, `shop 0003` to the deployment list.
  - Note that `RESEND_API_KEY`, `ORDER_EMAIL_FROM` and `APP_URL` must be set on Render.
  - Update the test count.
- Modify: `docs/LOCAL_DEVELOPMENT.md`: the email behaviour without a key.

- [ ] **Step 1: The `orders` scenario,** in Chromium at 375 and 1440 and in WebKit (iPhone 13):
  - **Customer:**
    - Fill a box and an item, then Continue.
    - Submit empty and see the inline errors, with focus on the name.
    - Fill the form and pick the second allowed day.
    - Send. The confirmation shows the number and the status link.
    - The status page renders.
    - Double-click Send: the mock sees one `client_key`.
    - Paused: Continue is disabled.
  - **Owner:**
    - The badge shows 2.
    - Open the order and Confirm: the toast appears and the status updates.
    - Decline another: the message is required.
    - The email-problem banner shows when the mock flags it.
  - **Checks:** axe 0 (except the known `.hero-lid`), CSP 0, console clean apart from mocked error statuses, and CLS < 0.1 on the shop.
  - Take screenshots and look at them; fix layout problems before moving on.
- [ ] **Step 2: Run** the full verification: the SQLite suite, `python scripts/test_postgres.py`, `python scripts/test_test_postgres.py`, and the frontend type check, lint, build and every regression script.
  Expected: all green.
- [ ] **Step 3: Commit**
  `docs: online orders`
