import { App, setIcon } from "obsidian";
import { DiscoveredProperty } from "../../data/vault-scanner";
import { DBConfig } from "../../types";
import { ColumnsPopover } from "./columns-popover";
import { FilterPopover } from "./filter-popover";
import { FolderSuggestModal } from "./folder-suggest-modal";
import { SortPopover } from "./sort-popover";

export class TableToolbar {
  private static searchInputEl: HTMLInputElement | null = null;

  static focusSearch(container?: HTMLElement): void {
    if (container) {
      const input = container.querySelector(".dbui-search-input") as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
        return;
      }
    }
    if (this.searchInputEl && this.searchInputEl.isConnected) {
      this.searchInputEl.focus();
      this.searchInputEl.select();
    }
  }

  static render(
    container: HTMLElement,
    app: App,
    config: DBConfig,
    discoveredProps: DiscoveredProperty[],
    onSearch: (query: string) => void,
    onFolderSelect: (folderPath: string) => Promise<void>,
    onNewNote: () => Promise<void>,
    onConfigChange: () => Promise<void>,
    onDataUpdated: () => void
  ): void {
    container.empty();
    container.className = "dbui-toolbar";

    // Left toolbar section
    const leftGroup = container.createDiv({ cls: "dbui-toolbar-group dbui-toolbar-left" });

    // 1. Source Folder Selector Dropdown Button
    const folderBtn = leftGroup.createDiv({ cls: "dbui-toolbar-btn dbui-folder-btn" });
    const folderIcon = folderBtn.createSpan({ cls: "dbui-btn-icon" });
    setIcon(folderIcon, "folder");
    folderBtn.createSpan({
      cls: "dbui-btn-label",
      text: config.folder ? config.folder : "/ (Root)",
    });
    folderBtn.createSpan({ cls: "dbui-btn-caret", text: "▾" });
    folderBtn.setAttribute("title", "Select source folder");

    folderBtn.addEventListener("click", () => {
      new FolderSuggestModal(app, async (selectedPath) => {
        await onFolderSelect(selectedPath);
      }).open();
    });

    // 2. Search Input (with '/' shortcut hint, highlight-on-click, and 'x' clear button)
    const searchWrap = leftGroup.createDiv({ cls: "dbui-search-wrap dbui-search-left" });
    const searchIcon = searchWrap.createSpan({ cls: "dbui-search-icon" });
    setIcon(searchIcon, "search");

    const searchInput = searchWrap.createEl("input", {
      type: "text",
      cls: "dbui-search-input",
      placeholder: "Search... (/)",
    });
    this.searchInputEl = searchInput;

    const clearBtn = searchWrap.createSpan({ cls: "dbui-search-clear" });
    setIcon(clearBtn, "x");
    clearBtn.style.display = "none";
    clearBtn.setAttribute("title", "Clear search");

    const updateClearBtn = () => {
      const hasVal = Boolean(searchInput.value && searchInput.value.length > 0);
      clearBtn.style.display = hasVal ? "flex" : "none";
      searchWrap.toggleClass("has-query", hasVal);
    };

    clearBtn.addEventListener("click", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      searchInput.value = "";
      updateClearBtn();
      onSearch("");
      searchInput.focus();
    });

    searchInput.addEventListener("input", () => {
      updateClearBtn();
      onSearch(searchInput.value);
    });

    // Highlight existing text on click and focus
    searchInput.addEventListener("click", () => {
      if (searchInput.value) {
        searchInput.select();
      }
    });

    searchInput.addEventListener("focus", () => {
      if (searchInput.value) {
        searchInput.select();
      }
    });

    // 3. Filter button with badge
    const filterBtn = leftGroup.createDiv({
      cls: `dbui-toolbar-btn dbui-filter-btn ${config.filters.length > 0 ? "is-active" : ""}`,
    });
    const filterIcon = filterBtn.createSpan({ cls: "dbui-btn-icon" });
    setIcon(filterIcon, "filter");
    filterBtn.createSpan({ cls: "dbui-btn-label", text: "Filter" });
    if (config.filters.length > 0) {
      filterBtn.createSpan({ cls: "dbui-badge", text: String(config.filters.length) });
    }
    filterBtn.addEventListener("click", () => {
      FilterPopover.open(
        filterBtn,
        config,
        config.columns,
        onConfigChange,
        onDataUpdated
      );
    });

    // 4. Sort button with badge
    const sortBtn = leftGroup.createDiv({
      cls: `dbui-toolbar-btn dbui-sort-btn ${config.sort.length > 0 ? "is-active" : ""}`,
    });
    const sortIcon = sortBtn.createSpan({ cls: "dbui-btn-icon" });
    setIcon(sortIcon, "arrow-up-down");
    sortBtn.createSpan({ cls: "dbui-btn-label", text: "Sort" });
    if (config.sort.length > 0) {
      sortBtn.createSpan({ cls: "dbui-badge", text: String(config.sort.length) });
    }
    sortBtn.addEventListener("click", () => {
      SortPopover.open(
        sortBtn,
        config,
        config.columns,
        onConfigChange,
        onDataUpdated
      );
    });

    // 5. Properties button
    const propsBtn = leftGroup.createDiv({ cls: "dbui-toolbar-btn dbui-props-btn" });
    const propsIcon = propsBtn.createSpan({ cls: "dbui-btn-icon" });
    setIcon(propsIcon, "sliders-horizontal");
    propsBtn.createSpan({ cls: "dbui-btn-label", text: "Properties" });
    propsBtn.addEventListener("click", () => {
      ColumnsPopover.open(propsBtn, config, discoveredProps, onConfigChange, onDataUpdated);
    });

    // Right toolbar section (clean: only the primary "+ New" button)
    const rightGroup = container.createDiv({ cls: "dbui-toolbar-group dbui-toolbar-right" });

    // Primary "+ New" Note button
    const newNoteBtn = rightGroup.createDiv({ cls: "dbui-toolbar-btn dbui-btn-primary" });
    const newIcon = newNoteBtn.createSpan({ cls: "dbui-btn-icon" });
    setIcon(newIcon, "plus");
    newNoteBtn.createSpan({ cls: "dbui-btn-label", text: "New" });
    newNoteBtn.addEventListener("click", async () => {
      await onNewNote();
    });
  }

  static updateBadges(container: HTMLElement, config: DBConfig): void {
    // Update folder label
    const folderLabel = container.querySelector(".dbui-folder-btn .dbui-btn-label");
    if (folderLabel) {
      folderLabel.setText(config.folder ? config.folder : "/ (Root)");
    }

    // Update filter badge
    const filterBtn = container.querySelector(".dbui-filter-btn") as HTMLElement;
    if (filterBtn) {
      filterBtn.toggleClass("is-active", config.filters.length > 0);
      let badge = filterBtn.querySelector(".dbui-badge") as HTMLElement;
      if (config.filters.length > 0) {
        if (!badge) badge = filterBtn.createSpan({ cls: "dbui-badge" });
        badge.setText(String(config.filters.length));
      } else if (badge) {
        badge.remove();
      }
    }

    // Update sort badge
    const sortBtn = container.querySelector(".dbui-sort-btn") as HTMLElement;
    if (sortBtn) {
      sortBtn.toggleClass("is-active", config.sort.length > 0);
      let badge = sortBtn.querySelector(".dbui-badge") as HTMLElement;
      if (config.sort.length > 0) {
        if (!badge) badge = sortBtn.createSpan({ cls: "dbui-badge" });
        badge.setText(String(config.sort.length));
      } else if (badge) {
        badge.remove();
      }
    }
  }
}
