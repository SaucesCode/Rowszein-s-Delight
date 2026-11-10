type Identity = { role: string } | null | undefined;
const STAFF = new Set(["self.read", "catalog.read", "stock.read", "sales.read", "sales.create"]);
const OWNER = new Set([...STAFF, "catalog.manage", "stock.manage", "stock.adjust", "recipes.manage", "sales.update", "sales.cancel", "sales.export", "finance.read", "expenses.manage"]);

export function can(user: Identity, capability: string): boolean {
  return (user?.role === "admin" ? OWNER : user?.role === "staff" ? STAFF : new Set()).has(capability);
}

export function homeFor(user: Identity): string {
  return can(user, "finance.read") ? "/dashboard" : can(user, "sales.read") ? "/sales" : "/login";
}

export function canVisit(user: Identity, path: string): boolean {
  const routes: [RegExp, string][] = [
    [/^\/sales\/new\/?$/, "sales.create"], [/^\/sales\/\d+\/edit\/?$/, "sales.update"], [/^\/sales\/?$/, "sales.read"],
    [/^\/products\/?$/, "catalog.read"], [/^\/products\/(new|\d+\/edit)\/?$/, "catalog.manage"],
    [/^\/ingredients\/?$/, "stock.read"], [/^\/ingredients\/(new|\d+\/edit)\/?$/, "stock.manage"],
    [/^\/recipes(?:\/(?:new|\d+\/edit))?\/?$/, "recipes.manage"],
    [/^\/expenses(?:\/(?:new|\d+\/edit))?\/?$/, "expenses.manage"],
    [/^\/(dashboard|profit-margins)\/?$/, "finance.read"],
  ];
  const route = routes.find(([pattern]) => pattern.test(path));
  return !!route && can(user, route[1]);
}

export function manilaDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (kind: string) => parts.find(item => item.type === kind)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
