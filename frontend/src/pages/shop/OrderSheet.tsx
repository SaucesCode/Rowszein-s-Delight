import { useEffect, useId, useRef, useState } from "react";
import { MessageCircle, Minus, Plus, Trash2, X } from "lucide-react";
import TreatArt from "./treats/TreatArt";
import type { CartItem, useCart } from "@/hooks/useCart";
import { usePlaceOrder } from "@/hooks/useOrders";
import { flavorOf } from "@/lib/flavor";
import {
  checkoutErrors,
  orderPayload,
  rememberLastOrder,
  type CheckoutField,
  type CheckoutForm as Form,
} from "@/lib/orderCheckout";
import BoxArt from "@/pages/boxes/BoxArt";
import { formatPeso } from "@/pages/dashboard/report-format";
import { OrderRequestError } from "@/services/order.service";
import type { PlacedOrder } from "@/types/order.types";
import type { PublicShopSettings } from "@/types/shopSettings.types";
import CheckoutForm from "./CheckoutForm";
import OrderCard from "./OrderCard";
import OrderSent from "./OrderSent";
import { downloadNodeAsPng, orderSummary, orderText } from "./order";
import { boxPrice, describeBox, type BoxLine, type useBoxOrder } from "./useBoxOrder";
import "./checkout.css";

type Cart = ReturnType<typeof useCart>;
type Boxes = ReturnType<typeof useBoxOrder>;
type View = "review" | "details" | "sent";

const FIELDS: CheckoutField[] = ["customer_name", "phone", "town", "address", "delivery_date", "payment_method", "note"];
const EMPTY_FORM: Form = { customer_name: "", phone: "", town: "", address: "", delivery_date: "", payment_method: "", note: "" };
const OFFLINE = "Couldn't send. Check your connection and try again.";

interface OrderSheetProps {
  open: boolean;
  onClose: () => void;
  cart: Cart;
  boxes: Boxes;
  total: number;
  messengerUrl: string;
  /** The message to show while the owner has paused orders; null while orders are open. */
  paused: string | null;
  notice: string;
  /** The shop's delivery rules; undefined while loading or after they failed to load. */
  settings?: PublicShopSettings;
  settingsFailed: boolean;
  sizes: { id: number; size: number }[];
}

interface Sent {
  order: PlacedOrder;
  phone: string;
  name: string;
  singles: CartItem[];
  boxes: BoxLine[];
}

