import { useEffect, useRef, useState, type ReactNode } from "react";

interface DropdownMenuProps {
  trigger: (state: { open: boolean }) => ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  width?: number;
}

export default function DropdownMenu({
  trigger,
  children,
  align = "right",
  width = 200,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setOpen(false);
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
    <div className="relative inline-block" ref={containerRef}>
      <div onClick={() => setOpen(o => !o)}>{trigger({ open })}</div>

      {open && (
        <div
          role="menu"
          onClick={() => setOpen(false)}
          className="absolute top-[calc(100%+6px)] z-30 overflow-hidden animate-fade-in"
          style={{
            [align]: 0,
            width,
            background: "#FFFDFB",
            border: "1px solid #E8E6E1",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(107, 66, 38, 0.14)",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
