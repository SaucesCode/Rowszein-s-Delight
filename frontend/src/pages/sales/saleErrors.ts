import axios from "axios";

/** The first string found in an error body, however deeply the server nested it (fields, boxes, box fields). */
function firstMessage(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = firstMessage(entry);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const entry of Object.values(value)) {
      const found = firstMessage(entry);
      if (found) return found;
    }
  }
  return null;
}

/** Why the server refused a sale (a 400), in its own words; null when it wasn't a refusal. */
export function saleRefusalMessage(error: unknown): string | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 400) return null;
  return firstMessage(error.response.data?.error);
}
