import { useEffect, useId, useRef, useState } from "react";
import { Download, Minus, Plus, Trash2, X } from "lucide-react";
import PatisserieDonut from "./PatisserieDonut";
import type { CartItem, useCart } from "@/hooks/useCart";
import { flavorOf } from "@/lib/flavor";
import BoxArt from "@/pages/boxes/BoxArt";
import { formatPeso } from "@/pages/dashboard/report-format";
import OrderCard from "./OrderCard";
import { SHOP_MESSENGER, cardNumber, downloadNodeAsPng, orderSummary, orderText } from "./order";
import { boxPrice, describeBox, type BoxLine, type useBoxOrder } from "./useBoxOrder";

type Cart = ReturnType<typeof useCart>;
type Boxes = ReturnType<typeof useBoxOrder>;

interface OrderSheetProps {
  open: boolean;
  onClose: () => void;
  cart: Cart;
  boxes: Boxes;
  total: number;
}

/** The order: boxes and single donuts, the customer's name, and how to send it. */
export default function OrderSheet({ open, onClose, cart, boxes, total }: OrderSheetProps) {
  const ids = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [card, setCard] = useState<{ number: string; madeAt: Date } | null>(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [cleared, setCleared] = useState<{ singles: CartItem[]; boxes: BoxLine[] } | null>(null);
  const empty = cart.items.length === 0 && boxes.boxes.length === 0;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!card) return;
    const node = cardRef.current;
    if (!node) return;
    let cancelled = false;
    downloadNodeAsPng(node, `${card.number}.png`)
      .then(() => {
        if (!cancelled) setNote("Order card saved. Now send it to us on Messenger.");
      })
      .catch(() => {
        if (!cancelled) setNote("Couldn't save the card. Try again, or send your order on Messenger instead.");
      })
      .finally(() => {
        if (cancelled) return;
        setSaving(false);
        setCard(null);
      });
    return () => {
      cancelled = true;
    };
  }, [card]);

  const saveCard = () => {
    setNote(null);
    if (!name.trim()) {
      setNameError("Enter your name so we know whose order it is.");
      nameRef.current?.focus();
      return;
    }
    setNameError(null);
    setSaving(true);
    const madeAt = new Date();
    setCard({ number: cardNumber(madeAt), madeAt });
  };

  const openMessenger = () => {
    const text = orderText(boxes.boxes, cart.items, total, name.trim());
    window.open(SHOP_MESSENGER, "_blank", "noopener,noreferrer");
    if (!navigator.clipboard) {
      setNote("Type your order in the chat, or attach your saved order card.");
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => setNote("Your order is copied. Paste it into the Messenger chat."),
      () => setNote("Type your order in the chat, or attach your saved order card."),
    );
  };

  const clearOrder = () => {
    setCleared({ singles: cart.items, boxes: boxes.boxes });
    setNote(null);
    cart.clearCart();
    boxes.clearBoxes();
  };

  const putBack = () => {
    if (cleared) {
      cart.restoreItems(cleared.singles);
      boxes.restoreBoxes(cleared.boxes);
    }
    setCleared(null);
  };

  const close = () => {
    setCleared(null);
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="box-sheet"
      aria-labelledby={`${ids}-title`}
      onClose={close}
      onClick={event => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="box-sheet-inner">
        <header className="box-sheet-head">
          <h2 id={`${ids}-title`} className="box-sheet-title">Your order</h2>
          <button type="button" className="icon-button" onClick={close}>
            <X size={22} aria-hidden="true" />
            <span className="sr-only">Close your order</span>
          </button>
        </header>

        <div className="box-sheet-scroll">
          {empty ? (
            <div className="box-sheet-empty">
              <p role="status">
                {cleared ? "You cleared your order." : "Your order is empty. Choose a box, or tap a donut in the case."}
              </p>
              <div className="box-sheet-empty-actions">
                {cleared && (
                  <button type="button" className="btn-primary" onClick={putBack}>Put it back</button>
                )}
                <button type="button" className="btn-secondary" onClick={close}>Back to the shop</button>
              </div>
            </div>
          ) : (
            <>
              {boxes.boxes.length > 0 && (
                <ul className="order-boxes" aria-label="Boxes in your order">
                  {boxes.boxes.map(box => (
                    <li key={box.key} className="order-box">
                      <BoxArt size={box.size} units={box.donuts} compact />
                      <span className="box-line-text">
                        <span className="box-line-name">{box.name}</span>
                        <span className="box-line-each">{describeBox(box.donuts)}</span>
                      </span>
                      <span className="box-line-total num">{formatPeso(boxPrice(box))}</span>
                      <button type="button" className="icon-button" onClick={() => boxes.removeBox(box.key)}>
                        <Trash2 size={18} aria-hidden="true" />
                        <span className="sr-only">Remove {box.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {cart.items.length > 0 && (
                <ul className="box-lines" aria-label="Single donuts in your order">
                  {cart.items.map(item => (
                    <li key={item.product_id} className="box-line">
                      <span className="box-line-art" aria-hidden="true">
                        {item.image_url ? (
                          <img src={item.image_url} alt="" width={48} height={48} />
                        ) : (
                          <PatisserieDonut flavor={flavorOf(item.name)} size={40} />
                        )}
                      </span>
                      <span className="box-line-text">
                        <span className="box-line-name">{item.name}</span>
                        <span className="box-line-each num">{formatPeso(item.price)} each</span>
                      </span>
                      <span className="box-stepper" role="group" aria-label={`${item.name} quantity`}>
                        <button type="button" onClick={() => cart.decrementItem(item.product_id)}>
                          <Minus size={18} aria-hidden="true" />
                          <span className="sr-only">One less {item.name}</span>
                        </button>
                        <span className="num" aria-live="polite">{item.quantity}</span>
                        <button type="button" onClick={() => cart.incrementItem(item.product_id)}>
                          <Plus size={18} aria-hidden="true" />
                          <span className="sr-only">One more {item.name}</span>
                        </button>
                      </span>
                      <span className="box-line-total num">{formatPeso(item.price * item.quantity)}</span>
                    </li>
                  ))}
                </ul>
              )}

              <button type="button" className="link-button box-empty-button" onClick={clearOrder}>
                Clear the order
              </button>
            </>
          )}
        </div>

        {!empty && (
          <footer className="box-sheet-foot">
            <div className="box-name">
              <label htmlFor={`${ids}-name`} className="field-label">Your name, for the order card</label>
              <input
                ref={nameRef}
                id={`${ids}-name`}
                className="field-input"
                autoComplete="name"
                maxLength={60}
                value={name}
                aria-invalid={!!nameError}
                aria-describedby={nameError ? `${ids}-name-error` : undefined}
                onChange={event => {
                  setName(event.target.value);
                  if (nameError && event.target.value.trim()) setNameError(null);
                }}
              />
              {nameError && <p id={`${ids}-name-error`} className="field-error">{nameError}</p>}
            </div>
            <p className="box-sheet-total">
              <span>{orderSummary(boxes.boxes.length, cart.totalItems)}</span>
              <strong className="num">{formatPeso(total)}</strong>
            </p>
            <div className="box-sheet-actions">
              <button type="button" className="btn-primary" onClick={saveCard} disabled={saving} aria-busy={saving}>
                <Download size={18} aria-hidden="true" />
                {saving ? "Saving…" : "Save order card"}
              </button>
              <button type="button" className="btn-secondary" onClick={openMessenger}>
                Send on Messenger
              </button>
            </div>
            <p className="box-sheet-help" role="status">
              {note ?? "Save your card, then send it to us on Messenger. We'll reply to confirm your order."}
            </p>
          </footer>
        )}
      </div>

      {card && (
        <OrderCard
          cardRef={cardRef}
          boxes={boxes.boxes}
          singles={cart.items}
          total={total}
          name={name.trim()}
          number={card.number}
          madeAt={card.madeAt}
        />
      )}
    </dialog>
  );
}
