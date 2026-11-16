# Online orders: design

## Intent

Rowszein's Delight is an online-only bakery in Lucena City, Philippines. It delivers to Lucena City, Tayabas and Sariaya.

Today a customer fills an order in the shop, gets an order card, and sends it on Messenger. The owner then retypes it into the Sales register. **The owner doesn't reliably receive those Messenger orders, so orders get missed.** The order number on the card (`RD-1114-4F8K`) is made up in the browser and saved nowhere.

The fix: the app becomes the place orders arrive.

- **Customer:** sends the order from the shop. It is saved in the app as "waiting for confirmation", and the customer gets a real order number and a status page.
- **Owner:** gets an email for every new order and sees it in an **Orders** list. One tap on **Confirm** records it as a sale through the existing sales command, which takes stock off and counts toward reports and partner payouts. **Decline** sends the customer a short reason.

Messenger stays as an optional "Message us" link and is never required to order.

## Goals

1. **Customer checkout in the shop.**
   - **Delivery details:** after reviewing their order, the customer enters:
     - **name**;
     - **mobile number**;
     - **town**: an active town from Shop settings;
     - **street address with landmark**;
     - **delivery day**: only days the shop's rules allow;
     - **preferred payment method**: from Shop settings;
     - an optional **note**.
   - **Sending:** tapping **Send order** saves the order, so no account is needed.
   - **Confirmation screen:** shows the order number, a **Check your order** link to the status page, and the optional saved picture of the order card, which now carries the real number.
2. **Customer status page** at `/order/<token>`, reachable without signing in.
   - It shows the order number, items, delivery day, town and total.
   - It shows the status: *Waiting for confirmation*, *Confirmed* or *Sorry, we can't do this one*, plus the owner's message.
   - The shop remembers the customer's last order on that device and offers a link back to it.
3. **Owner Orders section** (sidebar plus Home).
   - **List:** filtered by Waiting, Confirmed or Declined, newest first, with a count of waiting orders on the sidebar item and a "New orders" card on Home. It refreshes every 60 seconds while the app is open.
   - **Detail:** customer name, a tappable phone (call and SMS links), town, address, delivery day, payment preference, note, items and boxes, and totals.
   - **Confirm:** records the sale and links it to the order. If something in the order isn't available, the sales command's message ("X isn't available.") appears and nothing is recorded.
   - **Decline:** requires a short message, which the customer sees.
4. **Email to the owner** for every new order, through **Resend's HTTPS email API**. It works on any Render plan; the free plan may block normal email ports. *(Builder-check call.)*
   - The order is saved first. The email is sent after the order is committed and retried if it fails, so a slow or broken email service never loses an order or makes the customer wait.
   - Which address receives these emails is a new private Shop setting, **New-order emails go to**.
5. **Privacy.**
   - The checkout shows a short privacy notice: what is collected, why, and how long it is kept.
   - The customer's phone, address and note are cleared 90 days after the delivery day. The order, its items and its sale stay.

## Non-goals

- **Payment inside the app** (GCash links, screenshot uploads). Payment is arranged after the owner confirms, as today.
- **Delivery fee accounting.** Fees are still undecided.
  - The order shows the town's fee from Shop settings, or "Delivery fee confirmed when we reply" when none is set.
  - The fee is not added to the sale. The sale notes mention it.
- **Customer accounts, order editing by the customer, or customer cancellation in the app.** The customer messages the shop for changes.
- **Automatic Messenger or SMS messages, and phone push notifications.**
- **Staff access to Orders.** Owner only in this version.
- **Changing how sales, stock or reports work.**

## Anti-goals (a failure even if it works)

- **A lost order.** An order the customer saw as sent but that isn't in the app, for any reason: the email failing, a double tap, a slow network.
- **Wrong prices.** The customer's browser decides a price, or an order is priced from anything other than the current catalog at the time it is sent.
- **Customer data exposure.** Another customer's details are reachable by guessing a number or link, or appear in logs.
- **Spam.** The form can be flooded or used to spam the owner's inbox.
- **Weakened sales safeguards.** Confirming an order bypasses or loosens any rule of the sales command: stock, revision, idempotency, audit.
- **A slower or jumpier shop.** The new step must not slow the shop or make the page jump (CLS < 0.1).

## Constraints

