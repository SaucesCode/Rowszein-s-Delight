import { useEffect, useRef, useState } from "react";
import { Link, useBlocker, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import toast from "react-hot-toast";
import { CheckCircle2, X } from "lucide-react";
import { useMe } from "@/hooks/useAuth";
import { useCreateSale, useSale, useUpdateSale } from "@/hooks/useSales";
import { useSellableProducts } from "@/hooks/useProducts";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { manilaDate } from "@/lib/dateRanges";
import { validRecordId } from "@/lib/managementQueryKeys";
import type { Product } from "@/types/product.types";
import type { Sale, SalePayload } from "@/types/sale.types";
import ConfirmDialog from "@/components/ConfirmDialog";
import RecordLoadError from "@/components/RecordLoadError";
import { formatPeso } from "@/pages/dashboard/report-format";
import Catalog from "./sales/Catalog";
import TicketPanel, { type Recorded } from "./sales/TicketPanel";
import { countLabel, useTicket, type TicketLine } from "./sales/useTicket";
import "./sales/sales.css";

const WIDE = "(min-width: 1100px)";

/** Same rules the server enforces, worded for the counter. */
const saleSchema = z.object({
  date: z.string().min(1, "Choose the sale date."),
  notes: z.string().optional(),
  sale_items: z
    .array(
      z.object({
        product: z.number().min(1),
        quantity: z.number().int().min(1, "Each donut needs a quantity of at least 1."),
        unit_price: z.number().min(0.01, "Each price must be more than ₱0."),
      }),
    )
    .min(1, "Add at least one donut to the order."),
});

function linesFrom(sale?: Sale): TicketLine[] {
  return (sale?.sale_items ?? []).map(item => ({
    product: item.product,
    name: item.product_name ?? "Donut",
    unitPrice: Number(item.unit_price),
    quantity: item.quantity,
  }));
}

function Register({ sale }: { sale?: Sale }) {
  const { data: user } = useMe();
  const isStaff = user?.role === "staff";
  const isEdit = !!sale;
  const today = manilaDate();
  const isWide = useMediaQuery(WIDE);
  const sheetRef = useRef<HTMLDialogElement>(null);

  const ticket = useTicket(linesFrom(sale));
  const [date, setDate] = useState(sale?.date ?? today);
  const [notes, setNotes] = useState(sale?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<Recorded | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify({ lines: linesFrom(sale), date: sale?.date ?? today, notes: sale?.notes ?? "" }),
  );

  const products = useSellableProducts();
  const partnerNames = new Map((products.data ?? []).map(product => [product.id, product.partner?.name]));
  const createSale = useCreateSale();
  const updateSale = useUpdateSale(sale?.id ?? 0, sale?.revision);
  const saving = createSale.isPending || updateSale.isPending;
  const done = updateSale.isSuccess;

  const dirty = JSON.stringify({ lines: ticket.lines, date, notes }) !== baseline;
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && ticket.lines.length > 0 && !saving && !done && currentLocation.pathname !== nextLocation.pathname,
  );

  const showSheet = sheetOpen && !isWide;
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    if (showSheet && !sheet.open) sheet.showModal();
    if (!showSheet && sheet.open) sheet.close();
  }, [showSheet]);

  const add = (product: Product) => {
    setRecorded(null);
    setError(null);
    ticket.add(product);
  };

  const submit = () => {
    const parsed = saleSchema.safeParse({
      date,
      notes: notes.trim(),
      sale_items: ticket.lines.map(line => ({ product: line.product, quantity: line.quantity, unit_price: line.unitPrice })),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the order and try again.");
      return;
    }
    setError(null);
    const payload: SalePayload = parsed.data;

    if (sale) {
      updateSale.mutate(payload);
      return;
    }

    const snapshot = { amount: ticket.totals.amount, pieces: ticket.totals.pieces };
    createSale.mutate(payload, {
      onSuccess: () => {
        const at = new Date();
        setRecorded({ ...snapshot, at });
        toast.success(`Sale recorded: ${formatPeso(snapshot.amount)}.`);
        ticket.clear();
        setNotes("");
        setDate(today);
        setSheetOpen(false);
        setBaseline(JSON.stringify({ lines: [], date: today, notes: "" }));
      },
    });
  };

  const panel = (
    <TicketPanel
      ticket={ticket}
      partnerOf={productId => partnerNames.get(productId)}
      title={isEdit ? "This sale" : "Order"}
      canEditPrice={!isStaff}
      date={date}
      today={today}
      onDateChange={isEdit || isStaff ? undefined : setDate}
      notes={notes}
      onNotesChange={setNotes}
      error={error}
      saving={saving}
      submitLabel={isEdit ? "Save changes" : "Record sale"}
      onSubmit={submit}
      onClear={() => setClearOpen(true)}
      recorded={recorded}
    />
  );

  return (
    <div className="register">
      <header className="page-head register-head">
        <div>
          <h1 className="type-page">{isEdit ? "Edit sale" : "New sale"}</h1>
          <p className="page-lede">
            {isEdit
              ? "Change what was sold. The stock adjusts to match when you save."
              : "Tap donuts to build the order, then record it."}
          </p>
        </div>
      </header>

      {!isWide && recorded && (
        <p className="register-banner" role="status">
          <CheckCircle2 size={20} aria-hidden="true" />
          Recorded {formatPeso(recorded.amount)}. Ready for the next customer.
          <Link to="/sales" className="home-link">See sales</Link>
        </p>
      )}

      <div className="register-body">
        <Catalog
          products={products.data ?? []}
          loading={products.isPending}
          error={products.isError}
          onRetry={() => void products.refetch()}
          onAdd={add}
          quantityOf={ticket.quantityOf}
          canManageMenu={!isStaff}
        />
        {isWide && <aside className="register-ticket" aria-label="Order ticket">{panel}</aside>}
      </div>

      {!isWide && ticket.lines.length > 0 && (
        <div className="register-dock">
          <p>
            <span>{countLabel(ticket.totals.pieces, ticket.lines.some(line => partnerNames.get(line.product)))}</span>
            <strong key={ticket.totals.pieces} className="num register-dock-total">{formatPeso(ticket.totals.amount)}</strong>
          </p>
          <button type="button" className="btn-primary" onClick={() => setSheetOpen(true)} aria-haspopup="dialog">
            Review order
          </button>
        </div>
      )}

      {!isWide && (
        <dialog ref={sheetRef} className="register-sheet" aria-label="Order ticket" onClose={() => setSheetOpen(false)}>
          <button type="button" className="icon-button register-sheet-close" onClick={() => setSheetOpen(false)}>
            <X size={22} aria-hidden="true" />
            <span className="sr-only">Back to the donuts</span>
          </button>
          {showSheet && panel}
        </dialog>
      )}

      <ConfirmDialog
        open={clearOpen}
        title="Start this order over?"
        description="Everything on the ticket will be cleared. Nothing has been recorded yet."
        confirmLabel="Clear the ticket"
        cancelLabel="Keep the order"
        destructive
        onConfirm={() => {
          ticket.clear();
          setNotes("");
          setClearOpen(false);
        }}
        onCancel={() => setClearOpen(false)}
      />

      <ConfirmDialog
        open={blocker.state === "blocked"}
        title={isEdit ? "Leave without saving?" : "Leave this order?"}
        description={
          isEdit
            ? "Your changes to this sale haven't been saved."
            : "The donuts on the ticket haven't been recorded as a sale yet."
        }
        confirmLabel={isEdit ? "Leave without saving" : "Leave without recording"}
        cancelLabel={isEdit ? "Keep editing" : "Back to the order"}
        destructive
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </div>
  );
}

