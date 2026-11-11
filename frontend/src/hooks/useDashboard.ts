import { useQuery } from "@tanstack/react-query";
import { dashboardService } from "@/services/dashboard.service";
import type { DashboardFilters } from "@/services/dashboard.service";

export function useDashboard(filters?: DashboardFilters, enabled = true) {
  return useQuery({
    queryKey: ["dashboard", filters],
    queryFn: () => dashboardService.get(filters),
    enabled,
  });
}

export function useProductMargins() {
  return useQuery({
    queryKey: ["dashboard", "profit-margins"],
    queryFn: dashboardService.getProfitMargins,
  });
}
