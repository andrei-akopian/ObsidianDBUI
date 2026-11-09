import { App } from "obsidian";
import { FrontmatterManager } from "../../data/frontmatter-manager";
import { ColumnConfig, DBConfig, RowData } from "../../types";
import { CheckboxCell } from "./checkbox-cell";
import { DateCell } from "./date-cell";
import { FileCell } from "./file-cell";
import { NumberCell } from "./number-cell";
import { StatusCell } from "./status-cell";
import { TagCell } from "./tag-cell";
import { TextCell } from "./text-cell";

export class CellRenderer {
  static renderCell(
    td: HTMLTableCellElement,
    row: RowData,
    column: ColumnConfig,
    config: DBConfig,
    app: App,
    frontmatterManager: FrontmatterManager,
    allVaultTags: string[],
    allRows: RowData[],
    onConfigChange: () => Promise<void>,
    onDataUpdated: () => void
  ): void {
    td.className = "dbui-td";
    if (column.wrap || config.settings.wrapCells) {
      td.addClass("is-wrapped");
    }

    const onCommit = async (newVal: any) => {
      row.values[column.key] = newVal;
      const success = await frontmatterManager.updateProperty(
        row.file,
        column.key,
        newVal,
        column.type
      );
      if (success) {
        onDataUpdated();
      }
    };

    switch (column.type) {
      case "file":
        FileCell.render(td, row, column, app, async (newName) => {
          const success = await frontmatterManager.updateProperty(
            row.file,
            "file.name",
            newName
          );
          if (success) {
            row.basename = newName;
            row.values["file.name"] = newName;
            onDataUpdated();
          }
        });
        break;

      case "checkbox":
        CheckboxCell.render(td, row, column, onCommit);
        break;

      case "number":
        NumberCell.render(td, row, column, onCommit);
        break;

      case "status":
        StatusCell.render(
          td,
          row,
          column,
          config.tagColors,
          config.statusOptions,
          allRows,
          onCommit,
          async (options) => {
            if (!config.statusOptions) config.statusOptions = {};
            config.statusOptions[column.key] = options;
            column.options = options;
            await onConfigChange();
            onDataUpdated();
          }
        );
        break;

      case "tag":
      case "multi-tag":
        TagCell.render(
          td,
          row,
          column,
          allVaultTags,
          config.tagColors,
          onCommit,
          async (newColors) => {
            config.tagColors = newColors;
            await onConfigChange();
          }
        );
        break;

      case "date":
      case "time":
        DateCell.render(td, row, column, onCommit);
        break;

      case "text":
      default:
        TextCell.render(td, row, column, onCommit);
        break;
    }
  }
}
