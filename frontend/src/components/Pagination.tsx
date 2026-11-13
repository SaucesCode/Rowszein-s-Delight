import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav className="mt-6 flex items-center justify-between gap-3" aria-label="Pagination">
      <p className="text-[length:var(--text-label)] text-[color:var(--color-ink-muted)]" aria-live="polite" aria-atomic="true">
        Page <span className="num font-semibold text-[color:var(--color-ink)]">{page}</span> of{" "}
        <span className="num font-semibold text-[color:var(--color-ink)]">{totalPages}</span>
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(page - 1, 1))}
          disabled={page === 1}
          className="btn-secondary"
        >
          <ChevronLeft size={18} aria-hidden="true" />
          Previous
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(page + 1, totalPages))}
          disabled={page === totalPages}
          className="btn-secondary"
        >
          Next
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
