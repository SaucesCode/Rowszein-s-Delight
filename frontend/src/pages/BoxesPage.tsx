import { useId, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { useAssortments, useBoxSizes, useDeleteBoxSize, useSaveBoxSize } from "@/hooks/useBoxes";
import { formatPeso } from "@/pages/dashboard/report-format";
import type { Assortment, BoxSize } from "@/types/box.types";
import ConfirmDialog from "@/components/ConfirmDialog";
import Switch from "@/components/ui/Switch";
import BoxArt from "./boxes/BoxArt";
import "./boxes/boxes.css";

const SUGGESTED_SIZES = [8, 12, 24];

function BoxSizeRow({ box }: { box: BoxSize }) {
  const id = useId();
  const save = useSaveBoxSize();
  const remove = useDeleteBoxSize();
  const [price, setPrice] = useState(String(Number(box.price)));
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const changed = Number(price) !== Number(box.price);

  const savePrice = (event: FormEvent) => {
    event.preventDefault();
    const value = Number(price);
    if (!price.trim() || !Number.isFinite(value) || value <= 0) {
      setError("Enter a price above ₱0.");
      return;
    }
    setError(null);
    save.mutate({ id: box.id, payload: { price: value } });
  };

  return (
    <li className="box-size-row">
      <form className="box-size-form" onSubmit={savePrice} noValidate>
        <span className="box-size-name">Box of {box.size}</span>
        <div className="box-size-price">
          <label htmlFor={`${id}-price`} className="sr-only">Price for a box of {box.size}</label>
          <div className="settings-unit-input is-prefix">
            <span aria-hidden="true">₱</span>
            <input
              id={`${id}-price`}
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              className="field-input num"
              value={price}
              aria-invalid={!!error}
              aria-describedby={error ? `${id}-error` : undefined}
              onChange={event => setPrice(event.target.value)}
            />
          </div>
          {changed && (
            <button type="submit" className="btn-primary box-size-save" disabled={save.isPending} aria-busy={save.isPending}>
              {save.isPending ? "Saving…" : "Save price"}
            </button>
          )}
        </div>
        <Switch
          checked={box.is_available}
          disabled={save.isPending}
          onChange={next => save.mutate({ id: box.id, payload: { is_available: next } })}
        >
          On sale
        </Switch>
        <button type="button" className="icon-button" onClick={() => setConfirmOpen(true)}>
          <Trash2 size={18} aria-hidden="true" />
          <span className="sr-only">Remove the box of {box.size}</span>
        </button>
        {error && <p id={`${id}-error`} className="field-error box-size-error">{error}</p>}
      </form>
      <ConfirmDialog
        open={confirmOpen}
        title={`Remove the box of ${box.size}?`}
        description="Customers won't be able to choose this size any more. To stop selling it for a while, switch off “On sale” instead."
        confirmLabel="Remove box"
        cancelLabel="Keep it"
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate(box, { onSettled: () => setConfirmOpen(false) })}
        onCancel={() => setConfirmOpen(false)}
      />
    </li>
  );
}

function AddBoxSize({ existing }: { existing: number[] }) {
  const id = useId();
  const save = useSaveBoxSize();
  const [size, setSize] = useState("");
  const [price, setPrice] = useState("");
  const [errors, setErrors] = useState<{ size?: string; price?: string }>({});
  const suggestions = SUGGESTED_SIZES.filter(value => !existing.includes(value));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found: typeof errors = {};
    const sizeValue = Number(size);
    const priceValue = Number(price);
    if (!Number.isInteger(sizeValue) || sizeValue < 2 || sizeValue > 48) found.size = "Choose how many donuts it holds, from 2 to 48.";
    else if (existing.includes(sizeValue)) found.size = `You already have a box of ${sizeValue}.`;
    if (!price.trim() || !Number.isFinite(priceValue) || priceValue <= 0) found.price = "Enter a price above ₱0.";
    setErrors(found);
    if (found.size || found.price) return;
    save.mutate(
      { payload: { size: sizeValue, price: priceValue, is_available: true } },
      { onSuccess: () => { setSize(""); setPrice(""); } },
    );
  };

  return (
    <form className="box-add" onSubmit={submit} noValidate>
      <p className="box-add-title">Add a box size</p>
      {suggestions.length > 0 && (
        <div className="chip-row" role="group" aria-label="Common sizes">
          {suggestions.map(value => (
            <button key={value} type="button" className="chip" aria-pressed={size === String(value)} onClick={() => setSize(String(value))}>
              Box of {value}
            </button>
          ))}
        </div>
      )}
      <div className="box-add-fields">
        <div>
          <label htmlFor={`${id}-size`} className="field-label">Donuts in the box</label>
          <input
            id={`${id}-size`}
            type="number"
            inputMode="numeric"
            min="2"
            max="48"
            className="field-input num"
            value={size}
            aria-invalid={!!errors.size}
            aria-describedby={errors.size ? `${id}-size-error` : undefined}
            onChange={event => setSize(event.target.value)}
          />
          {errors.size && <p id={`${id}-size-error`} className="field-error">{errors.size}</p>}
        </div>
        <div>
          <label htmlFor={`${id}-price`} className="field-label">Box price</label>
          <div className="settings-unit-input is-prefix">
            <span aria-hidden="true">₱</span>
            <input
              id={`${id}-price`}
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              className="field-input num"
              value={price}
              aria-invalid={!!errors.price}
              aria-describedby={errors.price ? `${id}-price-error` : undefined}
              onChange={event => setPrice(event.target.value)}
            />
          </div>
          {errors.price && <p id={`${id}-price-error`} className="field-error">{errors.price}</p>}
        </div>
        <button type="submit" className="btn-secondary box-add-button" disabled={save.isPending} aria-busy={save.isPending}>
          <Plus size={18} aria-hidden="true" />
          {save.isPending ? "Adding…" : "Add box"}
        </button>
      </div>
    </form>
  );
}

