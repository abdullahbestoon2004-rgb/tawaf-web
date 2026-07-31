import { useEffect } from "react";

// Keeps the page behind an overlay from scrolling.
//
// WHY THE ROOT ELEMENT AND NOT JUST body
//   styles/tawaf.css sets `overflow-x: clip` on html to stop one over-wide card
//   making every page pannable sideways on a phone. That has a side effect the
//   spec is explicit about: the viewport takes its scrolling behaviour from the
//   ROOT element, and only falls back to body while html's overflow is still
//   `visible`. html is no longer visible, so it — not body — is the scroll
//   container, and locking body alone did nothing at all. Every overlay in the
//   app scrolled the page behind it.
//
// The scrollbar-width compensation stays on body: that is where the page's own
// padding lives, so the layout underneath doesn't shift as the lock engages.
//
// Nesting is reference-counted rather than saved per caller. A drawer that
// opens a modal has two locks live at once, and the modal closing must not
// unlock the page behind the drawer that is still open.

let lockCount = 0;
let releaseLock: (() => void) | null = null;

function engageLock() {
  const { body, documentElement } = document;
  const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
  const previousHtmlOverflow = documentElement.style.overflow;
  const previousBodyOverflow = body.style.overflow;
  const previousBodyPaddingRight = body.style.paddingRight;
  // Captured because a browser that cannot keep a scroll offset on a
  // non-scrollable scrollport would otherwise drop the reader at the top of the
  // page when the overlay closes.
  const previousScrollTop = documentElement.scrollTop;

  documentElement.style.overflow = "hidden";
  body.style.overflow = "hidden";
  if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

  releaseLock = () => {
    documentElement.style.overflow = previousHtmlOverflow;
    body.style.overflow = previousBodyOverflow;
    body.style.paddingRight = previousBodyPaddingRight;
    if (documentElement.scrollTop !== previousScrollTop) {
      documentElement.scrollTop = previousScrollTop;
    }
  };
}

// `enabled` lets a caller that owns the overlay's open state call this
// unconditionally — a hook behind an `if` is a hook that sometimes does not run.
export function useScrollLock(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    lockCount += 1;
    if (lockCount === 1) engageLock();
    return () => {
      lockCount -= 1;
      if (lockCount === 0 && releaseLock) {
        releaseLock();
        releaseLock = null;
      }
    };
  }, [enabled]);
}
