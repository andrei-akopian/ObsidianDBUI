import { App, Menu, setIcon } from "obsidian";
import { FrontmatterManager } from "../../data/frontmatter-manager";
import { ColumnConfig, DBConfig, RowData } from "../../types";
import { CellRenderer } from "../cells/cell-renderer";

export class TableBody {
  static render(
    tbody: HTMLTableSectionElement,
    rows: RowData[],
    columns: ColumnConfig[],
    config: DBConfig,
    app: App,
    frontmatterManager: FrontmatterManager,
    allVaultTags: string[],
    quickSearch = "",
    onClearSearch?: () => void,
    onNewNote?: () => Promise<void>,
    onConfigChange?: () => Promise<void>,
    onDataUpdated?: () => void
  ): void {
    tbody.empty();

    if (rows.length === 0) {
      const trEmpty = tbody.createEl("tr", { cls: "dbui-empty-row" });
      const tdEmpty = trEmpty.createEl("td", {
        cls: "dbui-empty-td",
        colspan: columns.length + (config.settings.showRowNumbers ? 1 : 0) + 1,
      });
      const emptyWrap = tdEmpty.createDiv({ cls: "dbui-empty-state" });

      if (quickSearch && quickSearch.trim()) {
        emptyWrap.createSpan({
          cls: "dbui-empty-msg",
          text: `No notes matching "${quickSearch.trim()}".`,
        });
        if (onClearSearch) {
          const clearSearchBtn = emptyWrap.createDiv({
            cls: "dbui-btn dbui-empty-create-btn",
            text: "Clear search",
          });
          clearSearchBtn.addEventListener("click", () => {
            onClearSearch();
          });
        }
      } else if (config.filters && config.filters.length > 0) {
        emptyWrap.createSpan({
          cls: "dbui-empty-msg",
          text: "No notes match the active filters.",
        });
        if (onConfigChange && onDataUpdated) {
          const clearFiltersBtn = emptyWrap.createDiv({
            cls: "dbui-btn dbui-empty-create-btn",
            text: "Clear filters",
          });
          clearFiltersBtn.addEventListener("click", async () => {
            config.filters = [];
            await onConfigChange();
            onDataUpdated();
          });
        }
      } else {
        emptyWrap.createSpan({
          cls: "dbui-empty-msg",
          text: config.folder
            ? `No notes found in "${config.folder}".`
            : "No notes found in vault root.",
        });
        if (onNewNote) {
          const createFirstBtn = emptyWrap.createDiv({
            cls: "dbui-btn dbui-btn-primary dbui-empty-create-btn",
            text: "+ New Note",
          });
          createFirstBtn.addEventListener("click", async () => {
            await onNewNote();
          });
        }
      }
      return;
    }

    rows.forEach((row, rowIndex) => {
      const tr = tbody.createEl("tr", { cls: "dbui-row" });

      // Index Cell
      if (config.settings.showRowNumbers) {
        const tdIndex = tr.createEl("td", { cls: "dbui-td dbui-td-index" });
        tdIndex.createSpan({ text: String(rowIndex + 1) });

        // Context menu on index cell or row right click
        tdIndex.addEventListener("contextmenu", (evt) => {
          evt.preventDefault();
          if (onDataUpdated) {
            this.showRowContextMenu(evt, row, app, frontmatterManager, onDataUpdated);
          }
        });
      }

      tr.addEventListener("contextmenu", (evt) => {
        // Only trigger if not already handling input
        if ((evt.target as HTMLElement).tagName === "INPUT") return;
        evt.preventDefault();
        if (onDataUpdated) {
          this.showRowContextMenu(evt, row, app, frontmatterManager, onDataUpdated);
        }
      });

      // Data Cells
      columns.forEach((column) => {
        const td = tr.createEl("td");
        CellRenderer.renderCell(
          td,
          row,
          column,
          config,
          app,
          frontmatterManager,
          allVaultTags,
          onConfigChange || (async () => {}),
          onDataUpdated || (() => {})
        );
      });

      // Trailing empty cell under "+ Add property" header
      tr.createEl("td", { cls: "dbui-td dbui-td-spacer" });
    });

    // Bottom "+ New" row button
    const trNew = tbody.createEl("tr", { cls: "dbui-row dbui-row-new" });
    if (config.settings.showRowNumbers) {
      const tdNewIndex = trNew.createEl("td", { cls: "dbui-td dbui-td-index" });
      const plusIcon = tdNewIndex.createSpan({ cls: "dbui-new-row-plus" });
      setIcon(plusIcon, "plus");
    }

    const tdNewAction = trNew.createEl("td", {
      cls: "dbui-td dbui-td-new-action",
      colspan: columns.length + 1,
    });
    const newBtn = tdNewAction.createDiv({ cls: "dbui-new-row-btn" });
    newBtn.createSpan({ text: "+ New note" });

    trNew.addEventListener("click", async () => {
      if (onNewNote) {
        await onNewNote();
      }
    });
  }

  private static showRowContextMenu(
    evt: MouseEvent,
    row: RowData,
    app: App,
    frontmatterManager: FrontmatterManager,
    onDataUpdated: () => void
  ): void {
    const menu = new Menu();

    menu.addItem((item) => {
      item
        .setTitle("Open note")
        .setIcon("file-text")
        .onClick(async () => {
          await app.workspace.openLinkText(row.path, "", false);
        });
    });

    menu.addItem((item) => {
      item
        .setTitle("Open in new tab")
        .setIcon("file-plus")
        .onClick(async () => {
          await app.workspace.openLinkText(row.path, "", "tab");
        });
    });

    menu.addItem((item) => {
      item
        .setTitle("Open in split")
        .setIcon("split")
        .onClick(async () => {
          await app.workspace.openLinkText(row.path, "", "split");
        });
    });

    menu.addSeparator();

    menu.addItem((item) => {
      item
        .setTitle("Delete note")
        .setIcon("trash-2")
        .setWarning(true)
        .onClick(async () => {
          const ok = await frontmatterManager.deleteNote(row.file);
          if (ok) {
            onDataUpdated();
          }
        });
    });

    menu.showAtMouseEvent(evt);
  }
}
