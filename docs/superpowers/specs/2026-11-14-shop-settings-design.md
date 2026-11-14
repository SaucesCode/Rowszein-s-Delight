# Shop settings — design

## Intent

Rowszein's Delight is an online-only bakery in Lucena City, Philippines. It delivers to Lucena, Tayabas and Sariaya. Today the shop's business details are fixed in the code: the Messenger link and email are constants in `frontend/src/pages/shop/order.ts`, and the shop shows no delivery days, hours or towns at all.

The owner wants to change those details without a developer. The goal is "just the things that need to change", not a page editor.

This is also groundwork for the next two projects:

- **Saving online orders** will pick a town and delivery day from these settings and enforce the order cutoff.
- **SEO/AEO/GEO** will publish the hours, delivery area and payment methods.

## Goals

The owner can edit all of the following on one **Shop settings** page:

1. **Delivery hours** per weekday: closed, or one opening and closing time. Example: Tue–Sun, 9:00 AM–6:00 PM.
2. **Days off**: a date range (from, to) plus a short note. Example: "Dec 24–26, Christmas break".
3. **Delivery towns**: a name, an on/off switch and a fee.
   - The fee may be left blank, because the owner hasn't decided fees yet. Blank shows as "Delivery fee confirmed when we reply."
   - The towns are seeded with Lucena City, Tayabas and Sariaya, with no fee.
4. **How far ahead to order**:
   - a lead time in days (0 = same day, 1 = next day, … up to 7);
   - an optional daily cutoff time, as in "Order by 3:00 PM for next-day delivery".
5. **Pause orders**: a switch plus a short message. While it's on, the shop stays browsable but its order actions say orders are paused.
6. **Notice bar**: optional short text shown at the top of the shop.
7. **Contact details**: Messenger link, Facebook page link, email and phone.
8. **Payment methods**: checkboxes from a fixed list (GCash, Maya, Bank transfer, Cash on delivery).

The public shop reads all of this and shows:

- the notice bar;
- the paused state;
- a delivery block with hours, upcoming days off, towns with fees, the cutoff line and payment methods;
- the contact links (Messenger, Facebook, email, phone) in the contact section and footer, replacing `SHOP_MESSENGER` and `SHOP_EMAIL`.

## Non-goals

- Editing page text, layout, images or the order steps. The owner explicitly does not want a page editor.
- Taking or saving orders. That is the next project; this one only stores and displays the rules.
- Delivery fees calculated into an order total. That also belongs to the next project.
- Split shifts (two time windows in a day). One window per day; days off cover exceptions.
- Staff access. Only the owner sees and edits the page.

## Anti-goals (a failure even if it works)

- **The shop breaks or goes blank** when settings fail to load, or before the owner first saves them. Today's Messenger link and email must keep working as fallbacks.
- **Bad values reach the shop**: a closing time before the opening time, a backwards days-off range, a "Messenger" link pointing to some other site, an HTML or script string. The server is the gate, not the form.
- **Two open tabs silently overwrite each other.**
- **The shop gets slower**, or content jumps when the notice bar arrives (CLS must stay < 0.1). Settings must never block the pastry case from rendering.
- **Staff can read or change settings** through the API.

## Constraints

- Backend: Django 5.2 + DRF, existing patterns.
  - `BusinessPermission` with `business_actions`.
  - Capabilities are declared in `accounts/permissions.py`. Add `shop.manage` to `OWNER` only.
  - Public reads use the existing `'catalog.public'` action, which lets anonymous visitors read.
- `TIME_ZONE = "Asia/Manila"`. "Today" and "upcoming" mean Manila dates.
- Frontend: React 19, TanStack Query, the existing services/hooks layout, design tokens, WCAG 2.2 AA, 44px targets, the motion tokens, and reduced motion respected.
- CSP in `frontend/vercel.json`. No inline scripts and no new external origins.
- TDD for backend logic and frontend helpers. The browser check (Chromium 375/1440 plus WebKit, axe 0 violations, 0 CSP errors) runs before anything is called done.
- Migrations must also run on the live database at the next deploy; record them in the README's deployment list. Do not deploy.

