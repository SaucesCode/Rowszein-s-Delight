# Meet-up orders: design

## Intent

Online orders are delivery-only today: a customer picks an active town, gives an address, and picks a delivery day. Some customers would rather meet the owner at a set spot. The owner lists the meet-up places, each with its own weekly hours. The customer picks a place, a day and a time.

## Goals

### 1. Shop settings → Meet-up places

The owner can add, edit, reorder and remove places. Each place has:

- **Name**: 1–80 characters, unique ignoring case, for example "SM City Lucena, main entrance".
- **Note for customers**: 0–160 characters, for example "We'll be by the fountain, look for the pink box".
- **On/off switch.**
- **Weekly hours**: seven weekday rows, each closed or open with one window (opening before closing). There is a "Copy Monday to all open days" shortcut, as for delivery hours.

At most 10 places. `<` and `>` are rejected in the name and note.

### 2. Checkout

- **Choosing delivery or meet-up.** The customer chooses **Delivery** or **Meet-up**.
  - The meet-up choice appears only when at least one place is on.
  - When there are no active towns but there are active places, meet-up is the only choice.
  - When there are neither, Continue is disabled with "We're not taking orders for delivery or meet-ups right now. Message us on Messenger."
- **Meet-up fields.** A meet-up asks for a **place**, a **day** and a **time**, and hides the town and address fields. Name, mobile number, payment preference and note stay.
- **Days offered** follow the same rules as delivery:
  - lead days and the cutoff;
  - days off;
  - at most 30 days past the earliest day;
  - **the chosen place is open that weekday**, using the place's own hours. Delivery's `show_hours` switch doesn't apply here.
- **Times offered** are every 30 minutes, from the place's opening time until 30 minutes before its closing time. For example, open 2:00–5:00 PM offers 2:00, 2:30, …, 4:30 PM. On the current Manila day (lead days 0), only times at least 60 minutes from now are offered.
- **No delivery fee** for a meet-up. The order's fee is ₱0.00, and the total equals the subtotal.

### 3. Server checks

The server checks all of the above again. Meet-up field errors use the keys `meetup_place`, `meetup_time` and `delivery_date`. Messages:

- "Pick where to meet."
- "We don't meet there on Nov 21. Pick another day."
- "Pick a time between 2:00 PM and 4:30 PM."
- "Pick a time at least an hour from now."

### 4. Everywhere an order is shown

The meet-up appears as **"Meet-up: SM City Lucena, main entrance, Sat, Nov 21, 3:00 PM"** instead of a town and address. This applies to:

- the order and its sale notes: "Online order RD-…, Ana Cruz, meet-up at SM City Lucena, main entrance, Sat, Nov 21, 3:00 PM";
- the owner's email ("Meet-up: …" instead of "Delivery: …");
- the Orders list and detail pages, where the detail also shows the place's note;
- the customer's sent screen and status page.

### 5. The shop's Delivery section

It gets a **Meet-up spots** card: each active place with its note and grouped hours, for example "Sat–Sun · 2:00 PM–5:00 PM".

## Non-goals

- Limits per time slot. The owner confirms every order and sorts out clashes by text.
- Customer-suggested places.
- Changing existing orders. They stay deliveries.

## Anti-goals

- **A meet-up order that has no place or no time.**
- **A time the place isn't open.**
- **A delivery order that loses its town or address check.**
- **Breaking existing delivery orders**, the sales command, or Shop settings saves made by an older open tab.

## Constraints

Follow the existing patterns:

- **Shop settings** is one managed document with a `revision` check (409 on stale). Rows are matched by `id`, a row missing from the PUT is deleted, renames are swap-safe, and errors use flat keys such as `meetup_places.1.hours.5.closes`.
- **Public settings** carry only active places and never anything private.
- **Online orders** keep their server pricing, the `client_key` replay with fingerprint, the rate-limit gate inside the transaction, and the snapshot confirm into `execute_sale`.
- **Times** are Asia/Manila.
- **Quality:** TDD; the SQLite and PostgreSQL suites; browser checks at 375 and 1440 in Chromium and WebKit; axe 0 violations; CSP 0 errors.
- **Deploying:** don't deploy. List the new migrations in the README.

