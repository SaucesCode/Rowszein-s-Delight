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
* Recipe costing, shop expenses, and profit & analytics
* Read-only Pantry and Donut collection views for staff

## How boxes work

* The owner sets each **box size** (for example 8, 12 and 24) with one fixed price, and can switch a size on or off.
* A donut can carry an **extra when in a box** (₱0 by default). A box costs its fixed price plus that extra for each premium donut inside.
* **Ready-made boxes** must fill their size exactly. The shop only shows one when its size and every donut in it are on sale.
* The server calculates every box price, so the shop never shows a total the server would not.

API (under `/api/products/`):

| Endpoint | Who | Purpose |
| --- | --- | --- |
| `boxes/` | Anyone | Box sizes and ready-made boxes the shop can sell now |
| `box-sizes/`, `box-sizes/<id>/` | Owner manages, staff read | Box sizes and prices |
| `assortments/`, `assortments/<id>/` | Owner manages, staff read | Ready-made boxes and their contents |

Selling boxes at the counter (Sales register, with stock deducted per donut) is not built yet.

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

This uses a temporary in-memory database and test-only keys, so it never touches a real database or `.env` secrets. All 153 tests pass; 17 PostgreSQL-only tests are skipped. Frontend checks: `npm run build`, `npm run lint`, and `node tests/regression/<file>.mjs` from the repository root.

Known gaps:

* Box screens and the box shop were checked in a browser against a simulated API, not yet end to end with a signed-in owner on the local server.
* The 17 PostgreSQL-only tests (concurrency, precision, migrations) need the disposable PostgreSQL runner, which is no longer in the repository.

Earlier checkpoint: Phase 1B.3 disposable database verification was completed for owner review on `codex/phase-1b3-disposable-verification` (the SQLite migration fix is at `b9957e0`). Its report has since been removed from `docs/`. Production, dependencies, infrastructure and deployment validation remain separate outstanding gates; the application is not production-ready.

## Deployment

* **Frontend:** Vercel, with `frontend` as the root directory. `frontend/vercel.json` sends `/api` to the backend and sets the security headers, including a Content-Security-Policy that only allows the site's own scripts and photos from Cloudinary. A new outside service (for example an analytics script) must be added to that policy, or the browser will block it.
* **Backend:** Render. Every deploy must run `python manage.py migrate` (for example in the build command) so new database changes, such as `products/0005_boxes`, are applied.
* **Photos:** stored on Cloudinary in production. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` on Render; without them, photos are saved to the server's disk, which Render wipes on redeploy. Photos must be JPG, PNG or WEBP and under 5 MB.
* **Database backups:** the live database is on Supabase. Take and check a backup every week and before every deploy with a migration; see [Database backup and restore](docs/BACKUP_AND_RESTORE.md).
* **Logs:** the backend writes one JSON line per event to stdout (Render's Logs tab), including every sign-in. Each response has an `X-Request-ID` header that matches its log lines.
* **Settings:** every environment setting the backend reads is listed, without values, in [`backend/.env.example`](backend/.env.example).

## Documentation

Project documentation can be found in the `docs/` folder.

For local startup and shutdown commands, see the [Windows development guide](docs/LOCAL_DEVELOPMENT.md). After pulling the box work, apply the new migration to your local database before starting Django.

## License

This project is being developed for learning, portfolio, and business management purposes.
