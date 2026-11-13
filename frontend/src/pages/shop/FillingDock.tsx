import { useState, type Ref } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import BoxArt from "@/pages/boxes/BoxArt";
import { formatPeso } from "@/pages/dashboard/report-format";
import { boxPrice, type FillingBox } from "./useBoxOrder";

interface FillingDockProps {
  box: FillingBox;
  boxRef: Ref<HTMLDivElement>;
  onUndo: () => void;
  onCancel: () => void;
  onFinish: () => void;
}

/** The box being filled from the case: its slots, what's left, and the price so far. */
export default function FillingDock({ box, boxRef, onUndo, onCancel, onFinish }: FillingDockProps) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const filled = box.donuts.length;
  const left = box.size - filled;
  const extras = boxPrice(box) - box.boxPrice;

  const cancel = () => (filled > 0 ? setConfirmCancel(true) : onCancel());

  return (
    <div className="box-dock filling-dock" role="region" aria-label={`Your box of ${box.size}`}>
      <div ref={boxRef} className="filling-dock-box">
        <BoxArt size={box.size} units={box.donuts} compact />
      </div>
      <div className="filling-dock-text">
        <p className="filling-dock-title">Box of {box.size}</p>
        <p className="filling-dock-progress" aria-live="polite">
          {left > 0 ? `${filled} of ${box.size}: tap ${left} more` : "Full and ready"}
        </p>
        <p className="filling-dock-price num">
          {formatPeso(boxPrice(box))}
          {extras > 0 && <span> incl. {formatPeso(extras)} premium</span>}
        </p>
      </div>
      <div className="filling-dock-actions">
        <button type="button" className="btn-primary" onClick={onFinish} disabled={left > 0}>
          Add box to order
        </button>
        <div className="filling-dock-minor">
          <button type="button" className="link-button" onClick={onUndo} disabled={filled === 0}>
            Undo last
          </button>
          <button type="button" className="link-button" onClick={cancel}>
            Cancel box
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        title={`Cancel this box of ${box.size}?`}
        description="The donuts you've put in it will come out. Nothing else in your order changes."
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
