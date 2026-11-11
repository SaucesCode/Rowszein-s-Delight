import { useEffect, type Ref, type SelectHTMLAttributes } from "react";
import { useListingPages, useSelectedLookup } from "@/hooks/useListingPages";
import { uniqueRecords, type ListingParams } from "@/lib/listingParams";
import type { LookupKind, LookupRecord } from "@/services/listing.service";
import { useState } from "react";

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, "onSelect"> & {
  ref?: Ref<HTMLSelectElement>; kind: LookupKind; label: string; selectedId: number;
  params?: ListingParams; publicOnly?: boolean; emptyLabel?: string; onSelect?: (record: LookupRecord) => void; onResolved?: (record: LookupRecord) => void;
};

export default function PaginatedLookup({ kind, label, selectedId, params = {}, publicOnly = false, emptyLabel = "Select an option…", onSelect, onResolved, ref, ...props }: Props) {
  const [search, setSearch] = useState("");
  const pages = useListingPages<LookupRecord>(kind, { ...params, search }, "lookup", !props.disabled, publicOnly);
  const listed = uniqueRecords(pages.data?.pages.map(page => page.data.results) ?? []);
  const fromPage = listed.find(record => record.id === selectedId);
  const needsPin = selectedId > 0 && !fromPage;
  const selected = useSelectedLookup(kind, needsPin ? selectedId : 0, publicOnly);
  const resolved = fromPage ?? (!selected.isError ? selected.data : undefined);
  const records = uniqueRecords([listed, ...(resolved ? [[resolved]] : [])]);
  useEffect(() => {
    if (resolved) onResolved?.(resolved);
  }, [resolved, onResolved]);
  const loading = (!props.disabled && pages.isPending) || (needsPin && selected.isPending);
  return <div>
    {!props.disabled && <input aria-label={`${label} search`} type="search" maxLength={100} value={search}
      onChange={event => setSearch(event.target.value)} placeholder="Search options…" className="field-input mb-1" />}
    <select {...props} ref={ref} aria-label={props["aria-label"] ?? label} value={selectedId || 0}
      className={props.className ?? "field-input"} disabled={props.disabled || loading || pages.isError || selected.isError}
      onChange={event => {
        props.onChange?.(event);
        const record = records.find(row => row.id === Number(event.target.value));
        if (record) onSelect?.(record);
      }}>
      <option value={0}>{loading ? "Loading options…" : emptyLabel}</option>
      {records.map(record => <option key={record.id} value={record.id}>{record.name}</option>)}
    </select>
    {loading && <p role="status">Loading options…</p>}
    {(pages.isError || selected.isError) && <p role="alert">Unable to load options. <button type="button" onClick={() => { void pages.refetch(); if (selectedId > 0) void selected.refetch(); }}>Retry options</button></p>}
    {!loading && !pages.isError && !selected.isError && <>
      {selectedId > 0 && selected.data === null && <p role="alert">The selected record is unavailable with your current access.</p>}
      {!props.disabled && listed.length === 0 && <p role="status">No matching options.</p>}
      {!props.disabled && (pages.hasNextPage ? <button type="button" className="btn-ghost" disabled={pages.isFetchingNextPage}
        onClick={() => { void pages.fetchNextPage(); }} aria-label={`${label}: load more`}>{pages.isFetchingNextPage ? "Loading…" : "Load more options"}</button>
        : <p className="field-helper">No more matching options.</p>)}
    </>}
  </div>;
}
