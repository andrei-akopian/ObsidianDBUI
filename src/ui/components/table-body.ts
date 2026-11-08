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
    onNewNote?: () => Promise<void>,
    onConfigChange?: () => Promise<void>,
    onDataUpdated?: () => void
  ): void {
    tbody.empty();

    if (rows.length === 0) {
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

      // Data Cells with strict min-width and max-width to keep wide tables structured
      columns.forEach((column) => {
        const td = tr.createEl("td", { cls: "dbui-td" });
        const colWidth = column.width || 160;
        td.style.width = `${colWidth}px`;
        td.style.minWidth = `${colWidth}px`;
        td.style.maxWidth = `${colWidth}px`;

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

      // Trailing empty cell under "+ Add property" sticky header
      tr.createEl("td", { cls: "dbui-td dbui-td-spacer" });
    });

    // Bottom "+ New note" row button spanning full table width
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
    if (!config.settings.showRowNumbers) {
      const plusIcon = newBtn.createSpan({ cls: "dbui-new-row-plus" });
      setIcon(plusIcon, "plus");
    }
    newBtn.createSpan({ text: "New note" });

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
