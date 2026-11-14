import type { Flavor } from "@/lib/flavor";
import type { Shape } from "@/lib/treatShape";
import TreatArt from "@/pages/shop/treats/TreatArt";
import DonutArt from "./DonutArt";

/** Management screens: the usual donut drawing, or a partner's treat drawn in the shop's style. */
export default function ProductArt({ shape, flavor, size }: { shape?: Shape; flavor: Flavor; size: number }) {
  return shape && shape !== "donut" ? <TreatArt shape={shape} flavor={flavor} size={size} /> : <DonutArt flavor={flavor} size={size} />;
}
