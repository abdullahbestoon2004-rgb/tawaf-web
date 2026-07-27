import { useEffect } from "react";

// Keeps the page behind an overlay from scrolling. Compensates for the removed
// scrollbar width so the layout underneath doesn't shift as the lock engages.
// Nesting is safe: each caller restores the value it captured on mount.
export function useScrollLock() {
  useEffect(() => {
    const { body, documentElement } = document;
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, []);
}
