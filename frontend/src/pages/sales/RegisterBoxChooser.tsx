import { useEffect, useId, useRef, useState } from "react";
import { Package } from "lucide-react";
import { formatPeso } from "@/pages/dashboard/report-format";
import type { Assortment, BoxSize } from "@/types/box.types";

interface RegisterBoxChooserProps {
  sizes: BoxSize[];
  readyMade: Assortment[];
  /** The owner may record boxes that are off sale (late orders); staff only see what's on sale. */
  isOwner: boolean;
  /** Put focus on "Add a box" when the chooser comes back after a box closes. */
  autoFocus?: boolean;
  onStartSize: (size: BoxSize) => void;
  onAddReadyMade: (assortment: Assortment) => void;
}

const sellable = (assortment: Assortment) => assortment.is_complete && assortment.follows_rule;
const onSale = (assortment: Assortment) => assortment.is_available && assortment.box_size.is_available;

/** "Add a box": box sizes to fill by flavour, and ready-made boxes added in one tap. */
export default function RegisterBoxChooser({ sizes, readyMade, isOwner, autoFocus = false, onStartSize, onAddReadyMade }: RegisterBoxChooserProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (autoFocus) toggleRef.current?.focus();
  }, [autoFocus]);
  const visibleSizes = sizes.filter(size => isOwner || size.is_available);
  const visibleReady = readyMade.filter(box => sellable(box) && (isOwner || onSale(box)));
  if (visibleSizes.length === 0 && visibleReady.length === 0) return null;

  const choose = (action: () => void) => {
    action();
    setOpen(false);
    // A ready-made box keeps this chooser on screen; send focus back to its button.
    requestAnimationFrame(() => {
      if (toggleRef.current?.isConnected) toggleRef.current.focus();
    });
  };

  return (
    <div className="register-boxes">
      <button ref={toggleRef} type="button" className="btn-secondary register-boxes-toggle" aria-expanded={open} aria-controls={`${id}-list`} onClick={() => setOpen(value => !value)}>
        <Package size={18} aria-hidden="true" />
        Add a box
      </button>
      {open && (
        <div id={`${id}-list`} className="register-boxes-list">
          {visibleSizes.length > 0 && (
            <ul aria-label="Fill a box">
              {visibleSizes.map(size => (
                <li key={size.id}>
                  <button type="button" className="register-box-option" onClick={() => choose(() => onStartSize(size))}>
                    <span className="register-box-option-name">Box of {size.size}</span>
                    <span className="register-box-option-meta">
                      Up to {size.max_flavors} {size.max_flavors === 1 ? "flavour" : "flavours"}
                      {!size.is_available && " · Off sale"}
                    </span>
                    <span className="num">{formatPeso(Number(size.price))}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {visibleReady.length > 0 && (
            <ul aria-label="Ready-made boxes">
              {visibleReady.map(box => (
                <li key={box.id}>
                  <button type="button" className="register-box-option" onClick={() => choose(() => onAddReadyMade(box))}>
                    <span className="register-box-option-name">{box.name}</span>
                    <span className="register-box-option-meta">
                      Box of {box.box_size.size} · ready-made{!onSale(box) && " · Off sale"}
                    </span>
                    <span className="num">{formatPeso(Number(box.price))}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
