import { positionPopover } from "../utils/dom-utils";

interface ActivePopoverEntry {
  el: HTMLElement;
  anchor: HTMLElement;
  close: () => void;
}

export class PopoverManager {
  private static activeStack: ActivePopoverEntry[] = [];

  /**
   * Check if any popover is currently open, optionally within a specific root element.
   */
  static hasActivePopover(rootEl?: HTMLElement): boolean {
    if (this.activeStack.length === 0) return false;
    if (!rootEl) return true;
    return this.activeStack.some((entry) => rootEl.contains(entry.anchor) || rootEl.contains(entry.el));
  }

  /**
   * Close and destroy all active popovers.
   */
  static closeAll(container?: HTMLElement): void {
    const list = [...this.activeStack];
    for (let i = list.length - 1; i >= 0; i--) {
      const entry = list[i];
      if (!container || container.contains(entry.anchor) || container.contains(entry.el)) {
        try {
          entry.close();
        } catch (e) {
          // Safe ignore
        }
      }
    }
  }

  /**
   * Create, position, and manage a new popover element with popout window and mobile support.
   */
  static createPopover(options: {
    anchor: HTMLElement;
    cls: string;
    onClose?: () => void;
    excludeEls?: (HTMLElement | null | undefined)[];
    offset?: number;
    allowNested?: boolean;
  }): {
    el: HTMLElement;
    close: () => void;
    reposition: () => void;
  } {
    const doc = options.anchor.ownerDocument || document;
    const win = doc.defaultView || window;

    if (!options.allowNested) {
      this.closeAll();
    }

    const popover = doc.body.createDiv({ cls: `dbui-popover ${options.cls}` });
    let isClosed = false;

    const close = () => {
      if (isClosed) return;
      isClosed = true;

      // Unbind event listeners
      doc.removeEventListener("pointerdown", onPointerDown, true);
      doc.removeEventListener("keydown", onKeyDown, true);
      win.removeEventListener("resize", onWindowResize);
      clearInterval(disconnectCheck);

      // Remove from active stack
      this.activeStack = this.activeStack.filter((e) => e.el !== popover);

      // Remove element from DOM
      if (popover.parentElement) {
        popover.remove();
      }

      // Trigger user callback
      if (options.onClose) {
        try {
          options.onClose();
        } catch (err) {
          console.error("[DBUI] Error in popover onClose:", err);
        }
      }
    };

    const onPointerDown = (evt: PointerEvent | MouseEvent) => {
      const target = evt.target as Node;
      if (popover.contains(target)) return;
      if (options.anchor && options.anchor.contains(target)) return;
      if (options.excludeEls) {
        for (const ex of options.excludeEls) {
          if (ex && ex.contains(target)) return;
        }
      }
      close();
    };

    const onKeyDown = (evt: KeyboardEvent) => {
      if (evt.key === "Escape") {
        // Only close the topmost popover in the stack
        const top = PopoverManager.activeStack[PopoverManager.activeStack.length - 1];
        if (top && top.el === popover) {
          evt.preventDefault();
          evt.stopImmediatePropagation();
          close();
        }
      }
    };

    const onWindowResize = () => {
      // On mobile or tablets, soft keyboard popup triggers window resize
      // If active focus is inside this popover, reposition instead of closing
      const activeEl = doc.activeElement as HTMLElement | null;
      if (activeEl && popover.contains(activeEl)) {
        reposition();
        return;
      }
      close();
    };

    doc.addEventListener("pointerdown", onPointerDown, true);
    doc.addEventListener("keydown", onKeyDown, true);
    win.addEventListener("resize", onWindowResize);

    // Anchor disconnect check with short grace period
    let disconnectedCount = 0;
    const disconnectCheck = win.setInterval(() => {
      if (options.anchor && !options.anchor.isConnected) {
        disconnectedCount++;
        // Give 2 ticks (400ms) for transient DOM re-attachments
        if (disconnectedCount >= 2) {
          close();
        }
      } else {
        disconnectedCount = 0;
      }
    }, 200);

    const reposition = () => {
      if (isClosed) return;
      positionPopover(popover, options.anchor, options.offset || 4);
    };

    reposition();

    this.activeStack.push({ el: popover, anchor: options.anchor, close });

    return {
      el: popover,
      close,
      reposition,
    };
  }
}
