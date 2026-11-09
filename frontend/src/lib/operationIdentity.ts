import axios from "axios";

export interface OperationIdentity {
  key: string;
  revision?: string;
  hasPriorAttempt: boolean;
}

type IdentityStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function beginIdentity(
  storage: IdentityStorage,
  name: string,
  revision: string | undefined,
  createKey: () => string,
): OperationIdentity {
  const stored = storage.getItem(name);
  let identity: OperationIdentity;
  if (stored !== null) {
    const previous = JSON.parse(stored) as Partial<OperationIdentity>;
    if (typeof previous.key !== "string" || !previous.key) {
      throw new Error("The pending operation identity is invalid; reconcile it before retrying.");
    }
    identity = { key: previous.key, revision: previous.revision, hasPriorAttempt: true };
  } else {
    identity = { key: createKey(), revision, hasPriorAttempt: false };
  }
  // Persist BEFORE dispatch, including on retries/reloads. If storage fails,
  // no request is sent with an identity whose history was not retained.
  storage.setItem(name, JSON.stringify(identity));
  return identity;
}

function knownRejection(error: unknown): boolean {
  if (!axios.isAxiosError(error) || !error.response) return false;
  const detail = JSON.stringify(error.response.data) ?? "";
  // Authentication/CSRF failures must retain the pending intent even on its
  // first attempt; recovery must not generate a replacement operation UUID.
  return [400, 404, 409].includes(error.response.status) && !detail.includes("request identity was already used");
}

export function rejectIdentity(storage: IdentityStorage, name: string, error: unknown): void {
  const stored = storage.getItem(name);
  if (stored === null) return;
  const identity = JSON.parse(stored) as OperationIdentity;
  // A later rejection says nothing about whether an EARLIER attempt committed.
  // Only a known rejection of the first attempt can discard this UUID.
  if (identity.hasPriorAttempt === false && knownRejection(error)) storage.removeItem(name);
}
