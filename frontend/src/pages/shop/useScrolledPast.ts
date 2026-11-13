import { useEffect, useRef, useState } from "react";

/** True while the referenced element is scrolled out of view above the screen. */
export function useScrolledPast<T extends Element>() {
  const ref = useRef<T>(null);
  const [past, setPast] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setPast(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, past] as const;
}
