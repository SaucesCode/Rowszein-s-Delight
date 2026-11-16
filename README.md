# 🍩 Rowszein's Delight Management System

A business management system and online shop built for **Rowszein's Delight** to help manage products, boxes, ingredients, sales, expenses, and business performance.

## Overview

Rowszein's Delight Management System is a web application for a donut shop. It has two sides:

* **The online shop** (`/`) where customers browse today's donuts, fill a box of 8, 12 or 24, or pick a ready-made box, then send the order on Messenger. There is no checkout or payment online; the shop confirms each order by message.
* **The management app** (behind sign-in) where the owner and staff run the counter, the pantry, the donut collection, recipe costing, expenses and reports.

## Features

### Online shop

* Shop window hero showing an open box of today's donuts, with the box sizes as tabs
* "Choose your box": fill a box yourself from the display case, or add a ready-made box in one tap
* Display case of today's donuts grouped by category, with price cards and premium "+₱ in a box" extras
* Order with boxes and single donuts, kept through a page refresh
* “From our friends” shelves with food from collab partners (muffins, cakes and more), sold one at a time in the same order and delivery
* Order card picture to save and send, and a pre-written Messenger message
* Contact form (Messenger or email)
* No visible sign-in link; staff sign in through a quiet mark at the end of the footer or at `/login`

### Management app

* Sign-in for the owner and staff, with role-based access
* Home: today's sales, what needs attention, and the week at a glance
* Sales register: tap-to-add catalog and order ticket
* Pantry: stock levels and stock updates
* Donut collection: menu, availability, best sellers, and the "extra when in a box" for premium donuts
* Boxes: box sizes and prices, and a builder for ready-made boxes
* Partners: collab partners and their items (their price plus your patong), what each partner is owed, and payments to them
* Recipe costing, shop expenses, and profit & analytics
* Read-only Pantry and Donut collection views for staff

## How boxes work

* The owner sets each **box size** (for example 8, 12 and 24) with one fixed price, and can switch a size on or off.
* Each size has a **most flavours** limit (it starts at 8 → 2, 12 → 3, 24 → 4). A box holds 1 up to that many flavours and **fills evenly** between them: 12 is 12, 6 + 6 or 4 + 4 + 4. Customers, the ready-made box builder and the Sales register all pick flavours, not single donuts.
* A donut can carry an **extra when in a box** (₱0 by default). A box costs its fixed price plus that extra for each premium donut inside.
* **Ready-made boxes** must fill their size exactly and follow the flavour rule. The shop only shows one when its size and every donut in it are on sale; one that breaks the rule is flagged on the Boxes page.
* The server calculates every box price, so the shop never shows a total the server would not.

API (under `/api/products/`):

| Endpoint | Who | Purpose |
| --- | --- | --- |
| `boxes/` | Anyone | Box sizes and ready-made boxes the shop can sell now |
| `box-sizes/`, `box-sizes/<id>/` | Owner manages, staff read | Box sizes and prices |
| `assortments/`, `assortments/<id>/` | Owner manages, staff read | Ready-made boxes and their contents |

### Boxes in the Sales register

* **Add a box** in the register: fill a size by tapping flavours (it fills evenly), or add a ready-made box in one tap. Boxes sit on the same sale as single donuts and partner items.
* A box keeps its name, price and contents as sold. The owner can lower a box's price for a discount; staff always use the shop's price.
* Pantry stock comes off for every donut inside a box, and cancelling the sale puts it all back. Editing a sale can remove a box or add another; to change what's inside a saved box, remove it and add it again.
* Sale history, receipts and the CSV/PDF exports list boxes with their contents. Analytics shows boxes sold, and best sellers count donuts inside boxes.

## How partner items work

* A **partner** is someone whose food the shop sells for them: a muffin, a cake or another baked good. The owner adds partners under Donut collection → Partners and can switch a partner off, which hides all their items from the shop.
* Partner items without a photo are **drawn as their treat** (whole cake, cake slice, cupcake, muffin, brownie, cookie or bread) in the donuts' style and flavour colours. The item form's **Shown in the shop as** guesses the drawing from the name; the owner can pick another. Rowszein's own items are always donuts.
* Each partner item has **their price** (what the partner is paid per item sold) and the owner's **patong** (the charge on top). The shop price is the two added together, and the patong can't be below ₱0.
* Customers order partner items with their donuts in one Messenger message, pay the shop, and get one delivery. Partner items never go in boxes, have no recipe, and never touch pantry stock.
* The whole order is recorded in the Sales register. Each sale keeps the payout rate it was sold at, so changing a rate later never changes what is already owed.
* **Amount owed** (on the Partners page) adds up each partner's items by order date; cancelled orders aren't counted. **Payments** to a partner are recorded there too. A payment entered by mistake is voided with a reason, never deleted. **Still to pay** is everything owed so far minus payments.
* Profit counts only the patong: profit is sales minus partner payouts minus expenses. Payments to partners must not also be entered as shop expenses.
* Contact details, notes and payout amounts are never shown to staff or to the public shop.