## Approaches considered

| Approach | Trade-off | Decision |
|---|---|---|
| **A. Proper tables.** One shop-wide settings row plus small tables for weekday hours, towns and days off. | The server checks every value, with database constraints where they fit. Slightly more code. | **Chosen by the owner.** |
| B. One free-form JSON settings blob | Fast to extend, but the server can't validate it properly; a 25:00 closing time could reach the shop. | Dropped. |
| C. A settings file in the code | Every change needs a developer and a deploy, which is the opposite of the goal. | Dropped. |

## Design

### Data (new Django app `shop`)

**`ShopSettings`**, a single row (`pk = 1`, enforced):

| Field | Rule |
|---|---|
| `messenger_url` | Required (every order goes through Messenger); `https://m.me/...` or `https://www.messenger.com/...` only |
| `facebook_url` | Blank, or `https://(www.\|m.)facebook.com/...` or `https://fb.com/...` |
| `email` | Valid email or blank |
| `phone` | Blank, or same pattern as the shop contact form: `^[+0-9()\-\s]{7,20}$` |
| `notice` | Up to 160 chars, blank = no bar |
| `orders_paused` | bool |
| `pause_message` | Up to 160 chars, used when paused, with a sensible default line if blank |
| `lead_days` | 0–7 |
| `order_cutoff` | Optional time |
| `show_hours` | bool, default false. Off means the shop shows no hours (the "not set" state), whatever the seven rows hold |
| `payment_methods` | A subset of `gcash`, `maya`, `bank_transfer`, `cod`, stored in that fixed order with no duplicates |
| `revision` | Integer, incremented on every save |
| `updated_at`, `updated_by` | Who saved last |

**`DeliveryHours`**: `weekday` (0 = Monday … 6 = Sunday, unique), `is_open`, `opens`, `closes`.
- Check constraint: when open, both times are set and `opens < closes`.
- There are always exactly seven rows (the data migration creates them: Mon–Sun open 9:00 AM–6:00 PM as an editing starting point). Whether customers see them is `ShopSettings.show_hours`, so a first save that only fixes the email never publishes hours the owner didn't choose. *(Builder-check call.)*

**`DeliveryTown`**:
- `name`: unique, case-insensitive, 1–60 chars;
- `is_active`;
- `fee`: decimal, nullable; null means "confirmed when we reply"; 0–1000 when set;
- `position`, for display order.

**`DayOff`**: `starts`, `ends` (check: `starts <= ends`), `note` (up to 80 chars).

**Data migration:**
- creates the settings row with `messenger_url = https://m.me/rowszeinsdelight` and `email = hello@rowszeinsdelight.com`;
- creates the three towns, active, with no fee;
- creates the seven hours rows with `show_hours = false`, and sets `lead_days = 1` with no cutoff.

The `lead_days = 1` default is my call, as a safe fresh-donut default; the owner changes it on first save.

### API

**`GET /api/shop/settings/`** is public, using the `catalog.public` action. It returns:

- the contact fields, notice, paused state and message, lead days, cutoff and payment methods;
- `hours`: the seven rows when `show_hours` is on, otherwise `[]`;
- `towns`: active towns only, in order;
- `days_off`: only ranges that haven't ended (`ends >= today` in Manila), soonest first, at most 10.

Response header: `Cache-Control: public, max-age=60`. Fields like `updated_by` never appear in the public response.

**`GET /api/shop/settings/manage/`** is owner only (`shop.manage`). It returns everything above plus:
- inactive towns;
- all upcoming days off, uncapped;
- `revision`.

**`PUT /api/shop/settings/manage/`** is owner only. It replaces the whole document in one transaction:

1. Settings fields, hours, towns and days off are validated together.
2. Towns are matched by `id` when given; a town missing from the payload is deleted.
3. Days off that have already ended may be pruned on save.
4. The payload must include the `revision` the editor loaded. A stale revision returns **409** with the current document, so the page can say "These settings were changed in another tab or by someone else. Reload to see them."
5. Validation errors use the project's existing field-error shape, nested per row (`hours[2].closes`, `towns[1].name`), so the form can show each message next to its field.

