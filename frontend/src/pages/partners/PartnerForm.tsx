import { useId } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { useSavePartner } from "@/hooks/usePartners";
import { apiErrorMessage, apiFieldErrors } from "@/lib/csrfTransport";
import type { Partner } from "@/types/partner.types";

const partnerSchema = z.object({
  name: z.string().trim().min(1, "Give the partner a name").max(100, "Keep the name under 100 characters"),
  blurb: z.string().trim().max(160, "Keep this line under 160 characters"),
  contact: z.string().trim().max(200, "Keep the contact under 200 characters"),
  notes: z.string(),
});

type PartnerFormValues = z.infer<typeof partnerSchema>;
const FIELDS = ["name", "blurb", "contact", "notes"] as const;

export default function PartnerForm({ partner, onDone }: { partner?: Partner; onDone: () => void }) {
  const id = useId();
  const field = (name: string) => `${id}-${name}`;
  const save = useSavePartner();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<PartnerFormValues>({
    resolver: zodResolver(partnerSchema),
    defaultValues: {
      name: partner?.name ?? "",
      blurb: partner?.blurb ?? "",
      contact: partner?.contact ?? "",
      notes: partner?.notes ?? "",
    },
  });

  const onSubmit = async (values: PartnerFormValues) => {
    try {
      await save.mutateAsync({ id: partner?.id, payload: partner ? values : { ...values, is_active: true } });
      onDone();
    } catch (error) {
      const fields = apiFieldErrors(error);
      const known = FIELDS.filter(name => fields?.[name]);
      for (const name of known) setError(name, { message: fields![name] });
      if (!known.length) toast.error(apiErrorMessage(error, "Couldn't save the partner. Check the connection and try again."));
    }
  };

  const describe = (name: keyof PartnerFormValues, hint?: string) =>
    [errors[name] ? field(`${name}-error`) : null, hint ? field(`${name}-hint`) : null].filter(Boolean).join(" ") || undefined;

  return (
    <form className="partner-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="partner-form-grid">
        <div>
          <label htmlFor={field("name")} className="field-label">Partner name</label>
          <input id={field("name")} className="field-input" autoComplete="organization" aria-invalid={!!errors.name}
            aria-describedby={describe("name")} {...register("name")} />
          {errors.name && <p id={field("name-error")} className="field-error">{errors.name.message}</p>}
        </div>
        <div>
          <label htmlFor={field("blurb")} className="field-label">Line shown in the shop <span className="field-optional">(optional)</span></label>
          <input id={field("blurb")} className="field-input" aria-invalid={!!errors.blurb}
            aria-describedby={describe("blurb", "hint")} {...register("blurb")} />
          <p id={field("blurb-hint")} className="field-hint">For example “Muffins and loaves from Marikina”.</p>
          {errors.blurb && <p id={field("blurb-error")} className="field-error">{errors.blurb.message}</p>}
        </div>
        <div>
          <label htmlFor={field("contact")} className="field-label">Contact <span className="field-optional">(only you see this)</span></label>
          <input id={field("contact")} className="field-input" aria-invalid={!!errors.contact}
            aria-describedby={describe("contact")} {...register("contact")} />
          {errors.contact && <p id={field("contact-error")} className="field-error">{errors.contact.message}</p>}
        </div>
        <div className="partner-form-wide">
          <label htmlFor={field("notes")} className="field-label">Notes <span className="field-optional">(only you see this)</span></label>
          <textarea id={field("notes")} className="field-input" rows={2} aria-invalid={!!errors.notes}
            aria-describedby={describe("notes")} {...register("notes")} />
          {errors.notes && <p id={field("notes-error")} className="field-error">{errors.notes.message}</p>}
        </div>
      </div>
      <div className="partner-form-actions">
        <button type="submit" className="btn-primary" disabled={save.isPending} aria-busy={save.isPending}>
          {save.isPending ? "Saving…" : partner ? "Save partner" : "Add partner"}
        </button>
        <button type="button" className="btn-secondary" onClick={onDone} disabled={save.isPending}>Cancel</button>
      </div>
    </form>
  );
}