API (under `/api/products/`):

| Endpoint | Who | Purpose |
| --- | --- | --- |
| `partners/`, `partners/<id>/` | Owner manages, staff read (no contact or notes) | Partners |
| `partners/payouts/?date_from&date_to` | Owner | What each partner is owed, and still to pay |
| `partners/<id>/payments/` | Owner | List and record payments |
| `partners/<id>/payments/<id>/void/` | Owner | Void a payment, with a reason |

## Shop settings

The owner edits the shop's own details under **Shop settings** in the sidebar, with no developer needed. Staff can't see this page.

* **Delivery hours** for each weekday: closed, or one opening and closing time. They stay hidden from customers until **Show delivery hours in the shop** is switched on. If every day is closed, the shop says "Message us for delivery days".
* **Days off**: date ranges with an optional note, such as "Dec 24–26 · Christmas break". Days off that have ended are dropped when the page is saved.
* **Delivery towns**: Lucena City, Tayabas and Sariaya to start. Each town can be switched off and has its own fee. A blank fee shows "Fee confirmed when we reply", and ₱0 shows "Free delivery".
* **Ordering**:
  * how far ahead to order, with an optional cutoff, for example "Order by 3:00 PM for next-day delivery";
  * **Pause orders**: customers can still browse, but Save order card and Send on Messenger are disabled and show the pause message;
  * a **notice bar**.
* **Payment methods** (GCash, Maya, Bank transfer, Cash on delivery) and **contact** (Messenger link, required; Facebook page, email and phone, each hidden when blank).

How it behaves:

* The shop never waits for these settings before showing the donuts. While they load, or if they fail, it falls back to the original Messenger link and email.
* The notice and pause message show in a strip fixed to the bottom of the screen, so they never push the page down. They are also repeated in the order sheet.
* The server checks every value, for example that closing comes after opening and that the Messenger link really is a Messenger link.
* If the settings were changed in another tab, saving is refused instead of overwriting them, and the owner can reload the newer version.
* Every save is logged with who made it and which fields changed.

API (under `/api/shop/`):

| Endpoint | Who | Purpose |
| --- | --- | --- |
| `settings/` | Anyone | What the shop shows: contact, active towns, hours (when shown), upcoming days off, ordering rules |
| `settings/manage/` | Owner | Read and replace the whole settings document; send the `revision` you loaded |

## Online orders

Customers send their order from the shop, and it is saved in the app. Messenger is now optional.

**For customers:**

* After reviewing the order, they add delivery details: name, mobile number, town, address with a landmark, delivery day, how they'd like to pay, and a note.
* The delivery days offered follow Shop settings: lead time, cutoff, days off, open days when hours are shown, and up to 30 days ahead. The days are always worked out in Manila time.
* After sending, they see their order number (`RD-YYMMDD-XXXX`) and a link to `/order/<token>`, which shows Waiting, Confirmed, Declined or Cancelled, plus any message from the shop. The shop also remembers their last order on that phone.

**For the owner (Orders, first in the sidebar; owner only):**

* The sidebar shows how many orders are waiting, and Home shows a "New orders" card.
* **Confirm** records the sale through the same sales command as the register, so stock, reports and partner payouts all count it. The sale keeps the customer's prices and box contents even if the catalog changed since. If stock is short, the message says why and the order stays waiting.
* **Decline** needs a short message, which the customer sees.
* An order whose sale is later cancelled in Sales shows as Cancelled.
* The Orders page warns when new-order emails aren't reaching the owner: no address set, the last send failed, or no `RESEND_API_KEY` on the server.

**Behind the scenes:**

* **Pricing:** the server prices every order from the current catalog; the customer's browser never sends prices.
* **Duplicates:** a double tap or a retry sends the same order key, so only one order is saved.
* **Spam protection:** a connection can send at most 20 orders in 10 minutes (only saved orders count; set `OS` in `AUTH_RATE_LIMITS` to change it). The order endpoint accepts JSON only, so other websites can't submit orders through their visitors' browsers. If a retry changes an order that was already saved, the customer is told so instead of the changes being dropped.
* **Emails:** every new order is emailed to the private "New-order emails go to" address in Shop settings, through Resend.
  * The email is sent after the order is saved, and is retried when the owner opens Orders. A failed email never loses an order.
  * The email leaves out the customer's phone, address and note.
* **Privacy:** phone, address and note are cleared 90 days after the delivery day. The order and its sale stay.
* **Delivery fees:** the town's fee shows on the order, but it is not added to the sale yet; the sale notes mention it.

API (under `/api/orders/`):

| Endpoint | Who | Purpose |
| --- | --- | --- |
| `POST /` | Anyone | Send an order (rate limited) |
| `GET status/<token>/` | Anyone with the link | The customer's status page (first name only, no contact details) |
| `GET manage/?status=&page=` | Owner | Orders, the waiting count, and whether the email address is missing |
| `GET manage/<id>/` | Owner | One order with contact details |
| `POST manage/<id>/confirm/` | Owner | Record the sale |
| `POST manage/<id>/decline/` | Owner | Decline with a message |

