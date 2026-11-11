import { useEffect } from "react";
import { isAxiosError } from "axios";

// A deletion or visibility change can remove the last page while it is open.
export function useListingPageRecovery(page: number, error: unknown, changePage: (page: number) => void) {
  useEffect(() => {
    if (page > 1 && isAxiosError(error) && error.response?.status === 404) changePage(1);
  }, [page, error, changePage]);
}