function assortmentStatus(assortment: Assortment): { label: string; tone: "on" | "off" | "warn" } {
  if (!assortment.is_complete) return { label: "Not full: shop hides it", tone: "warn" };
  if (assortment.items.some(item => !item.is_available)) return { label: "A donut is resting: shop hides it", tone: "warn" };
  if (!assortment.box_size.is_available) return { label: `Box of ${assortment.box_size.size} is off sale`, tone: "warn" };
  return assortment.is_available ? { label: "In the shop", tone: "on" } : { label: "Hidden", tone: "off" };
}

function AssortmentRow({ assortment }: { assortment: Assortment }) {
  const units = assortment.items.flatMap(item =>
    Array.from({ length: item.quantity }, () => ({ name: item.name, category: item.category, image_url: item.image_url })),
  );
  const status = assortmentStatus(assortment);
  return (
    <li>
      <Link to={`/products/boxes/${assortment.id}/edit`} className="assortment-row">
        <BoxArt size={assortment.box_size.size} units={units} compact />
        <span className="assortment-text">
          <span className="assortment-name">{assortment.name}</span>
          <span className="assortment-contents">
            Box of {assortment.box_size.size} · {assortment.items.map(item => `${item.quantity} ${item.name}`).join(", ")}
          </span>
          <span className={`assortment-status is-${status.tone}`}>{status.label}</span>
        </span>
        <span className="assortment-price num">{formatPeso(Number(assortment.price))}</span>
      </Link>
    </li>
  );
}

export default function BoxesPage() {
  const sizes = useBoxSizes();
  const assortments = useAssortments();
  const sizeList = sizes.data ?? [];

  return (
    <div className="boxes-page">
      <header className="page-head">
        <div>
          <h1 className="type-page">Boxes</h1>
          <p className="page-lede">Set your box prices and put together ready-made boxes for the online shop.</p>
        </div>
        {sizeList.length > 0 && (
          <Link to="/products/boxes/new" className="btn-primary">
            <Plus size={20} aria-hidden="true" />
            New ready-made box
          </Link>
        )}
      </header>

      <section className="settings-group" aria-labelledby="box-sizes-title">
        <h2 id="box-sizes-title" className="settings-group-title">Box sizes</h2>
        <div className="settings-card box-sizes-card">
          {sizes.isPending && <span className="skeleton block h-14 w-full" aria-hidden="true" />}
          {sizes.isError && (
            <div className="box-state" role="alert">
              <p>Couldn't load your box sizes.</p>
              <button type="button" className="btn-secondary" onClick={() => void sizes.refetch()}>Try again</button>
            </div>
          )}
          {sizes.isSuccess && sizeList.length === 0 && (
            <p className="box-state">No box sizes yet. Add the boxes you sell, like a box of 8, 12 or 24.</p>
          )}
          {sizeList.length > 0 && (
            <ul className="box-size-list">
              {sizeList.map(box => <BoxSizeRow key={box.id} box={box} />)}
            </ul>
          )}
          {sizes.isSuccess && <AddBoxSize existing={sizeList.map(box => box.size)} />}
        </div>
        <p className="field-hint box-hint">
          Premium donuts can add an extra per donut on top of the box price. Set it on each donut in the Donut collection.
        </p>
      </section>

      <section className="settings-group" aria-labelledby="assortments-title">
        <h2 id="assortments-title" className="settings-group-title">Ready-made boxes</h2>
        {assortments.isPending && <span className="skeleton block h-24 w-full" aria-hidden="true" />}
        {assortments.isError && (
          <div className="settings-card box-state" role="alert">
            <p>Couldn't load your ready-made boxes.</p>
            <button type="button" className="btn-secondary" onClick={() => void assortments.refetch()}>Try again</button>
          </div>
        )}
        {assortments.isSuccess && assortments.data.length === 0 && (
          <div className="settings-card box-state">
            <p>
              {sizeList.length === 0
                ? "Add a box size first, then put together boxes like a “Classic dozen” for customers to pick in one tap."
                : "Put together boxes like a “Classic dozen” so customers can pick one in a single tap."}
            </p>
            {sizeList.length > 0 && (
              <Link to="/products/boxes/new" className="btn-secondary">
                <Plus size={18} aria-hidden="true" />
                New ready-made box
              </Link>
            )}
          </div>
        )}
        {assortments.isSuccess && assortments.data.length > 0 && (
          <ul className="assortment-list settings-card">
            {assortments.data.map(assortment => <AssortmentRow key={assortment.id} assortment={assortment} />)}
          </ul>
        )}
      </section>
    </div>
  );
}
