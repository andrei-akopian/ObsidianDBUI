import { toBool } from "../../data/value-processor";
import { ColumnConfig, RowData } from "../../types";

export class CheckboxCell {
  static render(
    container: HTMLElement,
    row: RowData,
    column: ColumnConfig,
    onCommit: (newValue: any) => Promise<void>
  ): void {
    const rawVal = row.values[column.key];
    const isChecked = toBool(rawVal);

    container.empty();
    const wrapper = container.createDiv({ cls: "dbui-checkbox-cell" });

    const checkbox = wrapper.createEl("input", {
      type: "checkbox",
      cls: "dbui-checkbox-input",
    });
    checkbox.checked = isChecked;

    checkbox.addEventListener("change", async (evt) => {
      evt.stopPropagation();
      await onCommit(checkbox.checked);
    });
  }
}
