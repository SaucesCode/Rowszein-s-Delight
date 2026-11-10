/** No token storage and no business-request replay. Web Locks serializes tabs. */
export type LockProvider = <T>(name: string, action: () => Promise<T>) => Promise<T>;

export function createAuthLifecycle(lock: LockProvider | undefined) {
  let refreshing: Promise<unknown> | undefined;
  const transition = <T>(action: () => Promise<T>): Promise<T> => {
    // A localStorage lease is not an atomic cross-tab lock. Require password
    // login instead of attempting an uncoordinated strict-refresh rotation.
    if (!lock) return Promise.reject(new Error("Session renewal requires a browser with Web Locks. Sign in again."));
    return lock("rowszein-auth-lifecycle-v2", action);
  };
  return {
    transition,
    refresh<T>(action: () => Promise<T>): Promise<T> {
      if (!refreshing) refreshing = transition(action).finally(() => { refreshing = undefined; });
      return refreshing as Promise<T>;
    },
  };
}

const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
export const authLifecycle = createAuthLifecycle(locks ? (name, action) => locks.request(name, action) : undefined);
