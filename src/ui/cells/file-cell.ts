import { App, setIcon } from "obsidian";
import { ColumnConfig, RowData } from "../../types";

export class FileCell {
  static render(
    container: HTMLElement,
    row: RowData,
    column: ColumnConfig,
    app: App,
    onRename: (newName: string) => Promise<void>
  ): void {
    container.empty();
    const wrapper = container.createDiv({ cls: "dbui-file-cell" });

    const iconSpan = wrapper.createSpan({ cls: "dbui-file-icon" });
    setIcon(iconSpan, "file-text");

    const nameSpan = wrapper.createSpan({
      cls: "dbui-file-name",
      text: row.basename,
    });

    // Single click: open note
    nameSpan.addEventListener("click", async (evt) => {
      evt.stopPropagation();
      const inNewTab = evt.metaKey || evt.ctrlKey;
      await app.workspace.openLinkText(row.path, "", inNewTab ? "tab" : false);
    });

    // Double click: rename
    nameSpan.addEventListener("dblclick", (evt) => {
      evt.stopPropagation();
      this.startRenaming(wrapper, row.basename, onRename);
    });
  }

  static startRenaming(
    wrapper: HTMLElement,
    currentName: string,
    onRename: (newName: string) => Promise<void>
  ): void {
    wrapper.empty();
    const input = wrapper.createEl("input", {
      type: "text",
      cls: "dbui-cell-input dbui-rename-input",
      value: currentName,
    });

    input.focus();
    input.select();

    let committed = false;
    const commit = async () => {
      if (committed) return;
      committed = true;
      const raw = input.value.trim();
      if (raw && raw !== currentName) {
        await onRename(raw);
      }
    };

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", async (evt) => {
      if (evt.key === "Enter") {
        input.blur();
      } else if (evt.key === "Escape") {
        committed = true;
        wrapper.empty();
        const iconSpan = wrapper.createSpan({ cls: "dbui-file-icon" });
        setIcon(iconSpan, "file-text");
        wrapper.createSpan({ cls: "dbui-file-name", text: currentName });
      }
    });
  }
}