- **Stack and existing patterns:**
  - Django 5.2 + DRF, React 19 + TS + TanStack Query.
  - `BusinessPermission` with `business_actions`, and capabilities in `accounts/permissions.py` mirrored in `frontend/src/lib/permissions.ts`.
  - Responses use the `{success, data, message}` / `{success: false, error}` shape. Field errors use the flat keys `apiFieldErrors` reads.
- **Sales:** `sales/services.execute_sale(action='sale_create', actor, key, data)` is the only way to record a sale. It is idempotent by `key` and checks stock and availability.
- **Box rules:**
  - box prices come from `sales/box_lines.shop_box_price` and `new_box_line`;
  - flavour rules come from `products/boxes`;
  - the shop only offers what `products/boxes.shop_box_sizes` and `shop_assortments` return.
- **Shop rules** come from `shop.ShopSettings` and its related tables:
  - active towns and their fees;
  - `lead_days` and `order_cutoff`;
  - days off;
  - weekday hours (with the `show_hours` switch);
  - `orders_paused`;
  - payment methods.
- **Rate limiting:** the database-backed limiter in `accounts/login_limiter.py` has scopes in `accounts/session_policy.SCOPES` and limits in the `AUTH_RATE_LIMITS` setting. Online orders get a new scope.
- **Time zone:** `TIME_ZONE = "Asia/Manila"`. "Today" and "now" mean Manila time.
- **Quality:**
  - TDD;
  - the PostgreSQL suite through `scripts/test_postgres.py`, plus the GitHub checks;
  - browser checks at 375 and 1440 in Chromium and WebKit, with axe 0 violations and 0 CSP errors;
  - WCAG 2.2 AA, design tokens, and motion tokens with reduced motion respected.
- **Secrets:** the Resend API key lives only in an environment variable (`RESEND_API_KEY`), documented in `.env.example`. It is never committed.
- **Deploying:** don't deploy. New migrations go in the README deployment list.

## Approaches considered

| Approach | Trade-off | Decision |
|---|---|---|
| **A separate Online order record. Confirming calls the existing sales command.** | Sales and stock rules stay untouched. An order can wait, be declined, or link to its sale. More new code. | **Chosen by the owner.** |
| Save online orders as "pending" sales | Fewer tables, but every sale takes stock and counts as money the moment it exists. A pending state would loosen the most tightly checked part of the app everywhere. | Dropped. |
| A Google Form or a Messenger bot | No build, but orders live outside the app with no link to the menu or stock. That is the same problem as now. | Dropped. |

