import { useEffect, useRef, useState } from "react";
import { Download, ChevronDown, FileText, Table2 } from "lucide-react";

interface ExportMenuProps {
  onExportCSV: () => void;
  onExportPDF: () => void;
  exporting?: boolean;
  label?: string;
}

export default function ExportMenu({ onExportCSV, onExportPDF, exporting, label = "Export" }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={exporting}
        className="btn-secondary"
        style={{ fontSize: 13, padding: "8px 12px" }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download size={15} strokeWidth={2} aria-hidden="true" />
        {exporting ? "Exporting…" : label}
        <ChevronDown size={13} strokeWidth={2} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-30 w-44 overflow-hidden animate-fade-in"
          style={{
            background: "#FFFDFB",
            border: "1px solid #E8E6E1",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(107, 66, 38, 0.14)",
          }}
        >
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onExportCSV();
            }}
            className="flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 transition-colors hover:bg-[#FFF8F0]"
            style={{ fontSize: 13, color: "#6B4226" }}
          >
            <Table2 size={15} strokeWidth={2} style={{ color: "#9B6644" }} aria-hidden="true" />
            Export as CSV
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onExportPDF();
            }}
            className="flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 transition-colors hover:bg-[#FFF8F0]"
            style={{ fontSize: 13, color: "#6B4226", borderTop: "1px solid #F5EDE0" }}
          >
            <FileText size={15} strokeWidth={2} style={{ color: "#9B6644" }} aria-hidden="true" />
            Export as PDF
          </button>
        </div>
      )}
    </div>
  );
}