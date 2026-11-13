import { useRef, useState } from "react";
import { ArrowDown, Star } from "lucide-react";
import DonutArt from "@/components/DonutArt";
import { flavorOf, flavorTint } from "@/lib/flavor";
import { formatPeso } from "@/pages/dashboard/report-format";
import type { Product } from "@/types/product.types";
import { Doily } from "./ShopIcons";

const PICKS = 4;

interface ShopHeroProps {
  /** Best sellers first; falls back to whatever is in the case. */
  products: Product[];
  onAdd: (product: Product, art: HTMLElement) => void;
}

/** The shop window: a headline beside one donut on a doily, turning slowly like a display piece. */
export default function ShopHero({ products, onAdd }: ShopHeroProps) {
  const [chosenId, setChosenId] = useState<number | null>(null);
  const artRef = useRef<HTMLSpanElement>(null);
  const picks = products.slice(0, PICKS);
  const current = picks.find(product => product.id === chosenId) ?? picks[0];
  const flavor = current ? flavorOf(current.name, current.category?.name) : "strawberry";

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <h1 id="hero-title" className="hero-title">Donuts worth stopping for.</h1>
        <p className="hero-lede">
          Choose from today's case, fill a box, and send your order to us on Messenger. No account needed.
        </p>
        <div className="hero-actions">
          <a href="#menu" className="btn-primary hero-start">
            Start your box
            <ArrowDown size={18} aria-hidden="true" />
          </a>
          <a href="#how" className="hero-link">How ordering works</a>
        </div>
      </div>

      <div className="hero-window">
        <div className="hero-arch">
          <Doily className="hero-doily" />
          <span
            key={current?.id ?? "display"}
            ref={artRef}
            className="hero-donut"
            aria-hidden="true"
          >
            <span className="hero-donut-turn">
              {current?.image_url ? (
                <img src={current.image_url} alt="" width={240} height={240} fetchPriority="high" />
              ) : (
                <DonutArt flavor={flavor} size={240} />
              )}
            </span>
          </span>
        </div>

        {current && (
          <div className="hero-caption">
            <div className="hero-caption-text">
              <p className="hero-name">
                {current.name}
                {current.is_featured && "\u2060" /* keeps the star on the same line as the name */}
                {current.is_featured && (
                  <span className="hero-star" title="Best seller">
                    <Star size={15} strokeWidth={2} aria-hidden="true" />
                    <span className="sr-only">, best seller</span>
                  </span>
                )}
              </p>
              <p className="hero-price num">{formatPeso(Number(current.price))}</p>
            </div>
            <button
              type="button"
              className="btn-primary hero-add"
              onClick={() => {
                if (artRef.current) onAdd(current, artRef.current);
              }}
            >
              Add to box
              <span className="sr-only">: {current.name}</span>
            </button>
          </div>
        )}

        {picks.length > 1 && (
          <div className="hero-picks" role="group" aria-label="Show another donut">
            {picks.map(product => {
              const pickFlavor = flavorOf(product.name, product.category?.name);
              return (
                <button
                  key={product.id}
                  type="button"
                  className="hero-pick"
                  aria-pressed={product.id === current?.id}
                  onClick={() => setChosenId(product.id)}
                >
                  <span className="hero-pick-art" style={{ background: product.image_url ? undefined : flavorTint(pickFlavor) }}>
                    {product.image_url ? <img src={product.image_url} alt="" width={40} height={40} /> : <DonutArt flavor={pickFlavor} size={36} />}
                  </span>
                  <span className="sr-only">{product.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
