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
      tr.setAttribute("data-path", row.path);

      // Index Cell
      if (config.settings.showRowNumbers) {
        const tdIndex = tr.createEl("td", { cls: "dbui-td dbui-td-index" });
        tdIndex.createSpan({ text: String(rowIndex + 1) });

        // Context menu on index cell or row right click
        tdIndex.addEventListener("contextmenu", (evt) => {
          evt.preventDefault();
          this.showRowContextMenu(evt, row, app, frontmatterManager, onNewNote, onDataUpdated);
        });
      }

      tr.addEventListener("contextmenu", (evt) => {
        // Only trigger if not already handling input
        if ((evt.target as HTMLElement).tagName === "INPUT") return;
        evt.preventDefault();
        this.showRowContextMenu(evt, row, app, frontmatterManager, onNewNote, onDataUpdated);
      });

      // Data Cells with minimum and ideal width
      columns.forEach((column) => {
        const td = tr.createEl("td", { cls: "dbui-td" });
        const colWidth = column.width || 160;
        td.style.width = `${colWidth}px`;
        td.style.minWidth = `${colWidth}px`;

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
    const totalCols = columns.length + (config.settings.showRowNumbers ? 1 : 0) + 1;

    const tdNewAction = trNew.createEl("td", {
      cls: "dbui-td dbui-td-new-action",
      attr: { colspan: String(totalCols) },
    });
    tdNewAction.colSpan = totalCols;

    const newBtn = tdNewAction.createDiv({ cls: "dbui-new-row-btn" });
    const plusIcon = newBtn.createSpan({ cls: "dbui-new-row-plus" });
    setIcon(plusIcon, "plus");
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
    onNewNote?: () => Promise<void>,
    onDataUpdated?: () => void
  ): void {
    const menu = new Menu();

    menu.addItem((item) => {
      item
        .setTitle("New note")
        .setIcon("plus")
        .onClick(async () => {
          if (onNewNote) {
            await onNewNote();
          }
        });
    });

    menu.addSeparator();

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
