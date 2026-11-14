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

This uses a temporary in-memory database and test-only keys, so it never touches a real database or `.env` secrets. All 278 tests pass; 17 PostgreSQL-only tests are skipped. Frontend checks: `npm run build`, `npm run lint`, and `node tests/regression/<file>.mjs` from the repository root.

Known gaps:

* Box screens and the box shop were checked in a browser against a simulated API, not yet end to end with a signed-in owner on the local server.
* The 17 PostgreSQL-only tests (concurrency, precision, migrations) need the disposable PostgreSQL runner, which is no longer in the repository.

Earlier checkpoint: Phase 1B.3 disposable database verification was completed for owner review on `codex/phase-1b3-disposable-verification` (the SQLite migration fix is at `b9957e0`). Its report has since been removed from `docs/`. Production, dependencies, infrastructure and deployment validation remain separate outstanding gates; the application is not production-ready.

## Deployment

* **Frontend:** Vercel, with `frontend` as the root directory. `frontend/vercel.json` sends `/api` to the backend and sets the security headers, including a Content-Security-Policy that only allows the site's own scripts and photos from Cloudinary. A new outside service (for example an analytics script) must be added to that policy, or the browser will block it.
* **Backend:** Render. Every deploy must run `python manage.py migrate` (for example in the build command) so new database changes, such as `products/0005_boxes`, `products/0006_partners`, `products/0007_boxsize_max_flavors`, `products/0008_product_shape`, `sales/0004_sale_current_boxes`, `shop/0001_initial` and `shop/0002_seed_settings`, are applied.
* **Photos:** stored on Cloudinary in production. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` on Render; without them, photos are saved to the server's disk, which Render wipes on redeploy. Photos must be JPG, PNG or WEBP and under 5 MB.
* **Database backups:** the live database is on Supabase. Take and check a backup every week and before every deploy with a migration; see [Database backup and restore](docs/BACKUP_AND_RESTORE.md).
* **Logs:** the backend writes one JSON line per event to stdout (Render's Logs tab), including every sign-in. Each response has an `X-Request-ID` header that matches its log lines.
* **Settings:** every environment setting the backend reads is listed, without values, in [`backend/.env.example`](backend/.env.example).

## Documentation

Project documentation can be found in the `docs/` folder.

For local startup and shutdown commands, see the [Windows development guide](docs/LOCAL_DEVELOPMENT.md). After pulling the box work, apply the new migration to your local database before starting Django.

## License

This project is being developed for learning, portfolio, and business management purposes.
