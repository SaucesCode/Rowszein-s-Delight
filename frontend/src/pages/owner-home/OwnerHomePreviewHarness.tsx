import { useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import OwnerHomePage from "@/pages/OwnerHomePage";
import { ingredientKeys, recipeKeys, queryScope } from "@/lib/managementQueryKeys";
import { getDateRange } from "@/lib/dateRanges";

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

    const ownerUser = { id: 1, username: "Rose", email: "rose@rowszein.com", role: "admin" as const };
    const scope = queryScope(ownerUser);
    const now = new Date();
    const todayRange = getDateRange("today", now);
    const weekRange = getDateRange("this_week", now);

    // 1. Seed auth
    client.setQueryData(["auth", "me"], ownerUser);

    // 2. Seed products
    client.setQueryData(
      ["products", "list", scope, { page: 1 }],
      {
        success: true,
        data: {
          count: 12,
          next: null,
          previous: null,
          results: [
            { id: 1, name: "Strawberry Frosted Delight", price: 45, is_available: true },
            { id: 2, name: "Glazed Classic Ring", price: 35, is_available: true },
            { id: 3, name: "Choco Bavarian Filled", price: 50, is_available: false },
            { id: 4, name: "Cinnamon Sugar Twist", price: 38, is_available: true },
          ],
        },
      }
    );

    // Categories
    client.setQueryData(["product-categories", "list", scope], {
      success: true,
      data: [
        { id: 1, name: "Glazed Rings" },
        { id: 2, name: "Filled Custard" },
      ],
    });

    // 3. Seed low stock ingredients
    client.setQueryData(ingredientKeys.lowStock(ownerUser), [
      { id: 1, name: "Dark Chocolate Glaze", quantity: "1.80", minimum_stock: 5, unit: "kg" },
      { id: 2, name: "Pure Vanilla Extract", quantity: "0.45", minimum_stock: 1, unit: "L" },
    ]);

    // 4. Seed sales for today
    client.setQueryData(["sales", todayRange], {
      success: true,
      data: {
        count: 34,
        next: null,
        previous: null,
        results: [
          { id: 101, total_amount: 420, date: todayRange.date_from },
          { id: 102, total_amount: 540, date: todayRange.date_from },
        ],
      },
    });

    client.setQueryData(["sales", "summary", todayRange], {
      totals: {
        gross_sales: "57896.00",
        sales_adjustments: "0.00",
        cancellation_amount: "0.00",
        net_sales: "57896.00",
      },
    });

    // 5. Seed expenses for this week
    client.setQueryData(["expenses", weekRange], {
      count: 4,
      results: [{ id: 1, amount: 2500 }, { id: 2, amount: 1275 }, { id: 3, amount: 2100 }, { id: 4, amount: 1814 }],
    });

    client.setQueryData(["dashboard", weekRange], {
      totals: {
        total_expenses: 7689,
      },
    });

    // 6. Seed recipes
    client.setQueryData(recipeKeys.list(ownerUser, 1, {}), {
      success: true,
      data: {
        count: 6,
        results: [],
      },
    });

    return client;
  }, []);

  return (
    <QueryClientProvider client={previewClient}>
      <OwnerHomePage />
    </QueryClientProvider>
  );
}
