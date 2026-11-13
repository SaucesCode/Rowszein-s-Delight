import { useState } from "react";
import { ArrowDown } from "lucide-react";
import BoxArt from "@/pages/boxes/BoxArt";
import { formatPeso } from "@/pages/dashboard/report-format";
import type { ShopBoxes } from "@/types/box.types";
import type { Product } from "@/types/product.types";

type Size = ShopBoxes["sizes"][number];

interface BoxHeroProps {
  sizes: Size[];
  /** Today's donuts, used to fill the box on display. */
  products: Product[];
  hasReadyMade: boolean;
  onStart: (size: Size) => void;
}

function sizeList(sizes: Size[]): string {
  const numbers = sizes.map(size => String(size.size));
  return numbers.length > 1 ? `${numbers.slice(0, -1).join(", ")} or ${numbers.at(-1)}` : numbers[0];
}

/** The shop window: an open box of today's donuts, with the box sizes as tabs. */
export default function BoxHero({ sizes, products, hasReadyMade, onStart }: BoxHeroProps) {
  const [chosenId, setChosenId] = useState<number | null>(null);
  const chosen = sizes.find(size => size.id === chosenId) ?? sizes.find(size => size.size === 12) ?? sizes[0];
  const units = products.length
    ? Array.from({ length: chosen.size }, (_, index) => {
        const product = products[index % products.length];
        return { name: product.name, category: product.category?.name, image_url: product.image_url };
      })
    : [];

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <h1 id="hero-title" className="hero-title">Donuts worth stopping for.</h1>
        <p className="hero-lede">
          Fill a box of {sizeList(sizes)} with today's donuts{hasReadyMade ? ", or pick one of ours" : ""}. Send your order to us on
          Messenger. No account needed.
        </p>
        <div className="hero-actions">
          <button type="button" className="btn-primary hero-start" onClick={() => onStart(chosen)}>
            Build your box of {chosen.size}
            <ArrowDown size={18} aria-hidden="true" />
          </button>
          <a href={hasReadyMade ? "#boxes" : "#how"} className="hero-link">
            {hasReadyMade ? "See our ready-made boxes" : "How ordering works"}
          </a>
        </div>
      </div>

      <div className="hero-window">
        <div className="hero-arch is-box">
          <span className="hero-lid" aria-hidden="true">
            <span>Rowszein's Delight</span>
          </span>
          <div key={chosen.id} className="hero-box">
            <BoxArt size={chosen.size} units={units} />
          </div>
        </div>

        <div className="hero-caption">
          <div className="hero-caption-text">
            <p className="hero-name">Box of {chosen.size}</p>
            <p className="hero-price num">From {formatPeso(Number(chosen.price))}</p>
          </div>
          <button type="button" className="btn-primary hero-add" onClick={() => onStart(chosen)}>
            Fill this box
          </button>
        </div>

        {sizes.length > 1 && (
          <div className="hero-sizes segmented" role="group" aria-label="Box size">
            {sizes.map(size => (
              <button key={size.id} type="button" aria-pressed={size.id === chosen.id} onClick={() => setChosenId(size.id)}>
                <span className="sr-only">Box of </span>
                {size.size}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