The email is sent from a small **outbox** table: one row per order email, written in the same transaction as the order, then sent after commit and retried. The alternatives were sending inside the request (a slow email service would slow or fail the customer's order) and a task queue like Celery with Redis (too much infrastructure for one email per order).

## Design

### Data (new Django app `orders`)

**`OnlineOrder`**

| Field | Notes |
|---|---|
| `number` | Unique, `RD-YYMMDD-XXXX`. The date is Manila, the suffix is 4 random characters from an unambiguous alphabet (no 0/O/1/I), and the number is regenerated on collision. |
| `token` | Unique, unguessable (`secrets.token_urlsafe(24)`). Used only in the customer's status link, never the number. |
| `client_key` | Unique. The checkout sends a fresh random key per order, so a double tap or retry returns the same order instead of creating two. |
| `status` | `waiting` / `confirmed` / `declined`, with a check constraint. The status shown to the owner and the customer is **Cancelled** when the linked sale has been cancelled in Sales; it is read from the sale, never stored. *(Builder-check call.)* |
| Customer | `customer_name` (1–80), `phone` (Philippine mobile: `09XXXXXXXXX` or `+639XXXXXXXXX`, stored normalised as `+639…`), `address` (1–200), `note` (0–300). `<` and `>` are rejected in the text fields. |
| `town_name` | Snapshot of the town's name, plus `town` (FK, `SET_NULL`). |
| `delivery_fee` | Snapshot of the town's fee at order time. Null means "confirmed when we reply". |
| `delivery_date`, `payment_method` | |
| `items` | JSON snapshot: `[{product, name, unit_price, quantity, partner}]`, priced by the server. |
| `boxes` | JSON snapshot, in the **sale box input shape** so Confirm can pass them straight to `execute_sale`: `{box_size, contents:[{product, quantity}]}` or `{assortment}`. Also stored for display: `name`, `price`, `contents` with names. |
| `subtotal` | Items plus boxes. `total` is `subtotal` + fee, or `subtotal` alone when the fee is null. |
| Decision | `owner_message` (0–300), `decided_at`, `decided_by` (FK User, null). |
| `sale` | OneToOne to `sales.Sale`, null until confirmed. |
| `contact_cleared_at` | Set when the 90-day clean-up runs. |
| `created_at` | |

Indexes: `(status, created_at)` and `delivery_date`.

**`OrderEmail`** (the outbox): `order` FK, `status` (`pending` / `sent` / `failed`), `attempts`, `last_error` (short, no secrets), `sent_at`, `created_at`.

**`ShopSettings` gains `order_email`**: private, blank allowed, a plain address only (the same rule as the contact email). It is edited on the Shop settings page under Contact, as "New-order emails go to (only you see this)". It never appears in the public settings.

### Placing an order: `POST /api/orders/` (public)

**Body:**

```json
{
  "client_key": "uuid",
  "customer_name": "…", "phone": "…", "address": "…", "note": "…",
  "town": 1, "delivery_date": "YYYY-MM-DD", "payment_method": "gcash",
  "items": [{"product": 3, "quantity": 2}],
  "boxes": [{"box_size": 2, "contents": [{"product": 3, "quantity": 6}, {"product": 5, "quantity": 6}]}, {"assortment": 4}],
  "website": ""
}
```

The `website` field is a hidden honeypot. When it is filled, the server answers as if it accepted the order and saves nothing.

**The server checks, in one transaction:**

- **Shop state:** orders aren't paused.
- **Customer fields** pass the rules above.
- **The town** is active.
- **Payment method:** it is one of the shop's methods. If the shop lists none, the field is optional.
- **Delivery date:**
  - it is on or after the earliest allowed day;
  - the earliest allowed day is today + `lead_days`, plus one more day if `order_cutoff` is set and Manila time is past it;
  - it is at most 30 days ahead;
  - it is not inside a day off;
  - when `show_hours` is on, the weekday is open (when hours are hidden, every weekday is allowed).
- **Items:**
  - 1–50 lines, quantity 1–99, no duplicate products;
  - each product is available in the shop: `is_available`, active category, and partner active if it has one;
  - prices come from the current catalog.
- **Boxes:**
  - 0–20;
  - each `box_size` is one the shop offers, and its contents follow the flavour rule;
  - each assortment is one the shop offers;
  - prices come from `shop_box_price` / the assortment price.
- **At least one item or box.**

**Rate limit:** a new limiter scope, `OS` (online order submit), with a default of 5 orders per 10 minutes per client address. It is configurable through `AUTH_RATE_LIMITS`. Over the limit gives a 429 with a friendly message.

**On success:**

- Save the order (`waiting`) and an `OrderEmail` row in the same transaction.
- After commit, try to send the email.
- Return 201 with `{number, token, status, delivery_date, town_name, items, boxes, subtotal, delivery_fee, total}`.
- A repeat with the same `client_key` returns the same order with 200.

**Errors:** field errors use flat keys (`items.1.product`, `boxes.0.contents`, `delivery_date`, …), with messages written for customers. For example:

- "Ube Cream sold out a moment ago. Remove it to send your order."
- "We don't deliver on Dec 25. Pick another day."
- "Orders are paused right now."

### Status page: `GET /api/orders/status/<token>/` (public)

Returns:

- `number`, `status` (including the shown `cancelled`), `owner_message`, `created_at`;
- `delivery_date`, `town_name`;
- `items`, `boxes`, `subtotal`, `delivery_fee`, `total`;
- the customer's **first name only**.

It never returns the phone, address or note. An unknown token gives 404.

### Owner endpoints (capability `orders.manage`, owner only)

- **`GET /api/orders/manage/?status=waiting|confirmed|declined&page=`:** paginated, newest first. It includes `waiting_count`.
- **`GET /api/orders/manage/<id>/`:** the full order, including contact details unless cleared, and the linked sale's id and status.
- **`POST /api/orders/manage/<id>/confirm/`:**
  - It works only on `waiting` orders; otherwise it returns 409 with the current state.
  - It calls `execute_sale(action='sale_create', actor=owner, key=f'online-order-{id}', data=...)` with:
    - `date = delivery_date`;
    - `sale_items` from the snapshot, at the snapshot prices;
    - `boxes` from the snapshot, **with each box's snapshot `price`**, so the sale keeps what the customer saw. A ready-made box is sent as `{assortment, price}` when its current donuts still match the snapshot. Otherwise it is sent as `{box_size, contents, price}` with the snapshot donuts. *(Builder-check call: the customer's snapshot wins over later catalog changes.)*;
    - `notes = "Online order RD-…, <name>, <town>; delivery fee: <fee or 'to confirm'>"`.
  - Then it marks the order `confirmed`, links the sale, and records the decision, all in the same transaction as the sale.
  - A refusal from the sales command (stock, availability) comes back as 400 or 409 with its message, and the order stays `waiting`.
