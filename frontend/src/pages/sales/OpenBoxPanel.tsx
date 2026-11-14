import { useState } from "react";
import { X } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { formatPeso } from "@/pages/dashboard/report-format";
import { openBoxContents, openBoxPrice, type OpenBox } from "./boxTicket";

interface OpenBoxPanelProps {
  box: OpenBox;
  /** Why the last tap didn't change the box, if it didn't. */
  message: string | null;
  onRemoveFlavour: (productId: number) => void;
  onFinish: () => void;
  onCancel: () => void;
}

/** The box being filled: tap donuts to pick flavours, and the box fills evenly. */
export default function OpenBoxPanel({ box, message, onRemoveFlavour, onFinish, onCancel }: OpenBoxPanelProps) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const contents = openBoxContents(box);
  const picked = box.flavours.length;

  return (
    <section className="open-box" aria-label={`${box.name}, being filled`}>
      <header className="open-box-head">
        <h3 className="open-box-title">{box.name}</h3>
        <span className="open-box-count">
          {picked} of {box.maxFlavors} {box.maxFlavors === 1 ? "flavour" : "flavours"}
        </span>
      </header>
      {picked === 0 ? (
        <p className="open-box-hint">Tap donuts to pick up to {box.maxFlavors} flavours. The box fills evenly.</p>
      ) : (
        <ul className="open-box-flavours">
          {contents.map(donut => (
            <li key={donut.product}>
              <span className="num">{donut.quantity}</span>
              <span className="open-box-flavour-name">
                {donut.name}
                {donut.boxExtra > 0 && <span className="open-box-extra"> +{formatPeso(donut.boxExtra)} each</span>}
              </span>
              <button type="button" className="icon-button" onClick={() => onRemoveFlavour(donut.product)}>
                <X size={16} aria-hidden="true" />
                <span className="sr-only">Take {donut.name} out of the box</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="open-box-message" role="status">{message ?? ""}</p>
      <footer className="open-box-foot">
        <strong className="num">{formatPeso(openBoxPrice(box))}</strong>
        <button type="button" className="link-button" onClick={() => (picked > 0 ? setConfirmCancel(true) : onCancel())}>
          Cancel box
        </button>
        <button type="button" className="btn-primary" onClick={onFinish} disabled={picked === 0}>
          Add box to sale
        </button>
      </footer>
      <ConfirmDialog
        open={confirmCancel}
        title={`Cancel this ${box.name.toLowerCase()}?`}
        description="The flavours you've picked will come out. Nothing else on the ticket changes."
        confirmLabel="Cancel box"
        cancelLabel="Keep filling"
        destructive
        onConfirm={() => {
          setConfirmCancel(false);
          onCancel();
        }}
        onCancel={() => setConfirmCancel(false)}
      />
    </section>
  );
}
