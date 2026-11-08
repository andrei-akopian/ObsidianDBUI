/**
 * Position a popover element relative to an anchor element, clamping it within window bounds.
 */
export function positionPopover(popover: HTMLElement, anchor: HTMLElement, offset = 4): void {
  if (!anchor) return;

  const winWidth = window.innerWidth;
  const winHeight = window.innerHeight;

  // Guarantee fixed positioning before measuring bounds
  popover.style.position = "fixed";
  popover.style.zIndex = "9999";

  // If anchor is disconnected, do not reposition to (0, 0)
  if (!anchor.isConnected) {
    if (popover.style.top && popover.style.left) return;
  }

  const anchorRect = anchor.getBoundingClientRect();
  if (
    anchorRect.width === 0 &&
    anchorRect.height === 0 &&
    anchorRect.top === 0 &&
    anchorRect.left === 0
  ) {
    if (popover.style.top && popover.style.left) return;
    // Default fallback: place near top-center of window
    popover.style.left = `${Math.round(Math.max(10, (winWidth - 220) / 2))}px`;
    popover.style.top = "60px";
    return;
  }

  const popoverRect = popover.getBoundingClientRect();

  // Horizontal position:
  // If placing left-aligned overflows window, align with right edge of anchor
  let left = anchorRect.left;
  if (left + popoverRect.width > winWidth - 10) {
    left = anchorRect.right - popoverRect.width;
  }
  // Clamp inside right edge
  if (left + popoverRect.width > winWidth - 10) {
    left = winWidth - popoverRect.width - 10;
  }
  // Clamp inside left edge
  left = Math.max(10, left);

  // Vertical position: prefer below anchor, flip to above if not enough space
  let top = anchorRect.bottom + offset;
  if (top + popoverRect.height > winHeight - 10) {
    const spaceAbove = anchorRect.top - offset;
    if (spaceAbove >= popoverRect.height || spaceAbove > winHeight - anchorRect.bottom) {
      top = Math.max(10, anchorRect.top - popoverRect.height - offset);
    }
  }
  top = Math.max(10, Math.min(top, winHeight - popoverRect.height - 10));

  popover.style.left = `${Math.round(left)}px`;
  popover.style.top = `${Math.round(top)}px`;
}

/**
 * Register an outside click handler to close a popover.
 * Returns a cleanup function that removes listeners and ensures the popover element is removed.
 */
export function handleOutsideClick(
  popoverEl: HTMLElement,
  onClose: () => void,
  excludeEls: (HTMLElement | null | undefined)[] = []
): () => void {
  let isClosed = false;

  const doClose = () => {
    if (isClosed) return;
    isClosed = true;
    document.removeEventListener("mousedown", handler, true);
    document.removeEventListener("keydown", keyHandler, true);
    if (popoverEl.parentElement) {
      popoverEl.remove();
    }
    onClose();
  };

  const handler = (evt: MouseEvent) => {
    const target = evt.target as Node;
    if (popoverEl.contains(target)) return;
    for (const el of excludeEls) {
      if (el && el.contains(target)) return;
    }
    doClose();
  };

  const keyHandler = (evt: KeyboardEvent) => {
    if (evt.key === "Escape") {
      evt.preventDefault();
      evt.stopPropagation();
      doClose();
    }
  };

  document.addEventListener("mousedown", handler, true);
  document.addEventListener("keydown", keyHandler, true);

  return () => {
    doClose();
  };
}
