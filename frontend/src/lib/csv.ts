/** Builds a CSV in the browser and downloads it. Every field is quoted so commas and quotes survive. */
export function downloadCSV(filename: string, header: string[], rows: (string | number)[][]) {
  const csv = [header, ...rows]
    .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