## Approaches considered

| Approach | Trade-off | Decision |
|---|---|---|
| **Places with their own seven weekday rows, like delivery hours** | Reuses the delivery-hours rules, editor, checks and `groupHours`. Days and times can be validated exactly. | **Chosen** (owner picked option 2, per-place hours) |
| Free-text hours per place | Quick, but the server can't check a picked time. | Dropped |
| Bookable time slots with capacity | Prevents clashes, but needs a booking system the owner didn't ask for. | Dropped |

## Design

### Data

**In `shop`:**

- `MeetupPlace`: `name`, `note`, `is_active`, `position`. Constraint: unique `Lower(name)`.
- `MeetupHours`: `place` (FK, cascade), `weekday` 0–6, `is_open`, `opens`, `closes`. Unique `(place, weekday)`. Open-window constraint as in `DeliveryHours`.
- A place is always saved with its seven rows.

**`OnlineOrder` gains:**

- `fulfilment`: `delivery` or `meetup`, default `delivery`;
- `meetup_place`: FK to `MeetupPlace`, null, `SET_NULL`;
- `meetup_place_name`: snapshot;
- `meetup_place_note`: snapshot;
- `meetup_time`: Time, null.

**New check constraint:**

- a delivery has a non-empty `town_name`;
- a meet-up has a non-empty `meetup_place_name` and a `meetup_time`, and its `delivery_fee` is 0.

### Shop settings document

- **Managed GET/PUT** gains `meetup_places: [{id?, name, note, is_active, hours: [7 × {weekday, is_open, opens, closes}]}]`.
  - A PUT without `meetup_places` keeps the stored places, so a tab opened before this change can't wipe them. My call.
- **Public GET** gains `meetup_places: [{id, name, note, hours}]` for active places only.

### Order input

`fulfilment` defaults to `delivery`.

| | Delivery | Meet-up |
|---|---|---|
| Required | `town`, `address` (as today) | `meetup_place`, `meetup_time` (`HH:MM`) |
| Ignored and stored blank | — | `town`, `address` |

- The fingerprint includes `fulfilment`, `meetup_place` and `meetup_time`.
- The snapshot stores the place's name and note at order time.

### Frontend helpers (in `lib/orderCheckout.ts`, with tests)

- `allowedMeetupDates(settings, place, now, count)`
- `meetupTimes(place, date, settings, now)`
- `checkoutErrors` extended for meet-ups.
- `orderPayload` extended for meet-ups.
- `fulfilmentLine(order)`: "Meet-up: SM City Lucena, main entrance, Sat, Nov 21, 3:00 PM" or "Delivery: Wed, Nov 18, Lucena City".

## Left to the builder

- Component split for the meet-up places editor (it mirrors the towns and hours editors).
- Exact styling.
- Where the place's note shows on the sent screen.

## Settled after the builder check (my calls)

**No dead-end choices.** Both layers guard against a place or day with no meet-up times.

- **Shop settings:**
  - A meet-up window must be at least 30 minutes long. The error is on `meetup_places.N.hours.D.closes`: "Leave at least 30 minutes between opening and closing."
  - A place that's on needs at least one open day. The error is on `meetup_places.N.hours`: "Open this place on at least one day, or switch it off."
- **Checkout and server:**
  - A day is offered only if it has at least one time left after every rule, including the 60-minute rule for today.
  - The server refuses such a day on `delivery_date` with "We don't meet there on <Mon D>. Pick another day."
  - A place with no offerable days isn't listed.

**Times start at the place's opening time.** For example, 2:15 opening gives 2:15, 2:45, …. The server rejects any time not on that grid.
