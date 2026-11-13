import { useId, useState, type FormEvent } from "react";
import { useBlocker, useNavigate, useParams } from "react-router-dom";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useAssortment, useBoxSizes, useCollection, useDeleteAssortment, useSaveAssortment } from "@/hooks/useBoxes";
import { validRecordId } from "@/lib/managementQueryKeys";
import { flavorOf } from "@/lib/flavor";
import { formatPeso } from "@/pages/dashboard/report-format";
import PatisserieDonut from "@/pages/shop/PatisserieDonut";
import type { Assortment, BoxSize } from "@/types/box.types";
import type { Product } from "@/types/product.types";
import ConfirmDialog from "@/components/ConfirmDialog";
import RecordLoadError from "@/components/RecordLoadError";
import Switch from "@/components/ui/Switch";
import Row from "@/components/ui/SettingsRow";
import BoxArt from "./boxes/BoxArt";
import "./boxes/boxes.css";

type Quantities = Record<number, number>;

interface Draft {
  name: string;
  description: string;
  sizeId: number;
  available: boolean;
  quantities: Quantities;
}

function draftFrom(assortment: Assortment | undefined, sizes: BoxSize[]): Draft {
  if (!assortment) {
    return { name: "", description: "", sizeId: sizes[0]?.id ?? 0, available: true, quantities: {} };
  }
  return {
    name: assortment.name,
    description: assortment.description,
    sizeId: assortment.box_size.id,
    available: assortment.is_available,
    quantities: Object.fromEntries(assortment.items.map(item => [item.product_id, item.quantity])),
  };
}

const sameDraft = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b);

