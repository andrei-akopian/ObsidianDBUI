import { App, setIcon } from "obsidian";
import { DiscoveredProperty } from "../../data/vault-scanner";
import { DBConfig } from "../../types";
import { ColumnsPopover } from "./columns-popover";
import { FilterPopover } from "./filter-popover";
import { FolderSuggestModal } from "./folder-suggest-modal";
import { SortPopover } from "./sort-popover";

export class TableToolbar {
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

    // Source Folder Selector Dropdown Button
    const folderBtn = leftGroup.createDiv({ cls: "dbui-toolbar-btn dbui-folder-btn" });
    const folderIcon = folderBtn.createSpan({ cls: "dbui-btn-icon" });
    setIcon(folderIcon, "folder");
    const folderLabel = folderBtn.createSpan({
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

    // Filter button with badge
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

    // Sort button with badge
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

    // Properties button
    const propsBtn = leftGroup.createDiv({ cls: "dbui-toolbar-btn dbui-props-btn" });
    const propsIcon = propsBtn.createSpan({ cls: "dbui-btn-icon" });
    setIcon(propsIcon, "sliders-horizontal");
    propsBtn.createSpan({ cls: "dbui-btn-label", text: "Properties" });
    propsBtn.addEventListener("click", () => {
      ColumnsPopover.open(propsBtn, config, discoveredProps, onConfigChange, onDataUpdated);
    });

    // Right toolbar section
    const rightGroup = container.createDiv({ cls: "dbui-toolbar-group dbui-toolbar-right" });

    // Quick search input
    const searchWrap = rightGroup.createDiv({ cls: "dbui-search-wrap" });
    const searchIcon = searchWrap.createSpan({ cls: "dbui-search-icon" });
    setIcon(searchIcon, "search");
    const searchInput = searchWrap.createEl("input", {
      type: "text",
      cls: "dbui-search-input",
      placeholder: "Search...",
    });
    searchInput.addEventListener("input", () => {
      onSearch(searchInput.value);
    });

    // Wordwrap toggle button
    const wrapBtn = rightGroup.createDiv({
      cls: `dbui-toolbar-btn dbui-wrap-btn dbui-icon-only-btn ${config.settings.wrapCells ? "is-active" : ""}`,
    });
    wrapBtn.setAttribute("title", config.settings.wrapCells ? "Disable wrap" : "Enable wrap");
    const wrapIcon = wrapBtn.createSpan({ cls: "dbui-btn-icon" });
    setIcon(wrapIcon, "wrap-text");
    wrapBtn.addEventListener("click", async () => {
      config.settings.wrapCells = !config.settings.wrapCells;
      await onConfigChange();
      onDataUpdated();
    });

    // Row density toggle
    const densityBtn = rightGroup.createDiv({
      cls: `dbui-toolbar-btn dbui-density-btn dbui-icon-only-btn ${
        config.settings.rowDensity === "compact" ? "is-active" : ""
      }`,
    });
    densityBtn.setAttribute("title", "Toggle density (Compact / Comfortable)");
    const densityIcon = densityBtn.createSpan({ cls: "dbui-btn-icon" });
    setIcon(densityIcon, "rows-3");
    densityBtn.addEventListener("click", async () => {
      config.settings.rowDensity =
        config.settings.rowDensity === "compact" ? "comfortable" : "compact";
      await onConfigChange();
      onDataUpdated();
    });

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

    // Update wrap button
    const wrapBtn = container.querySelector(".dbui-wrap-btn") as HTMLElement;
    if (wrapBtn) {
      wrapBtn.toggleClass("is-active", Boolean(config.settings.wrapCells));
      wrapBtn.setAttribute("title", config.settings.wrapCells ? "Disable wrap" : "Enable wrap");
    }

    // Update density button
    const densityBtn = container.querySelector(".dbui-density-btn") as HTMLElement;
    if (densityBtn) {
      densityBtn.toggleClass("is-active", config.settings.rowDensity === "compact");
    }
  }
}
