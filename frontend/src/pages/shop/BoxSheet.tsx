import { useEffect, useId, useRef, useState } from "react";
import { Download, Minus, Plus, X } from "lucide-react";
import PatisserieDonut from "./PatisserieDonut";
import type { CartItem, useCart } from "@/hooks/useCart";
import { flavorOf } from "@/lib/flavor";
import { formatPeso } from "@/pages/dashboard/report-format";
import OrderCard from "./OrderCard";
import { SHOP_MESSENGER, cardNumber, downloadNodeAsPng, orderText } from "./order";

type Cart = ReturnType<typeof useCart>;

interface BoxSheetProps {
  open: boolean;
  onClose: () => void;
  cart: Cart;
}

/** The opened box: what's inside, the customer's name, and how to send the order. */
export default function BoxSheet({ open, onClose, cart }: BoxSheetProps) {
  const ids = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [card, setCard] = useState<{ number: string; madeAt: Date } | null>(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [emptied, setEmptied] = useState<CartItem[] | null>(null);
  const empty = cart.items.length === 0;

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
    const trimmed = name.trim();
    if (!trimmed) {
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
    const text = orderText(cart.items, cart.totalAmount, name.trim());
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

  const emptyBox = () => {
    setEmptied(cart.items);
    setNote(null);
    cart.clearCart();
  };

  const close = () => {
    setEmptied(null);
    onClose();
  };

  const putBack = () => {
    if (emptied) cart.restoreItems(emptied);
    setEmptied(null);
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
          <h2 id={`${ids}-title`} className="box-sheet-title">Your box</h2>
          <button type="button" className="icon-button" onClick={close}>
            <X size={22} aria-hidden="true" />
            <span className="sr-only">Close your box</span>
          </button>
        </header>

        <div className="box-sheet-scroll">
          {empty ? (
            <div className="box-sheet-empty">
              <p role="status">{emptied ? "You emptied the box." : "Your box is empty. Tap a donut in the case to add it."}</p>
              <div className="box-sheet-empty-actions">
                {emptied && (
                  <button type="button" className="btn-primary" onClick={putBack}>Put them back</button>
                )}
                <button type="button" className="btn-secondary" onClick={close}>Back to the case</button>
              </div>
            </div>
          ) : (
            <>
              <ul className="box-lines" aria-label="Donuts in your box">
                {cart.items.map(item => {
                  const flavor = flavorOf(item.name);
                  return (
                    <li key={item.product_id} className="box-line">
                      <span className="box-line-art" aria-hidden="true">
                        {item.image_url ? <img src={item.image_url} alt="" width={48} height={48} /> : <PatisserieDonut flavor={flavor} size={40} />}
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
                  );
                })}
              </ul>
              <button type="button" className="link-button box-empty-button" onClick={emptyBox}>
                Empty the box
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
              <span>{cart.totalItems === 1 ? "1 donut" : `${cart.totalItems} donuts`}</span>
              <strong className="num">{formatPeso(cart.totalAmount)}</strong>
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
          items={cart.items}
          total={cart.totalAmount}
          name={name.trim()}
          number={card.number}
          madeAt={card.madeAt}
        />
      )}
    </dialog>
  );
}
