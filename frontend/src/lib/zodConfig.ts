import { z } from "zod";

// The Content-Security-Policy (frontend/vercel.json) forbids eval. Without this,
// Zod probes for it with `new Function` when a schema is defined, and the
// browser reports a violation. Imported first in main.tsx so it runs before any
// schema module.
z.config({ jitless: true });
