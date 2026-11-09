import { useMe } from "@/hooks/useAuth";
import { beginIdentity, rejectIdentity } from "@/lib/operationIdentity";

/** Persist an uncertain intent through retries/reloads, never auth tokens. */
export function useOperationIdentity() {
  const { data: user } = useMe();
  const prefix = `rowszein_operation:${user?.id ?? "pending"}:`;
  return {
    get(target: string, revision?: string) {
      if (!user) throw new Error("Sign in before submitting a transaction.");
      return beginIdentity(sessionStorage, prefix + target, revision, () => crypto.randomUUID());
    },
    clear(target: string) { sessionStorage.removeItem(prefix + target); },
    reject(target: string, error: unknown) { rejectIdentity(sessionStorage, prefix + target, error); },
  };
}
