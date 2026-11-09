import { useMe } from "@/hooks/useAuth";
import axios from "axios";

interface Identity { key: string; revision?: string }

export function rejectedBeforeCommit(error: unknown): boolean {
  if (!axios.isAxiosError(error) || !error.response) return false;
  const detail = JSON.stringify(error.response.data);
  return [400, 401, 403, 404, 409].includes(error.response.status) && !detail.includes("request identity was already used");
}

/** Persist an uncertain intent through retries/reloads, never auth tokens. */
export function useOperationIdentity() {
  const { data: user } = useMe();
  const prefix = `rowszein_operation:${user?.id ?? "pending"}:`;
  return {
    get(target: string, revision?: string): Identity {
      if (!user) throw new Error("Sign in before submitting a transaction.");
      const name = prefix + target;
      const stored = sessionStorage.getItem(name);
      if (stored) {
        const identity = JSON.parse(stored) as Identity;
        if (identity.key) return identity;
      }
      const identity = { key: crypto.randomUUID(), revision };
      // Fail closed if persistence is unavailable; do not silently create a
      // new key after a reload of an operation whose outcome is unknown.
      sessionStorage.setItem(name, JSON.stringify(identity));
      return identity;
    },
    clear(target: string) { sessionStorage.removeItem(prefix + target); },
  };
}
