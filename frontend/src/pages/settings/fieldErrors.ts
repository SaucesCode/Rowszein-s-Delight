/** How each settings section finds its server message and its control's id, by the API's key ("hours.2.closes"). */
export interface FieldErrors {
  error: (key: string) => string | undefined;
  fid: (key: string) => string;
}

/** Props for an input that may carry a server message: invalid state plus the message id. */
export function invalidProps({ error, fid }: FieldErrors, key: string) {
  const message = error(key);
  return {
    id: fid(key),
    "aria-invalid": message ? true : undefined,
    "aria-describedby": message ? `${fid(key)}-msg` : undefined,
  };
}
