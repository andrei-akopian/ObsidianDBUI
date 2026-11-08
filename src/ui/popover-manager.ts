import { positionPopover } from "../utils/dom-utils";

interface ActivePopoverEntry {
  el: HTMLElement;
  close: () => void;
}

export class PopoverManager {
  private static activeEntries: Set<ActivePopoverEntry> = new Set();
  private static globalListenersInitialized = false;

  private static initGlobalListeners(): void {
    if (this.globalListenersInitialized) return;
    this.globalListenersInitialized = true;

    // Close popovers if window loses focus
    window.addEventListener("blur", () => {
      this.closeAll();
    });

    // Close on navigation/tab switch shortcuts or back/forward
    window.addEventListener("popstate", () => {
      this.closeAll();
    });

    // Close on visibility change (tab/window switch)
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.closeAll();
      }
    });
  }

  /**
   * Close and destroy all active popovers.
   */
  static closeAll(): void {
    const entries = Array.from(this.activeEntries);
    this.activeEntries.clear();
    for (const entry of entries) {
      try {
        entry.close();
      } catch (e) {
        // Safe ignore
      }
    }
    // Safety cleanup: remove any lingering popover elements from document.body
    document.querySelectorAll(".dbui-popover").forEach((el) => el.remove());
  }

  /**
   * Create, position, and manage a new popover element.
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
    this.initGlobalListeners();

    if (!options.allowNested) {
      this.closeAll();
    }

    const popover = document.body.createDiv({ cls: `dbui-popover ${options.cls}` });

    let isClosed = false;

    const close = () => {
      if (isClosed) return;
      isClosed = true;

      // Unbind event listeners
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("pointerdown", onMouseDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("resize", onWindowResize);
      clearInterval(disconnectCheck);

      // Remove from active list
      for (const entry of Array.from(this.activeEntries)) {
        if (entry.el === popover) {
          this.activeEntries.delete(entry);
        }
      }

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

    const onMouseDown = (evt: MouseEvent) => {
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
        evt.preventDefault();
        evt.stopPropagation();
        close();
      }
    };

    const onWindowResize = () => {
      close();
    };

    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("pointerdown", onMouseDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", onWindowResize);

    const disconnectCheck = window.setInterval(() => {
      if (options.anchor && !options.anchor.isConnected) {
        close();
      }
    }, 200);

    const reposition = () => {
      if (isClosed) return;
      positionPopover(popover, options.anchor, options.offset || 4);
    };

    reposition();

    this.activeEntries.add({ el: popover, close });

    return {
      el: popover,
      close,
      reposition,
    };
  }
}
