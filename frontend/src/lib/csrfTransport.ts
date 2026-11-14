import axios, { AxiosHeaders } from "axios";
import type { InternalAxiosRequestConfig } from "axios";

const MASKED_TOKEN = /^[a-zA-Z0-9]{64}$/;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS", "TRACE"]);

export function createCsrfState(load: () => Promise<string>) {
  let token: string | null = null;
  let pending: Promise<string> | null = null;
  let generation = 0;

  function validate(value: unknown): string {
    if (typeof value !== "string" || !MASKED_TOKEN.test(value)) throw new Error("Unable to initialize request verification.");
    return value;
  }

  function get(): Promise<string> {
    if (token) return Promise.resolve(token);
    if (pending) return pending;
    const started = generation;
    const request = load().then((value) => {
      const loaded = validate(value);
      if (started === generation) token = loaded;
      return token ?? get();
    }).finally(() => {
      if (pending === request) pending = null;
    });
    pending = request;
    return request;
  }

  return {
    get,
    adopt(value: unknown) {
      token = validate(value);
      generation += 1;
      pending = null;
    },
    refresh(stale: string | undefined) {
      if (token && token !== stale) return get();
      if (pending) return pending;
      token = null;
      generation += 1;
      return get();
    },
  };
}

interface VerifiedRequest extends InternalAxiosRequestConfig {
  csrfRetried?: boolean;
  csrfTokenSent?: string;
}

export function createCookieApi(origin: string, bootstrap: () => Promise<string>) {
  const csrf = createCsrfState(bootstrap);
  const api = axios.create({ baseURL: "/api", withCredentials: true, headers: { "Content-Type": "application/json" } });

  api.interceptors.request.use(async (raw) => {
    const request = raw as VerifiedRequest;
    const target = new URL(api.getUri(request), origin);
    if (target.origin !== origin || !target.pathname.startsWith("/api/")) {
      throw new Error("This client only sends requests to the same-origin API.");
    }
    if (!SAFE_METHODS.has((request.method ?? "GET").toUpperCase())) {
      const token = await csrf.get();
      request.headers.set("X-CSRFToken", token);
      request.csrfTokenSent = token;
    }
    return request;
  });

  api.interceptors.response.use((response) => {
    const rotated: unknown = response.data?.csrf_token;
    if (rotated !== undefined) csrf.adopt(rotated);
    return response;
  }, async (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const request = error.config as VerifiedRequest | undefined;
      const failure = error.response?.data?.error;
      if (request && error.response?.status === 403 && failure?.code === "csrf_failed"
          && failure.retryable === true && !request.csrfRetried
          && !SAFE_METHODS.has((request.method ?? "GET").toUpperCase())) {
        request.csrfRetried = true;
        await csrf.refresh(request.csrfTokenSent);
        // Reuse the original config/body/UUID/revision, never recreate an intent.
        request.headers = AxiosHeaders.from(request.headers);
        return api.request(request);
      }
    }
    return Promise.reject(error);
  });
  return api;
}

/** A 400's per-field messages (first message per field), or null when the error isn't about fields. */
export function apiFieldErrors(error: unknown): Record<string, string> | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 400) return null;
  const failure: unknown = error.response.data?.error;
  if (!failure || typeof failure !== "object" || Array.isArray(failure)) return null;
  const fields: Record<string, string> = {};
  for (const [field, messages] of Object.entries(failure)) {
    const first = Array.isArray(messages) ? messages[0] : messages;
    if (typeof first === "string") fields[field] = first;
  }
  return Object.keys(fields).length ? fields : null;
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error) || !error.response) return fallback;
  const failure: unknown = error.response.data?.error;
  if (typeof failure === "string" && [401, 403, 429].includes(error.response.status)) return failure;
  if (failure && typeof failure === "object" && "message" in failure && typeof failure.message === "string") return failure.message;
  if (error.response.status === 401) return "Sign in before retrying this operation.";
  if (error.response.status === 403) return "This request is not permitted.";
  if (error.response.status === 429) return "Too many requests. Wait before retrying.";
  return fallback;
}
