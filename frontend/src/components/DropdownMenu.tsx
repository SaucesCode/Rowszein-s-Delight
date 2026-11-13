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
          onClick={() => setOpen(false)}
          className="menu-surface absolute animate-fade-in"
          style={{
            [align]: 0,
            ...(placement === "top"
              ? { bottom: "calc(100% + 8px)" }
              : { top: "calc(100% + 6px)" }),
            width,
            zIndex,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