- **`POST /api/orders/manage/<id>/decline/`:** `{message}` is required (1–300). It works only on `waiting` orders.
- **Retrying emails:** listing or opening orders retries `pending` or `failed` order emails that are older than 5 minutes and have fewer than 5 attempts, after the response is sent. A management command, `send_order_emails`, does the same on demand. These are my calls; Render offers no free background worker.
- **The 90-day clean-up:** opening the owner list clears the contact details of orders whose delivery day was more than 90 days ago, and sets `contact_cleared_at`. A management command, `clear_old_order_contacts`, does the same. These are my calls.

### Email

- **Sending:** one small function posts to Resend's `POST https://api.resend.com/emails` with a 10-second timeout, using `RESEND_API_KEY` and `ORDER_EMAIL_FROM`. The default sender is `Rowszein's Delight <onboarding@resend.dev>`; on Resend's free plan without a verified domain, that sender may only email the account owner's own address, which is exactly this case. `APP_URL` gives the link base.
- **Without configuration** (no `RESEND_API_KEY`: local and tests): the email is written to the log as "would send" and the outbox row is marked `sent`. Tests replace the function.
- **Subject:** `New order RD-… for <delivery day>`.
- **Body:** the order number, first name, town, delivery day, items and boxes with prices, the total, and a link to the order in the app (`<APP_URL>/orders/<id>`).
- **Kept out of the email:** the phone, the address and the note. They stay in the app.
- **No recipient set:** with no `order_email`, the outbox row is marked `failed` with "No email address set", and the Orders page shows a banner telling the owner to set one.
- **Logging:** each send logs `order_id`, `attempt` and `outcome`. It never logs addresses or content.

### Shop (customer side)

- **Starting checkout:** the order sheet's actions become **Continue to delivery details** (primary) and the existing Messenger link (secondary, "Or message us").
- **The checkout step** is in the same sheet, with fields in this order:
  1. name
  2. mobile number
  3. town (select)
  4. address and landmark
  5. delivery day: a list of the next allowed days, computed in the browser from the public settings using the same rules, and checked again by the server
  6. payment preference
  7. note

  Then the privacy notice, the total with the fee line, and **Send order**.
- **Behaviour:**
  - Inline errors appear next to each field, and server errors are mapped onto the same fields.
  - Input is never lost on error.
  - The button shows a loading state.
  - A network failure keeps the order and offers **Try again**, which reuses the same `client_key`.
- **After sending:**
  - The cart and boxes clear.
  - The confirmation screen shows the number, the status link and "We'll confirm by text or call on <phone>." The customer's last order (number and token) is remembered in `localStorage` for the "Your last order" link.
- **The status page `/order/:token`:** a calm single card that rechecks when it regains focus.
- **While paused,** Continue is disabled with the pause message, as today.

### Owner app

- **Sidebar:** an `Orders` section (owner only, capability `orders.manage`), first in the list, with the waiting count as a badge.
- **Home:** a "New orders" card when any are waiting.
- **List and detail pages** follow the existing management-page patterns:
  - skeleton loading, empty and error states;
  - Confirm with a loading state;
  - Decline in a dialog with a required message;
  - after either action, focus returns to the list and a toast confirms it.

## Left to the builder

- Component split, styling, and the exact customer-facing wording within the tone above.
- The order card picture on the confirmation screen.
- How the browser computes the allowed days (a pure helper shared with tests).
- Pagination size, and the exact limiter scope letters.

## Settled after the builder check (my calls)

- **Email transport:** Resend's HTTPS API instead of Gmail SMTP, because Render's free plan may block email ports. The outbox design is unchanged.
- **Confirm keeps the customer's snapshot** for box prices and donuts, not the current catalog.
- **A cancelled linked sale** shows the order as Cancelled to the owner and the customer, read from the sale. Edits made to the sale in Sales are not mirrored; the order remains what was placed.
