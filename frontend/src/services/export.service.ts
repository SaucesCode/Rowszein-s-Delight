import api from "./api";

async function downloadFile(url: string, filename: string, params?: Record<string, string>) {
  const response = await api.get(url, {
    params,
    responseType: "blob",
  });

  const blob = new Blob([response.data]);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export const exportService = {
  salesCSV: (filters?: { date_from?: string; date_to?: string }) =>
    downloadFile("/sales/export/csv/", "sales.csv", filters),

  salesPDF: (filters?: { date_from?: string; date_to?: string }) =>
    downloadFile("/sales/export/pdf/", "sales.pdf", filters),

  expensesCSV: (filters?: { date_from?: string; date_to?: string }) =>
    downloadFile("/expenses/export/csv/", "expenses.csv", filters),

  expensesPDF: (filters?: { date_from?: string; date_to?: string }) =>
    downloadFile("/expenses/export/pdf/", "expenses.pdf", filters),
};
