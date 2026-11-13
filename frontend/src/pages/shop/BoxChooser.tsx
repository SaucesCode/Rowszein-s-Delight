import { useRef } from "react";
import BoxArt from "@/pages/boxes/BoxArt";
import { formatPeso } from "@/pages/dashboard/report-format";
import type { ShopBoxes } from "@/types/box.types";
import { Ornament } from "./ShopIcons";

type Size = ShopBoxes["sizes"][number];
type ReadyMade = ShopBoxes["assortments"][number];

interface BoxChooserProps {
  sizes: Size[];
  assortments: ReadyMade[];
  onStart: (size: Size) => void;
  onAddReadyMade: (assortment: ReadyMade, art: HTMLElement) => void;
}

function ReadyMadeCard({ assortment, onAdd }: { assortment: ReadyMade; onAdd: BoxChooserProps["onAddReadyMade"] }) {
  const artRef = useRef<HTMLDivElement>(null);
  const units = assortment.items.flatMap(item =>
    Array.from({ length: item.quantity }, () => ({ name: item.name, category: item.category, image_url: item.image_url })),
  );
  return (
    <li className="ready-box">
      <div ref={artRef} className="ready-box-art">
        <BoxArt size={assortment.size} units={units} />
      </div>
      <div className="ready-box-text">
        <h3 className="ready-box-name">{assortment.name}</h3>
        <p className="ready-box-contents">
          Box of {assortment.size}: {assortment.items.map(item => `${item.quantity} ${item.name}`).join(", ")}
        </p>
        {assortment.description && <p className="ready-box-description">{assortment.description}</p>}
      </div>
      <div className="ready-box-foot">
        <span className="ready-box-price num">{formatPeso(Number(assortment.price))}</span>
        <button
          type="button"
          className="btn-primary"
          onClick={() => artRef.current && onAdd(assortment, artRef.current)}
        >
          Add to order
          <span className="sr-only">: {assortment.name}</span>
        </button>
      </div>
    </li>
  );
}

/** Pick a box size to fill from the case, or one of the owner's ready-made boxes. */
export default function BoxChooser({ sizes, assortments, onStart, onAddReadyMade }: BoxChooserProps) {
  return (
    <section id="boxes" className="boxes" aria-labelledby="boxes-title" data-reveal="">
      <div className="boxes-head">
        <Ornament className="shop-ornament" />
        <h2 id="boxes-title" className="shop-title">Choose your box</h2>
        <p className="shop-lede">Fill a box yourself from today's case, or take one we've put together.</p>
      </div>

      <ul className="box-sizes">
        {sizes.map(size => (
          <li key={size.id}>
            <button type="button" className="box-size-card" onClick={() => onStart(size)}>
              <BoxArt size={size.size} units={[]} compact />
              <span className="box-size-card-name">Box of {size.size}</span>
              <span className="box-size-card-price num">{formatPeso(Number(size.price))}</span>
              <span className="box-size-card-action">Fill it yourself</span>
            </button>
          </li>
        ))}
      </ul>

      {assortments.length > 0 && (
        <>
          <h3 className="boxes-subtitle">Ready-made boxes</h3>
          <ul className="ready-boxes">
            {assortments.map(assortment => (
              <ReadyMadeCard key={assortment.id} assortment={assortment} onAdd={onAddReadyMade} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
