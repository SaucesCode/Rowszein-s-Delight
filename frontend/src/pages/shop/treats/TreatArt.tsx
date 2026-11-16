import type { Flavor } from "@/lib/flavor";
import type { Shape } from "@/lib/treatShape";
import PatisserieDonut from "../PatisserieDonut";
import Brownie from "./Brownie";
import Bread from "./Bread";
import CakeSlice from "./CakeSlice";
import Cookie from "./Cookie";
import Cupcake from "./Cupcake";
import Muffin from "./Muffin";
import WholeCake from "./WholeCake";

const DRAWINGS = {
  whole_cake: WholeCake,
  cake_slice: CakeSlice,
  cupcake: Cupcake,
  muffin: Muffin,
  brownie: Brownie,
  cookie: Cookie,
  bread: Bread,
};

/** The drawing for an item without a photo: a donut, or a partner's treat in the same style. */
export default function TreatArt({ shape = "donut", flavor, size = 96 }: { shape?: Shape; flavor: Flavor; size?: number }) {
  if (shape === "donut") return <PatisserieDonut flavor={flavor} size={size} />;
  const Drawing = DRAWINGS[shape];
  return <Drawing flavor={flavor} size={size} />;
}
