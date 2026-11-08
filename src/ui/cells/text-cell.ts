import { ColumnConfig, RowData } from "../../types";

export class TextCell {
  static render(
    container: HTMLElement,
    row: RowData,
    column: ColumnConfig,
    onCommit: (newValue: any) => Promise<void>
  ): void {
    const rawVal = row.values[column.key];
    const isPrimitive =
      rawVal === undefined ||
      rawVal === null ||
      typeof rawVal === "string" ||
      typeof rawVal === "number" ||
      typeof rawVal === "boolean";

    const text = isPrimitive
      ? (rawVal !== undefined && rawVal !== null ? String(rawVal) : "")
      : (Array.isArray(rawVal) ? rawVal.join(", ") : JSON.stringify(rawVal));

    container.empty();
    const span = container.createSpan({
      cls: "dbui-cell-text",
      text: text || "",
    });

    if (!text) {
      span.addClass("dbui-cell-placeholder");
      span.setText("");
    }

    // Click to edit
    container.addEventListener("click", () => {
      // If already in edit mode or non-editable complex object, guard
      if (container.querySelector(".dbui-cell-input")) return;
      this.startEditing(container, text, rawVal, onCommit);
    });
  }

  static startEditing(
    container: HTMLElement,
    initialText: string,
    rawVal: any,
    onCommit: (newValue: any) => Promise<void>
  ): void {
    container.empty();

    const input = container.createEl("input", {
      type: "text",
      cls: "dbui-cell-input",
      value: initialText,
    });

    input.focus();
    input.select();

    let committed = false;
    const commit = async () => {
      if (committed) return;
      committed = true;
      const newVal = input.value.trim();
      const finalVal = newVal || null;

      // Only commit if value actually changed from initial value!
      const initialNormalized = (typeof rawVal === "string" ? rawVal.trim() : (rawVal !== null && rawVal !== undefined ? String(rawVal) : "")) || null;
      if (finalVal !== initialNormalized) {
        await onCommit(finalVal);
      } else {
        // Restore display without triggering frontmatter write
        container.empty();
        const span = container.createSpan({
          cls: "dbui-cell-text",
          text: initialText || "",
        });
        if (!initialText) span.addClass("dbui-cell-placeholder");
      }
    };

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") {
        input.blur();
      } else if (evt.key === "Escape") {
        committed = true;
        // Restore display without committing
        container.empty();
        const span = container.createSpan({ cls: "dbui-cell-text", text: initialText || "" });
        if (!initialText) span.addClass("dbui-cell-placeholder");
      }
    });
  }
}