function LockedSale({ sale }: { sale: Sale }) {
  const cancelled = sale.status === "cancelled";
  return (
    <div className="card-surface p-6" role="alert">
      <p>
        {cancelled
          ? "This sale was cancelled, so it can't be changed. It stays in your records."
          : "This sale was recorded before stock tracking began, so it can't be changed here."}
      </p>
      <Link to="/sales" className="btn-secondary mt-4">Back to sales</Link>
    </div>
  );
}

export default function SaleFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = id !== undefined;
  const recordId = Number(id);
  const saleQuery = useSale(isEdit && validRecordId(recordId) ? recordId : 0);

  if (!isEdit) return <Register />;

  const back = () => navigate("/sales");
  if (!validRecordId(recordId)) return <RecordLoadError name="sale" invalidId error={undefined} retry={() => {}} back={back} />;
  if (saleQuery.isPending) {
    return (
      <div aria-busy="true">
        <span className="skeleton block h-10 w-56" />
        <span className="skeleton mt-8 block h-96 w-full" aria-hidden="true" />
        <span className="sr-only" role="status">Loading the sale</span>
      </div>
    );
  }
  if (saleQuery.isError || !saleQuery.data) {
    return <RecordLoadError name="sale" invalidId={false} error={saleQuery.error} retry={() => void saleQuery.refetch()} back={back} />;
  }
  const sale: Sale = saleQuery.data;
  if (sale.status === "cancelled" || sale.inventory_tracking === "legacy_unknown") return <LockedSale sale={sale} />;
  return <Register key={sale.id} sale={sale} />;
}
