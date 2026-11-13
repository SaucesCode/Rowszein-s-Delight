import { useEffect, type RefObject } from "react";

/**
 * Reveals each [data-reveal] element inside the container once, as it scrolls
 * into view. Elements are only held back after this runs and only when motion
 * is allowed, so without JavaScript or with reduced motion everything shows.
 */
export function useScrollReveal(containerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const targets = [...container.querySelectorAll<HTMLElement>("[data-reveal]")];
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.reveal = "in";
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    for (const target of targets) {
      const box = target.getBoundingClientRect();
      if (box.top < window.innerHeight && box.bottom > 0) continue;
      target.dataset.reveal = "waiting";
      observer.observe(target);
    }
    return () => observer.disconnect();
  }, [containerRef]);
}
