export type ListingParams = {
  page?: number; page_size?: number; search?: string; ordering?: string; id?: number;
  category?: string; is_available?: boolean; is_featured?: boolean; category_active?: boolean;
  is_active?: boolean; unit?: string; status?: string;
};

export function listingParams(params: ListingParams): ListingParams {
  return Object.fromEntries(Object.entries(params).flatMap(([key, value]) => {
    if (value === undefined || value === "" || (value === "all" && ["category", "status", "unit"].includes(key))) return [];
    const normalized = typeof value === "string" ? value.trim() : value;
    return normalized === "" ? [] : [[key, normalized]];
  }));
}

export function uniqueRecords<T extends { id: number }>(pages: T[][]): T[] {
  return [...new Map(pages.flat().map(record => [record.id, record])).values()];
}
