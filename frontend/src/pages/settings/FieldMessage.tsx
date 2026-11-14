import type { FieldErrors } from "./fieldErrors";

/** The server's message for one field, linked to its control by id. */
export default function FieldMessage({ fields, name }: { fields: FieldErrors; name: string }) {
  const message = fields.error(name);
  return message ? <p id={`${fields.fid(name)}-msg`} className="field-error">{message}</p> : null;
}