/** The order: review it, add delivery details, send it; then the order number and where to check on it. */
export default function OrderSheet(props: OrderSheetProps) {
  const { open, onClose, cart, boxes, total, messengerUrl, paused, notice, settings, settingsFailed, sizes } = props;
  const ids = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const viewHeadingRef = useRef<HTMLHeadingElement>(null);
  const problemsRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const place = usePlaceOrder();
  const [view, setView] = useState<View>("review");
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<CheckoutField, string>>>({});
  const [problems, setProblems] = useState<string[]>([]);
  // One key per order: a retry after a network failure reuses it, so the shop never saves the order twice.
  const [clientKey, setClientKey] = useState(() => crypto.randomUUID());
  const [sent, setSent] = useState<Sent | null>(null);
  const [card, setCard] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [cleared, setCleared] = useState<{ singles: CartItem[]; boxes: BoxLine[] } | null>(null);
  const empty = cart.items.length === 0 && boxes.boxes.length === 0;
  const formId = `${ids}-checkout`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Moving between steps moves focus to the new step's heading.
  useEffect(() => {
    if (open && view !== "review") viewHeadingRef.current?.focus();
  }, [view, open]);

  useEffect(() => {
    if (!card || !sent) return;
    const node = cardRef.current;
    if (!node) return;
    let cancelled = false;
    downloadNodeAsPng(node, `${sent.order.number}.png`)
      .then(() => !cancelled && setNote("Picture saved."))
      .catch(() => !cancelled && setNote("Couldn't save the picture. Your order is still sent."))
      .finally(() => !cancelled && setCard(false));
    return () => {
      cancelled = true;
    };
  }, [card, sent]);

  const openMessenger = () => {
    const text = orderText(boxes.boxes, cart.items, total, form.customer_name.trim());
    window.open(messengerUrl, "_blank", "noopener,noreferrer");
    if (!navigator.clipboard) {
      setNote("Type your order in the Messenger chat.");
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => setNote("Your order is copied. Paste it into the Messenger chat."),
      () => setNote("Type your order in the Messenger chat."),
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
    if (view === "sent") {
      setView("review");
      setSent(null);
      setNote(null);
    } else if (view === "details") {
      setView("review");
    }
    onClose();
  };

  const change = (field: CheckoutField, value: string) => {
    setForm(current => ({ ...current, [field]: value }));
    if (errors[field]) setErrors(current => ({ ...current, [field]: undefined }));
  };

  const showProblems = (fieldErrors: Partial<Record<CheckoutField, string>>, others: string[]) => {
    setErrors(fieldErrors);
    setProblems(others);
    requestAnimationFrame(() => {
      const first = FIELDS.find(field => fieldErrors[field]);
      if (first) document.getElementById(`${ids}-${first}`)?.focus();
      else problemsRef.current?.focus();
    });
  };

  const send = () => {
    if (!settings || place.isPending) return;
    const found = checkoutErrors(form, settings, new Date());
    if (Object.keys(found).length) {
      showProblems(found, []);
      return;
    }
    setProblems([]);
    const snapshot = { singles: cart.items, boxes: boxes.boxes };
    place.mutate(orderPayload(cart.items, boxes.boxes, sizes, form, clientKey), {
      onSuccess: order => {
        setSent({ order, phone: form.phone.trim(), name: form.customer_name.trim(), ...snapshot });
        rememberLastOrder({ number: order.number, token: order.token });
        cart.clearCart();
        boxes.clearBoxes();
        setClientKey(crypto.randomUUID());
        setForm(current => ({ ...current, delivery_date: "", note: "" }));
        setNote(null);
        setView("sent");
      },
      onError: error => {
        if (!(error instanceof OrderRequestError)) {
          showProblems({}, [OFFLINE]);
          return;
        }
        const fieldErrors: Partial<Record<CheckoutField, string>> = {};
        const others: string[] = [];
        for (const [key, message] of Object.entries(error.fields)) {
          if ((FIELDS as string[]).includes(key)) fieldErrors[key as CheckoutField] = message;
          else others.push(message);
        }
        if (!Object.keys(error.fields).length) others.push(error.message);
        showProblems(fieldErrors, others);
      },
    });
  };

  const continueBlocked = paused ?? (settingsFailed
    ? "We can't take orders here right now. Send your order on Messenger instead."
    : !settings ? "Loading delivery details…" : null);

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
          {view === "sent" && sent ? (
            <OrderSent
              order={sent.order}
              phone={sent.phone}
              headingRef={viewHeadingRef}
              savingCard={card}
              cardNote={note}
              onSaveCard={() => {
                setNote(null);
                setCard(true);
              }}
              onDone={close}
            />
          ) : view === "details" && settings ? (
            <form id={formId} noValidate onSubmit={event => {
              event.preventDefault();
              send();
            }}>
              <h3 ref={viewHeadingRef} tabIndex={-1} className="checkout-title">Delivery details</h3>
              <p className="checkout-lede">
                {orderSummary(boxes.boxes.length, cart.totalItems, cart.items.some(item => item.partner))} · {formatPeso(total)}
              </p>
              {problems.length > 0 && (
                <div ref={problemsRef} tabIndex={-1} role="alert" className="checkout-problems">
                  <ul>{problems.map(problem => <li key={problem}>{problem}</li>)}</ul>
                </div>
              )}
              <CheckoutForm ids={ids} form={form} errors={errors} settings={settings} now={new Date()} subtotal={total} onChange={change} />
            </form>
          ) : empty ? (
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
                <ul className="box-lines" aria-label="Single items in your order">
                  {cart.items.map(item => (
                    <li key={item.product_id} className="box-line">
                      <span className="box-line-art" aria-hidden="true">
                        {item.image_url ? (
                          <img src={item.image_url} alt="" width={48} height={48} />
                        ) : (
                          <TreatArt shape={item.shape} flavor={flavorOf(item.name)} size={40} />
                        )}
                      </span>
                      <span className="box-line-text">
                        <span className="box-line-name">{item.name}</span>
                        {item.partner && <span className="box-line-by">by {item.partner}</span>}
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

        {view === "review" && !empty && (
          <footer className="box-sheet-foot">
            <p className="box-sheet-total">
              <span>{orderSummary(boxes.boxes.length, cart.totalItems, cart.items.some(item => item.partner))}</span>
              <strong className="num">{formatPeso(total)}</strong>
            </p>
            <div className="box-sheet-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setNote(null);
                  setView("details");
                }}
                disabled={!!continueBlocked}
                aria-describedby={continueBlocked ? `${ids}-blocked` : undefined}
              >
                Continue to delivery details
              </button>
              <button type="button" className="btn-secondary" onClick={openMessenger}>
                <MessageCircle size={18} aria-hidden="true" />
                Or message us
              </button>
            </div>
            {continueBlocked ? (
              <p id={`${ids}-blocked`} className={paused ? "box-sheet-paused" : "box-sheet-help"}>
                {paused ? `${paused} Your order stays here for when we're back.` : continueBlocked}
              </p>
            ) : (
              <p className="box-sheet-help" role="status">
                {note ?? "Send your order here and we'll text or call you to confirm it."}
              </p>
            )}
            {notice && <p className="box-sheet-notice">{notice}</p>}
          </footer>
        )}

        {view === "details" && settings && (
          <footer className="box-sheet-foot checkout-foot">
            <div className="box-sheet-actions">
              <button type="submit" form={formId} className="btn-primary" disabled={place.isPending} aria-busy={place.isPending}>
                {place.isPending ? "Sending…" : "Send order"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setView("review")} disabled={place.isPending}>
                Back to your order
              </button>
            </div>
          </footer>
        )}
      </div>

      {card && sent && (
        <OrderCard
          cardRef={cardRef}
          boxes={sent.boxes}
          singles={sent.singles}
          total={Number(sent.order.total)}
          name={sent.name}
          number={sent.order.number}
          madeAt={new Date(sent.order.created_at)}
        />
      )}
    </dialog>
  );
}
