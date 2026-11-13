import { useCallback, type RefObject } from "react";

const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

/**
 * Sends a copy of the tapped donut in an arc into the box, so the customer
 * sees where it went. Skipped entirely when reduced motion is requested.
 */
export function useFlyToBox(boxRef: RefObject<HTMLElement | null>) {
  return useCallback(
    (source: HTMLElement) => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      // Wait two frames so a box that appears with this first donut has been laid out.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const boxWindow = boxRef.current;
          // On the narrowest phones the box window is hidden; aim at the box itself.
          const box = boxWindow?.offsetWidth ? boxWindow : boxWindow?.parentElement;
          if (!box || typeof source.animate !== "function") return;
          const from = source.getBoundingClientRect();
          const to = box.getBoundingClientRect();
          if (!from.width || !to.width) return;

          const flyer = source.cloneNode(true) as HTMLElement;
          flyer.setAttribute("aria-hidden", "true");
          flyer.classList.add("shop-flyer");
          Object.assign(flyer.style, {
            left: `${from.left}px`,
            top: `${from.top}px`,
            width: `${from.width}px`,
            height: `${from.height}px`,
          });
          document.body.appendChild(flyer);

          const dx = to.left + to.width / 2 - (from.left + from.width / 2);
          const dy = to.top + to.height / 2 - (from.top + from.height / 2);
          const scale = Math.min(32 / from.width, 1);
          const flight = flyer.animate(
            [
              { transform: "translate(0, 0) scale(1) rotate(0deg)" },
              {
                transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 72}px) scale(${(1 + scale) / 1.6}) rotate(-60deg)`,
                offset: 0.5,
              },
              { transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotate(-140deg)` },
            ],
            { duration: 440, easing: EASE },
          );
          const land = () => {
            flyer.remove();
            box.animate([{ transform: "scale(1)" }, { transform: "scale(1.06)" }, { transform: "scale(1)" }], {
              duration: 200,
              easing: EASE,
            });
          };
          flight.onfinish = land;
          flight.oncancel = () => flyer.remove();
        }),
      );
    },
    [boxRef],
  );
}
