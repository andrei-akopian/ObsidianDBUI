import { App, Menu, Modal, setIcon, TFile } from "obsidian";
import { FrontmatterManager } from "../../data/frontmatter-manager";
import { ColumnConfig, DBConfig, RowData } from "../../types";
import { CellRenderer } from "../cells/cell-renderer";

export class ConfirmDeleteModal extends Modal {
  private file: TFile;
  private onConfirm: () => Promise<void>;

  constructor(app: App, file: TFile, onConfirm: () => Promise<void>) {
    super(app);
    this.file = file;
    this.onConfirm = onConfirm;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("dbui-confirm-modal");

    contentEl.createEl("h3", { text: `Delete "${this.file.basename}"?` });
    contentEl.createEl("p", {
      text: "Are you sure you want to move this note to the trash? This action cannot be easily undone.",
    });

    const btnRow = contentEl.createDiv({ cls: "dbui-modal-button-row" });
    btnRow.style.display = "flex";
    btnRow.style.justifyContent = "flex-end";
    btnRow.style.gap = "8px";
    btnRow.style.marginTop = "16px";

    const cancelBtn = btnRow.createEl("button", { text: "Cancel" });
    cancelBtn.addEventListener("click", () => this.close());

    const deleteBtn = btnRow.createEl("button", {
      cls: "mod-warning",
      text: "Delete",
    });
    deleteBtn.addEventListener("click", async () => {
      this.close();
      await this.onConfirm();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

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

      // Data Cells (width governed by column/header)
      columns.forEach((column) => {
        const td = tr.createEl("td", { cls: "dbui-td" });
        const colWidth = column.width || 160;
        td.style.width = `${colWidth}px`;

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
          const leaf = app.workspace.getLeaf(false);
          await leaf.openFile(row.file);
        });
    });

    menu.addItem((item) => {
      item
        .setTitle("Open in new tab")
        .setIcon("file-plus")
        .onClick(async () => {
          const leaf = app.workspace.getLeaf("tab");
          await leaf.openFile(row.file);
        });
    });

    menu.addItem((item) => {
      item
        .setTitle("Open in split")
        .setIcon("split")
        .onClick(async () => {
          const leaf = app.workspace.getLeaf("split");
          await leaf.openFile(row.file);
        });
    });

    menu.addSeparator();

    menu.addItem((item) => {
      item
        .setTitle("Delete note")
        .setIcon("trash-2")
        .setWarning(true)
        .onClick(() => {
          new ConfirmDeleteModal(app, row.file, async () => {
            const ok = await frontmatterManager.deleteNote(row.file);
            if (ok && onDataUpdated) {
              onDataUpdated();
            }
          }).open();
        });
    });

    menu.showAtMouseEvent(evt);
  }
}
