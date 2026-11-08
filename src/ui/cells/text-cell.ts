import { ColumnConfig, RowData } from "../../types";

export class TextCell {
  static render(
    container: HTMLElement,
    row: RowData,
    column: ColumnConfig,
    onCommit: (newValue: any) => Promise<void>
  ): void {
    const rawVal = row.values[column.key];
    const text = rawVal !== undefined && rawVal !== null ? String(rawVal) : "";

    container.empty();
    const span = container.createSpan({
      cls: "dbui-cell-text",
      text: text || "",
    });

    if (!text) {
      span.addClass("dbui-cell-placeholder");
      span.setText("");
    }

    // Click or double click to edit
    container.addEventListener("click", (evt) => {
      // If already in edit mode, return
      if (container.querySelector(".dbui-cell-input")) return;
      this.startEditing(container, text, onCommit);
    });
  }

  static startEditing(
    container: HTMLElement,
    initialVal: string,
    onCommit: (newValue: any) => Promise<void>
  ): void {
    const rect = container.getBoundingClientRect();
    container.empty();

    const input = container.createEl("input", {
      type: "text",
      cls: "dbui-cell-input",
      value: initialVal,
    });

    input.focus();
    input.select();

    let committed = false;
    const commit = async () => {
      if (committed) return;
      committed = true;
      const newVal = input.value.trim();
      await onCommit(newVal || null);
    };

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") {
        input.blur();
      } else if (evt.key === "Escape") {
        committed = true;
        // Restore display
        container.empty();
        container.createSpan({ cls: "dbui-cell-text", text: initialVal });
      }
    });
  }
}