**Logging:** every successful save logs one structured line (logger `shop.settings`) with `actor_id`, `revision` and the names of the changed fields. Values are never logged; the phone and email are personal data.

### Owner page: `/settings`, "Shop settings"

- Added to `OWNER_SECTIONS` in `frontend/src/config/navigation.ts` with capability `shop.manage` and a lucide `Store` icon, placed last.
- The page is one form split into these sections:
  1. **Delivery hours:** a "Show delivery hours in the shop" switch, then seven rows, each with an open/closed switch and two time inputs. Includes a "Copy Monday to all open days" shortcut. The rows stay editable while the switch is off.
  2. **Days off:** list rows plus "Add days off".
  3. **Delivery towns:** rows with name, on/off and fee. The fee is blank-able, with the hint "Leave blank until you decide." Includes "Add town".
  4. **Ordering:** lead time, cutoff time, Pause orders switch with its message, and the notice text.
  5. **Payment methods:** checkboxes.
  6. **Contact:** Messenger, Facebook, email, phone.
- One **Save settings** button. Errors show inline next to each field, and input is never lost on error.
- Saving shows a success toast. A leave-without-saving warning follows the pattern already used by the item form.
- The page has loading (skeleton), error-with-retry and saved states.
- A small preview line under Ordering shows what customers will read, for example "Order by 3:00 PM for next-day delivery."

### Public shop

- A `useShopSettings()` query is fetched in parallel with products and never awaited before the case renders.
- `SHOP_MESSENGER` and `SHOP_EMAIL` become fallbacks inside one helper. The defaults apply only while settings are loading or when they fail to load. Once settings load, they are the truth: a blank email, Facebook link or phone means that link is hidden, and the contact form's "Send by email" button shows only when an email is set. *(Builder-check call.)* Every link reads from that helper: hero, contact section, order sheet, footer and HowToOrder.
- **Notice bar:** shown only when `notice` is non-empty. It must not shift content (CLS < 0.1). How to achieve that is left to the builder; for example, an overlay that doesn't push layout, or a slot inside the already-sized hero.
- **Paused:**
  - a clear banner showing `pause_message`;
  - the order sheet's Save card and Send on Messenger actions are disabled with that message beside them; the contact form keeps working;
  - the cart and browsing keep working, so a customer's picks aren't lost.
- **Delivery block,** in or beside the existing HowToOrder or Contact area:
  - **hours:** consecutive days with the same hours are grouped ("Tue–Sun · 9:00 AM–6:00 PM"); hidden when hours aren't shown; if every day is closed, the block says "Message us for delivery days" instead of listing seven closed days;
  - **days off:** the next ones;
  - **towns:** each town with its fee, or "fee confirmed when we reply";
  - **cutoff:** the cutoff sentence;
  - **payment methods.**
- All of this is plain React text, never HTML. If the settings request fails, the block falls back to the towns and the "message us" line, and the defaults stay in place.

## Left to the builder

- Exact component split and CSS, within the existing tokens and shop look.
- The no-layout-shift technique for the notice bar.
- Wording of the cutoff sentence for each combination of lead days and cutoff (same day without a cutoff, same day with one, N days ahead), using Manila 12-hour times.
- Whether ended days off are pruned on save or just hidden.

## Settled after the builder check (my calls)

- **Hours "not set":** a `show_hours` switch instead of zero rows. This avoids a first save publishing hours the owner never chose, or "closed every day".
- **Blank contact fields:** blank means hidden, not "fall back to the old default". Defaults only cover loading and load failures. The Messenger link is required.
- **Validation errors:** nested row errors are flattened to the existing `{field: [message]}` shape with keys like `hours.2.closes`, which `apiFieldErrors` already reads.
- **Edit conflicts:** a 409 keeps the owner's edits on screen and offers "Reload their version".
- **Fees:** a ₱0 fee shows as "Free delivery".
- **Free text:** the notice, pause message and day-off note reject `<` and `>`.
