import { createCookieApi } from "@/lib/csrfTransport";

const api = createCookieApi(window.location.origin, async () => {
  const response = await fetch("/api/auth/csrf/", {
    credentials: "same-origin", cache: "no-store", redirect: "error", headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Unable to initialize request verification.");
  const body = await response.json();
  return body.data?.csrf_token;
});

export default api;
