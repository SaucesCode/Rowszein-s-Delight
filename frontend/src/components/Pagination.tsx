import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div
      className="flex items-center justify-between gap-3 mt-4 px-1"
      role="navigation"
      aria-label="Pagination"
    >
      {/* Left — page info */}
      <p
        className="font-body"
        style={{ fontSize: 13, color: "#9B6644" }}
        aria-live="polite"
        aria-atomic="true"
      >
        Page{" "}
        <span className="font-semibold" style={{ color: "#6B4226" }}>
          {page}
        </span>{" "}
        of{" "}
        <span className="font-semibold" style={{ color: "#6B4226" }}>
          {totalPages}
        </span>
      </p>

      {/* Right — controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(Math.max(page - 1, 1))}
          disabled={page === 1}
          className="flex items-center gap-1 btn-ghost"
          style={{ padding: "5px 10px", fontSize: 13 }}
          aria-label="Previous page"
        >
          <ChevronLeft size={14} aria-hidden="true" />
          Previous
        </button>

        <button
          onClick={() => onPageChange(Math.min(page + 1, totalPages))}
          disabled={page === totalPages}
          className="flex items-center gap-1 btn-ghost"
          style={{ padding: "5px 10px", fontSize: 13 }}
          aria-label="Next page"
        >
          Next
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