Management commands: `send_order_emails` (retry due emails) and `clear_old_order_contacts` (the 90-day clean-up). The Orders page does both when opened.

## Design

The look is "pâtisserie pink": blush and white, cocoa-plum ink, one raspberry accent, thin gilt trim on the shop, Fraunces for display type and Geist for text. Colours, type, spacing and motion are role-named design tokens in `frontend/src/index.css`, so a palette change only touches values there. Motion respects the visitor's reduce-motion setting.

## Tech Stack

### Backend

* Django
* Django REST Framework
* PostgreSQL

### Frontend

* React 19 with Vite and TypeScript
* Tailwind CSS v4 (design tokens in `@theme`)
* TanStack Query, React Hook Form and Zod
* Lucide icons

## Development Status

🚧 Currently in development.

The project is being built incrementally, focusing on core business functionality before advanced features.

Current work (branch `pre-launch-hardening`): fixes from the [ISO standards review](docs/ISO_REVIEW.md), covering package upgrades, photo storage, HTTPS, accessibility and tests.

### Running the tests

```cmd
cd backend
.venv\Scripts\python.exe manage.py test --settings=backend.test_settings
```

This uses a temporary in-memory database and test-only keys, so it never touches a real database or `.env` secrets. All 329 tests pass; 17 PostgreSQL-only tests are skipped here. Frontend checks: `npm run build`, `npm run lint`, and `node tests/regression/<file>.mjs` from the repository root.

To run the whole suite on PostgreSQL too, including those 17 tests, start Docker Desktop and run this from the repository root:

```cmd
python scripts\test_postgres.py
```

It creates a throwaway PostgreSQL 17 container with a random name, password and port, runs the tests, and always removes it. Add app names to run only some tests, for example `python scripts\test_postgres.py sales`.

**Automatic checks:** every push and pull request on GitHub runs four checks (`.github/workflows/checks.yml`):

* the backend tests on SQLite, plus a check that no migration is missing;
* the backend tests on a throwaway PostgreSQL;
* the frontend type check, lint, build and regression scripts;
* a dependency audit (`pip-audit` and `npm audit --audit-level=high`).

Known gaps:

* Box screens and the box shop were checked in a browser against a simulated API, not yet end to end with a signed-in owner on the local server.

Earlier checkpoint: Phase 1B.3 disposable database verification was completed for owner review on `codex/phase-1b3-disposable-verification` (the SQLite migration fix is at `b9957e0`). Its report has since been removed from `docs/`. Production, dependencies, infrastructure and deployment validation remain separate outstanding gates; the application is not production-ready.

## Deployment

* **Frontend:** Vercel, with `frontend` as the root directory. `frontend/vercel.json` sends `/api` to the backend and sets the security headers, including a Content-Security-Policy that only allows the site's own scripts and photos from Cloudinary. A new outside service (for example an analytics script) must be added to that policy, or the browser will block it.
* **Backend:** Render. Every deploy must run `python manage.py migrate` (for example in the build command) so new database changes, such as `products/0005_boxes`, `products/0006_partners`, `products/0007_boxsize_max_flavors`, `products/0008_product_shape`, `sales/0004_sale_current_boxes`, `shop/0001_initial`, `shop/0002_seed_settings`, `shop/0003_shopsettings_order_email`, `accounts/0004_order_rate_limit_scope` and `orders/0001_initial` and `orders/0002_order_fingerprint`, are applied. Online orders also need `RESEND_API_KEY`, `ORDER_EMAIL_FROM` and `APP_URL` set on Render (see `backend/.env.example`); without the key, new-order emails are only logged. Before launch, check that `AUTH_PROXY_MODE` and `AUTH_TRUSTED_PROXY_CIDRS` let the backend see each customer's own address behind Vercel and Render; otherwise all customers share one order limit.
* **Photos:** stored on Cloudinary in production. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` on Render; without them, photos are saved to the server's disk, which Render wipes on redeploy. Photos must be JPG, PNG or WEBP and under 5 MB.
* **Database backups:** the live database is on Supabase. Take and check a backup every week and before every deploy with a migration; see [Database backup and restore](docs/BACKUP_AND_RESTORE.md).
* **Logs:** the backend writes one JSON line per event to stdout (Render's Logs tab), including every sign-in. Each response has an `X-Request-ID` header that matches its log lines.
* **Settings:** every environment setting the backend reads is listed, without values, in [`backend/.env.example`](backend/.env.example).

## Documentation

Project documentation can be found in the `docs/` folder.

For local startup and shutdown commands, see the [Windows development guide](docs/LOCAL_DEVELOPMENT.md). After pulling the box work, apply the new migration to your local database before starting Django.

## License

This project is being developed for learning, portfolio, and business management purposes.
