import { useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import OwnerHomePage from "@/pages/OwnerHomePage";
import { OwnerShell } from "@/layouts/OwnerLayout";
import { ingredientKeys } from "@/lib/managementQueryKeys";
import { getDateRange } from "@/lib/dateRanges";

/** Design preview of the Control Hub with seeded sample data; no backend needed. */
export default function OwnerHomePreviewHarness() {
  const previewClient = useMemo(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Infinity,
          gcTime: Infinity,
          refetchOnMount: false,
          refetchOnWindowFocus: false,
          refetchOnReconnect: false,
        },
      },
    });

    const ownerUser = { id: 1, username: "rose", email: "owner@example.com", role: "admin" as const };
    const now = new Date();
    const todayRange = getDateRange("today", now);
    const weekRange = getDateRange("this_week", now);

    client.setQueryData(["auth", "me"], ownerUser);

    client.setQueryData(ingredientKeys.lowStock(ownerUser), [
      { id: 1, name: "Dark chocolate glaze", quantity: "1.80", minimum_stock: "5.00", unit: "kg", is_low_stock: true },
      { id: 2, name: "Pure vanilla extract", quantity: "0.45", minimum_stock: "1.00", unit: "l", is_low_stock: true },
      { id: 3, name: "Ube halaya", quantity: "0", minimum_stock: "2.00", unit: "kg", is_low_stock: true },
    ]);

    const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
    const sale = (id: number, minutes: number, items: [string, number, number][], status = "recorded") => ({
      id,
      date: todayRange.date_from,
      created_at: minutesAgo(minutes),
      status,
      total_amount: items.reduce((sum, [, quantity, price]) => sum + quantity * price, 0),
      sale_items: items.map(([product_name, quantity, unit_price], index) => ({ id: index, product: index, product_name, quantity, unit_price })),
    });
    client.setQueryData(["sales", todayRange], {
      success: true,
      data: {
        count: 34,
        next: null,
        previous: null,
        results: [
          sale(134, 4, [["Strawberry Frosted", 2, 45], ["Glazed Classic", 1, 35]]),
          sale(133, 18, [["Ube Coconut", 6, 58]]),
          sale(132, 31, [["Choco Bavarian", 1, 60]], "cancelled"),
          sale(131, 47, [["Uji Matcha Glaze", 3, 55], ["Strawberry Frosted", 3, 45]]),
          sale(130, 62, [["Glazed Classic", 12, 35]]),
        ],
      },
    });

    client.setQueryData(["sales", "summary", todayRange], {
      totals: { gross_sales: "5896.00", sales_adjustments: "0.00", cancellation_amount: "0.00", net_sales: "5896.00" },
    });

    client.setQueryData(["dashboard", todayRange], {
      totals: { net_sales: "5896.00", total_expenses: 0, net_profit: 0 },
      best_selling: [{ product_id: 1, product_name: "Strawberry Frosted", total_quantity: 18, total_revenue: 810 }],
    });

    client.setQueryData(["dashboard", weekRange], {
      totals: { net_sales: "31420.00", total_expenses: 7689, net_profit: 9312.5 },
      best_selling: [],
    });

    return client;
  }, []);

  return (
    <QueryClientProvider client={previewClient}>
      <OwnerShell>
        <OwnerHomePage />
      </OwnerShell>
    </QueryClientProvider>
  );
}
