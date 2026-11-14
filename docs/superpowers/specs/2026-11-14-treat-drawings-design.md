# Drawn treats for partner items — design

Date: 14 November 2026 · Branch: `pre-launch-hardening` · Status: approved by the owner on 14 November 2026

## Why

Partner items (cakes, muffins and other baked goods made by collab partners) are listed in the shop next to Rowszein's donuts. Without a photo they are drawn as a donut, which misrepresents them. The owner wants them to look as cute and feel as alive as the donuts: drawn in the same pâtisserie style, tinted by flavour, and moving the same way when hovered, tapped or added to an order.

## Goals

1. Seven drawings in the donut's style: **whole cake, cake slice, cupcake, muffin, brownie, cookie, bread**. Each is tinted by the item's flavour (strawberry, blueberry, matcha, choco, ube, caramel, classic).
2. Every partner item shows the right drawing wherever a product is drawn:
   * the shop's display case, order sheet and order bar;
   * the Sales register catalog;
   * the Donut collection list and the item form preview.
3. The same movement as donuts: lift and tilt on hover, squish on tap, fly into the order bag or box. Reduced motion is respected.
4. The owner chooses the drawing per item ("Shown in the shop as"), pre-guessed from the name.

## Non-goals

* Drawings for Rowszein's own items, which stay donuts. The choice is only shown for partner items.
* Photos change nothing: an item with a photo shows the photo, as today.
* The shop's opening box picture, which shows donuts only (unchanged).

## Anti-goals

* Drawings that look clip-art or off-style next to the hand-drawn donuts.
* Heavier pages: drawings stay inline SVG built from code, with no new image files or libraries.
* Motion that ignores "reduce motion", or drawings exposed to screen readers as noise (they are decorative; the item name is the text).

## Approaches considered

1. **Hand-drawn SVG components in the donut's style (chosen).** One component per shape, flavour-tinted through the existing glaze tokens and drawn deterministically like `PatisserieDonut`. They match the style, weigh nothing, and can be recoloured per flavour.
2. **AI-generated pictures.** Rejected: their style won't match the donuts, they add image weight, and they can't be recoloured per flavour.
3. **An icon set.** Rejected: flat and generic, not "cute like the donut".

## How it works today (relevant facts)

* Donut drawings:
  * `pages/shop/PatisserieDonut.tsx` draws the shop's donut (glaze, drips, sprinkles, deterministic).
  * `components/DonutArt.tsx` is the management screens' donut.
  * Both take a `Flavor` from `lib/flavor.ts` (`flavorOf(name, category)`), with tint tokens `--color-glaze-<flavor>-tint` and related tokens.
* Movement lives on the containers, not the drawing:
  * `.case-art` lifts and tilts on hover and squishes on tap;
  * `useFlyToBox` clones the art element into the bag or box.

  Any drawing inside those containers inherits the movement.
* Partner items are products with `partner` set; their category is free (for example "Muffins").

## Design

### Data

* `Product.shape`: a new CharField with choices `donut, whole_cake, cake_slice, cupcake, muffin, brownie, cookie, bread`, default `donut` (migration; existing rows → `donut`).
* Exposed read/write on the owner serializer and read on the staff and public serializers (it's display data, not private).
* The server requires `shape = donut` for Rowszein's own items (400 "Only partner items can be shown as another treat."). This keeps own items as donuts, as agreed.

### Guess from the name (frontend, `lib/treatShape.ts`)

* `guessShape(name: string): Shape`. Words are checked in this order, the first match wins, and the default is `whole_cake`:
  1. `roll cake` → whole cake
  2. `cheesecake`, `slice` → cake slice
  3. `cupcake` → cupcake
  4. `muffin` → muffin
  5. `brownie`, `blondie` → brownie
  6. `cookie`, `crinkle`, `polvoron` → cookie
  7. `bread`, `loaf`, `pandesal`, `ensaymada`, `bun`, `roll`, `monay` → bread
  8. `cake`, `torte` → whole cake
* **On the item form:** when "Made by" is a partner and the owner hasn't touched the choice, "Shown in the shop as" follows `guessShape(name)` as they type. Once they pick one, it sticks.

### Drawings (`pages/shop/treats/`)

* One file per shape (`WholeCake.tsx`, `CakeSlice.tsx`, `Cupcake.tsx`, `Muffin.tsx`, `Brownie.tsx`, `Cookie.tsx`, `Bread.tsx`).
* Each has the props `{ flavor: Flavor; size: number }`, uses the same 96×96 viewBox and light source as `PatisserieDonut`, uses the glaze tokens for the flavour part (frosting, icing, filling or swirl), uses the existing crumb and cocoa tones for the bake, and has no randomness (the same render every time).
* `TreatArt({ shape, flavor, size })` renders `PatisserieDonut` for `donut`, otherwise the matching drawing; `aria-hidden`.
* The management screens use `TreatArt` too (`DonutArt` stays for donuts), so the register and lists show the right shape.

### Where drawings change

* **Shop:** the display case tile, the order sheet single lines, and the order bar window (singles).
* **Register:** catalog tiles and the ticket.
* **Management:**
  * Donut collection list rows and the item form preview, which updates as the choice changes.
  * Recipe costing's partner rows.
* **Unchanged:** the opening box picture and ready-made box drawings, which are donuts only.

### Movement

* No new animation code is needed. The drawings sit inside the existing animated containers, so hover, tap, the case reveal and fly-to-bag work as for donuts.
* One addition: a small, shape-appropriate idle detail on hover (a cupcake's cherry bobs, steam rises from bread). It uses transform and opacity only, lasts at most 200 ms, and is skipped under reduced motion.

### Item form

* For partner items, a **"Shown in the shop as"** row under "Made by": a radio group of the seven drawings as small previews in the current flavour tint, with a visible label under each.
* Keyboard: arrow keys move between the choices; each has at least a 44 px target. Hidden for Rowszein's own items.

## Failure modes

* **An item moved from a partner back to own:** shape resets to `donut` (the server requires it).
* **Unknown flavour:** the strawberry default, as for donuts.
* **A photo added later:** the photo wins everywhere, as today.

## Testing

* **Backend:**
  * shape stored and returned on all three serializers;
  * own items forced to donut (400);
  * partner→own resets shape to `donut`;
  * migration default.
* **Frontend:**
  * a regression test for `guessShape` (each word and the "roll cake" ordering);
  * the item form picks the guess and keeps a manual choice;
  * a browser gallery screenshot of all 7 shapes × 7 flavours at 375 and 1440 px in Chromium and WebKit, checked by eye against the donut;
  * the shop case and register at 375 and 1440 px;
  * axe: 0 violations; reduced-motion check.

## Left to the builder

The exact drawing paths and highlights, within the donut's style; the idle detail per shape.
