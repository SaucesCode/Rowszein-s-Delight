import { useState, type Ref } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import BoxArt from "@/pages/boxes/BoxArt";
import { formatPeso } from "@/pages/dashboard/report-format";
import { boxPrice, describeBox, fillingDonuts, type FillingBox } from "./useBoxOrder";

interface FillingDockProps {
  box: FillingBox;
  boxRef: Ref<HTMLDivElement>;
  onUndo: () => void;
  onCancel: () => void;
  onFinish: () => void;
}

/** The box being filled: the flavours picked (filled evenly) and the price so far. */
export default function FillingDock({ box, boxRef, onUndo, onCancel, onFinish }: FillingDockProps) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const donuts = fillingDonuts(box);
  const picked = box.flavours.length;
  const price = boxPrice({ boxPrice: box.boxPrice, donuts });
  const extras = price - box.boxPrice;

  const cancel = () => (picked > 0 ? setConfirmCancel(true) : onCancel());

  return (
    <div className="box-dock filling-dock" role="region" aria-label={`Your box of ${box.size}`}>
      <div ref={boxRef} className="filling-dock-box">
        <BoxArt size={box.size} units={donuts} compact />
      </div>
      <div className="filling-dock-text">
        <p className="filling-dock-title">Box of {box.size}</p>
        <p className="filling-dock-progress" aria-live="polite">
          {picked === 0 ? `Pick up to ${box.maxFlavors} flavours` : `${describeBox(donuts)} · ${picked} of ${box.maxFlavors} flavours`}
        </p>
        <p className="filling-dock-price num">
          {formatPeso(price)}
          {extras > 0 && <span> incl. {formatPeso(extras)} premium</span>}
        </p>
      </div>
      <div className="filling-dock-actions">
        <button type="button" className="btn-primary" onClick={onFinish} disabled={picked === 0}>
          Add box to order
        </button>
        <div className="filling-dock-minor">
          <button type="button" className="link-button" onClick={onUndo} disabled={picked === 0}>
            Undo last flavour
          </button>
          <button type="button" className="link-button" onClick={cancel}>
            Cancel box
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        title={`Cancel this box of ${box.size}?`}
        description="The flavours you've picked will come out. Nothing else in your order changes."
        confirmLabel="Cancel box"
        cancelLabel="Keep filling"
        destructive
        onConfirm={() => {
          setConfirmCancel(false);
          onCancel();
        }}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  );
}
