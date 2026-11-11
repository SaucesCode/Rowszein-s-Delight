import { useState } from "react";
import { useIngredients } from "@/hooks/useIngredients";
import { useProducts } from "@/hooks/useProducts";
import PageHeader from "@/components/PageHeader";
import Pagination from "@/components/Pagination";
import type { Product } from "@/types/product.types";
import SearchInput from "@/components/SearchInput";
import { useListingPageRecovery } from "@/hooks/useListingPageRecovery";

type Stock = { id: number; name: string; quantity: string | number; unit: string; is_low_stock: boolean };

export function OperationalStockPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const { data, isLoading, isError, error, refetch } = useIngredients(page, { search });
  useListingPageRecovery(page, error, setPage);
  const rows: Stock[] = data?.data?.results ?? [];
  return <div>
    <PageHeader title="Stock quantities" description="Operational stock status. Ask the owner to make stock corrections." />
    <SearchInput value={search} onChange={value => { setSearch(value); setPage(1); }} ariaLabel="Search stock" />
    {isLoading && <p role="status">Loading stock…</p>}
    {isError && <p role="alert">Unable to load stock. Your access may have changed; sign in again.</p>}
    {isError && <button type="button" onClick={() => { void refetch(); }}>Retry stock</button>}
    {!isLoading && !isError && rows.length === 0 && <p role="status">No matching stock records.</p>}
    <div className="card-surface p-4 overflow-auto"><table className="w-full text-left"><thead><tr><th>Ingredient</th><th>Quantity</th><th>Unit</th><th>Status</th></tr></thead><tbody>
      {rows.map(row => <tr key={row.id}><td>{row.name}</td><td>{row.quantity}</td><td>{row.unit}</td><td>{Number(row.quantity) === 0 ? "Out of stock" : row.is_low_stock ? "Low stock" : "In stock"}</td></tr>)}
    </tbody></table></div>
    <Pagination page={page} totalPages={Math.ceil((data?.data?.count ?? 0) / 20)} onPageChange={setPage} />
  </div>;
}

export function OperationalCatalogPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const { data, isLoading, isError, error, refetch } = useProducts(page, { search });
  useListingPageRecovery(page, error, setPage);
  const rows: Product[] = data?.data?.results ?? [];
  return <div>
    <PageHeader title="Catalog" description="Current catalog prices and availability. Catalog changes require the owner." />
    <SearchInput value={search} onChange={value => { setSearch(value); setPage(1); }} ariaLabel="Search catalog" />
    {isLoading && <p role="status">Loading catalog…</p>}
    {isError && <p role="alert">Unable to load catalog. Your access may have changed; sign in again.</p>}
    {isError && <button type="button" onClick={() => { void refetch(); }}>Retry catalog</button>}
    {!isLoading && !isError && rows.length === 0 && <p role="status">No matching products.</p>}
    <div className="card-surface p-4 overflow-auto"><table className="w-full text-left"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Availability</th></tr></thead><tbody>
      {rows.map(row => <tr key={row.id}><td>{row.name}</td><td>{row.category.name}</td><td>₱{row.price}</td><td>{row.is_available ? "Available" : "Unavailable"}</td></tr>)}
    </tbody></table></div>
    <Pagination page={page} totalPages={Math.ceil((data?.data?.count ?? 0) / 20)} onPageChange={setPage} />
  </div>;
}
