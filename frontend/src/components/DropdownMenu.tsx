import { useEffect, useRef, useState, type ReactNode } from "react";

interface DropdownMenuProps {
  trigger: (state: { open: boolean }) => ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  width?: number;
  placement?: "top" | "bottom";
  zIndex?: number;
}

export default function DropdownMenu({
  trigger,
  children,
  align = "right",
  width = 200,
  placement = "bottom",
  zIndex = 50,
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
      <div onClick={() => setOpen((o) => !o)}>{trigger({ open })}</div>

      {open && (
        <div
          role="menu"
          onClick={() => setOpen(false)}
          className="absolute overflow-hidden animate-fade-in"
          style={{
            [align]: 0,
            ...(placement === "top"
              ? { bottom: "calc(100% + 8px)" }
              : { top: "calc(100% + 6px)" }),
            width,
            zIndex,
            background: "#FFFFFF",
            border: "1px solid #F5D5E2",
            borderRadius: 14,
            boxShadow: "0 12px 30px rgba(199, 37, 94, 0.14), 0 4px 12px rgba(0, 0, 0, 0.05)",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