function AssortmentForm({ assortment, sizes, collection }: { assortment?: Assortment; sizes: BoxSize[]; collection: Product[] }) {
  const navigate = useNavigate();
  const id = useId();
  const field = (name: string) => `${id}-${name}`;
  const save = useSaveAssortment(assortment?.id);
  const remove = useDeleteAssortment();
  const [initial] = useState(() => draftFrom(assortment, sizes));
  const [draft, setDraft] = useState(initial);
  const [nameError, setNameError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const size = sizes.find(box => box.id === draft.sizeId);
  const capacity = size?.size ?? 0;
  const filled = Object.values(draft.quantities).reduce((sum, quantity) => sum + quantity, 0);
  const missing = capacity - filled;
  const byId = new Map(collection.map(product => [product.id, product]));
  const extras = Object.entries(draft.quantities).reduce(
    (sum, [productId, quantity]) => sum + quantity * Number(byId.get(Number(productId))?.box_extra ?? 0),
    0,
  );
  const price = (size ? Number(size.price) : 0) + extras;
  const units = Object.entries(draft.quantities).flatMap(([productId, quantity]) => {
    const product = byId.get(Number(productId));
    return product
      ? Array.from({ length: quantity }, () => ({ name: product.name, category: product.category?.name, image_url: product.image_url }))
      : [];
  });

  const isDone = save.isSuccess || remove.isPending || remove.isSuccess;
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !sameDraft(draft, initial) && !save.isPending && !isDone && currentLocation.pathname !== nextLocation.pathname,
  );

  const update = (patch: Partial<Draft>) => setDraft(current => ({ ...current, ...patch }));
  const setQuantity = (productId: number, quantity: number) =>
    setDraft(current => {
      const quantities = { ...current.quantities };
      if (quantity <= 0) delete quantities[productId];
      else quantities[productId] = quantity;
      return { ...current, quantities };
    });

  const fillState =
    !size ? "Choose a box size." : missing > 0 ? `${filled} of ${capacity}: add ${missing} more` : missing < 0 ? `${filled} of ${capacity}: take out ${-missing}` : `Full: ${capacity} donuts`;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) {
      setNameError("Give the box a name customers will recognise, like “Classic dozen”.");
      document.getElementById(field("name"))?.focus();
      return;
    }
    setNameError(null);
    if (!size || missing !== 0) return;
    save.mutate({
      name: draft.name.trim(),
      description: draft.description.trim(),
      box_size_id: draft.sizeId,
      is_available: draft.available,
      contents: Object.entries(draft.quantities).map(([productId, quantity]) => ({ product_id: Number(productId), quantity })),
    });
  };

  return (
    <>
      <form id={field("form")} className="assortment-form" onSubmit={submit} noValidate>
        <header className="page-head">
          <div>
            <h1 className="type-page">{assortment ? assortment.name : "New ready-made box"}</h1>
            <p className="page-lede">Fill the box with donuts. Customers pick it in one tap in the online shop.</p>
          </div>
        </header>

        <div className="assortment-layout">
          <aside className="assortment-preview" aria-live="polite">
            {size ? <BoxArt size={capacity} units={units.slice(0, capacity)} /> : <span className="skeleton block h-40 w-full" />}
            <p className={`assortment-fill${missing === 0 && size ? " is-full" : ""}`}>{fillState}</p>
            <p className="assortment-preview-price">
              <span>Box price</span>
              <strong className="num">{formatPeso(price)}</strong>
            </p>
            {extras > 0 && (
              <p className="field-hint">
                {formatPeso(Number(size?.price ?? 0))} box + {formatPeso(extras)} premium extras
              </p>
            )}
          </aside>

          <div className="assortment-fields">
            <section className="settings-group" aria-labelledby={field("about")}>
              <h2 id={field("about")} className="settings-group-title">About the box</h2>
              <div className="settings-card">
                <Row label="Name" htmlFor={field("name")} error={nameError ?? undefined}>
                  <input
                    id={field("name")}
                    className="field-input"
                    placeholder="For example, Classic dozen"
                    autoComplete="off"
                    maxLength={100}
                    value={draft.name}
                    aria-invalid={!!nameError}
                    aria-describedby={nameError ? `${field("name")}-msg` : undefined}
                    onChange={event => update({ name: event.target.value })}
                  />
                </Row>
                <Row label="Box size">
                  <fieldset className="settings-chips" aria-label="Box size">
                    {sizes.map(box => (
                      <label key={box.id} className="chip">
                        <input
                          type="radio"
                          name={field("size")}
                          className="sr-only"
                          checked={draft.sizeId === box.id}
                          onChange={() => update({ sizeId: box.id })}
                        />
                        Box of {box.size}
                      </label>
                    ))}
                  </fieldset>
                </Row>
                <Row label="Description" htmlFor={field("description")} hint="Optional. Shown under the name in the shop.">
                  <textarea
                    id={field("description")}
                    className="field-input"
                    rows={2}
                    maxLength={500}
                    placeholder="For example, Our four classics, three of each."
                    aria-describedby={`${field("description")}-msg`}
                    value={draft.description}
                    onChange={event => update({ description: event.target.value })}
                  />
                </Row>
                <Row label="In the shop">
                  <Switch checked={draft.available} onChange={next => update({ available: next })}>
                    Show in the online shop
                  </Switch>
                </Row>
              </div>
            </section>

            <section className="settings-group" aria-labelledby={field("contents")}>
              <h2 id={field("contents")} className="settings-group-title">What goes in</h2>
              <ul className="assortment-picker settings-card">
                {collection.map(product => {
                  const quantity = draft.quantities[product.id] ?? 0;
                  const extra = Number(product.box_extra ?? 0);
                  return (
                    <li key={product.id} className="assortment-pick">
                      <span className="assortment-pick-art" aria-hidden="true">
                        {product.image_url ? (
                          <img src={product.image_url} alt="" />
                        ) : (
                          <PatisserieDonut flavor={flavorOf(product.name, product.category?.name)} size={40} />
                        )}
                      </span>
                      <span className="assortment-pick-text">
                        <span className="assortment-pick-name">{product.name}</span>
                        <span className="assortment-pick-meta">
                          {extra > 0 ? `+${formatPeso(extra)} in a box` : "No extra"}
                          {!product.is_available && " · Resting"}
                        </span>
                      </span>
                      <span className="box-stepper" role="group" aria-label={`${product.name} in the box`}>
                        <button type="button" onClick={() => setQuantity(product.id, quantity - 1)} disabled={quantity === 0}>
                          <Minus size={18} aria-hidden="true" />
                          <span className="sr-only">One less {product.name}</span>
                        </button>
                        <span className="num" aria-live="polite">{quantity}</span>
                        <button type="button" onClick={() => setQuantity(product.id, quantity + 1)} disabled={!size || missing <= 0}>
                          <Plus size={18} aria-hidden="true" />
                          <span className="sr-only">One more {product.name}</span>
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            {assortment && (
              <section className="settings-group" aria-label="More actions">
                <div className="settings-card settings-actions-card">
                  <button type="button" className="settings-danger" onClick={() => setDeleteOpen(true)}>
                    <Trash2 size={18} aria-hidden="true" />
                    Delete this box
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>

        <footer className="settings-actions">
          <p className="assortment-footer-state" aria-hidden="true">{fillState}</p>
          <button type="button" className="btn-ghost" onClick={() => navigate("/products/boxes")}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={save.isPending || !size || missing !== 0} aria-busy={save.isPending}>
            {save.isPending ? "Saving…" : assortment ? "Save changes" : "Add box"}
          </button>
        </footer>
      </form>

      <ConfirmDialog
        open={deleteOpen}
        title={`Delete ${assortment?.name ?? "this box"}?`}
        description="It will be removed from the online shop, and this can't be undone. To stop selling it for a while, switch off “Show in the online shop” instead."
        confirmLabel="Delete box"
        cancelLabel="Keep it"
        destructive
        loading={remove.isPending}
        onConfirm={() => assortment && remove.mutate(assortment.id)}
        onCancel={() => setDeleteOpen(false)}
      />

      <ConfirmDialog
        open={blocker.state === "blocked"}
        title="Leave without saving?"
        description="Your changes to this box haven't been saved yet."
        confirmLabel="Leave without saving"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </>
  );
}

function FormSkeleton() {
  return (
    <div className="assortment-form" aria-busy="true">
      <span className="skeleton block h-10 w-72" />
      <span className="skeleton mt-8 block h-64 w-full" aria-hidden="true" />
      <span className="sr-only" role="status">Loading the box</span>
    </div>
  );
}

export default function AssortmentFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = id !== undefined;
  const recordId = Number(id);
  const sizes = useBoxSizes();
  const collection = useCollection();
  const assortment = useAssortment(isEdit ? recordId : 0);
  const back = () => navigate("/products/boxes");

  if (isEdit && !validRecordId(recordId)) {
    return <RecordLoadError name="box" invalidId error={undefined} retry={() => {}} back={back} />;
  }
  if (sizes.isPending || collection.isPending || (isEdit && assortment.isPending)) return <FormSkeleton />;
  if (sizes.isError || collection.isError || (isEdit && (assortment.isError || !assortment.data))) {
    return (
      <RecordLoadError
        name="box"
        invalidId={false}
        error={sizes.error ?? collection.error ?? assortment.error}
        retry={() => {
          void sizes.refetch();
          void collection.refetch();
          if (isEdit) void assortment.refetch();
        }}
        back={back}
      />
    );
  }
  return (
    <AssortmentForm
      key={assortment.data?.id ?? "new"}
      assortment={isEdit ? assortment.data : undefined}
      sizes={sizes.data ?? []}
      collection={collection.data ?? []}
    />
  );
}
