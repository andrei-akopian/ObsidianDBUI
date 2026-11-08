import { App, Notice } from "obsidian";
import { FrontmatterManager } from "../../data/frontmatter-manager";
import { ColumnConfig, DataType, DateFormat, DBConfig, NumberFormat, RowData, StatusOption } from "../../types";
import { PopoverManager } from "../popover-manager";
import { checkTypeCompatibility, TypeWarningModal } from "./type-warning-modal";

export class ColumnMenuPopover {
  static open(
    anchor: HTMLElement,
    column: ColumnConfig,
    config: DBConfig,
    rows: RowData[],
    app: App,
    frontmatterManager: FrontmatterManager,
    onConfigChange: () => Promise<void>,
    onDataUpdated: () => void
  ): void {
    const { el: popover, close, reposition } = PopoverManager.createPopover({
      anchor,
      cls: "dbui-column-menu-popover",
    });

    // 1. Column Name Editor
    const nameSection = popover.createDiv({ cls: "dbui-menu-section" });
    nameSection.createDiv({ cls: "dbui-menu-label", text: "Property name" });
    const nameInput = nameSection.createEl("input", {
      type: "text",
      cls: "dbui-menu-input",
      value: column.name,
    });

    nameInput.addEventListener("change", async () => {
      const newName = nameInput.value.trim();
      if (newName && newName !== column.name) {
        column.name = newName;
        await onConfigChange();
        onDataUpdated();
      }
    });

    // 2. Data Type Selector
    const typeSection = popover.createDiv({ cls: "dbui-menu-section" });
    typeSection.createDiv({ cls: "dbui-menu-label", text: "Property type" });
    const typeSelect = typeSection.createEl("select", { cls: "dbui-menu-select" });

    const types: { value: DataType; label: string }[] = [
      { value: "text", label: "Text" },
      { value: "number", label: "Number" },
      { value: "status", label: "Status (Dropdown)" },
      { value: "tag", label: "Tag (Single)" },
      { value: "multi-tag", label: "Multi-tag (List)" },
      { value: "date", label: "Date" },
      { value: "time", label: "Date & Time" },
      { value: "checkbox", label: "Checkbox" },
    ];

    if (column.key === "file.name") {
      types.unshift({ value: "file", label: "Note Title" });
    }

    for (const t of types) {
      const opt = typeSelect.createEl("option", { value: t.value, text: t.label });
      if (column.type === t.value) {
        opt.selected = true;
      }
    }

    const applyNewType = async (newType: DataType) => {
      column.type = newType;
      if (column.type === "number" && !column.numberFormat) {
        column.numberFormat = "plain";
        column.numberMax = 100;
      }
      if ((column.type === "date" || column.type === "time") && !column.dateFormat) {
        column.dateFormat = "relative";
      }
      await onConfigChange();
      renderDynamicOptions();
      reposition();
      onDataUpdated();
    };

    typeSelect.addEventListener("change", async () => {
      const oldType = column.type;
      const targetType = typeSelect.value as DataType;
      if (oldType === targetType) return;

      const check = checkTypeCompatibility(oldType, targetType, column.key, rows);

      if (check.incompatible) {
        // Revert select back to current type
        typeSelect.value = oldType;
        close();

        // Show safety warning modal
        new TypeWarningModal(
          app,
          column.name,
          oldType,
          targetType,
          check,
          async () => {
            // User confirmed
            await applyNewType(targetType);
          },
          () => {
            // User cancelled
          }
        ).open();
      } else {
        await applyNewType(targetType);
      }
    });

    // Container for format-specific options (number progress, date formats)
    const dynamicSection = popover.createDiv({ cls: "dbui-menu-section dbui-dynamic-section" });

    const renderDynamicOptions = () => {
      dynamicSection.empty();

      if (column.type === "number") {
        dynamicSection.createDiv({ cls: "dbui-menu-label", text: "Number format" });
        const formatSelect = dynamicSection.createEl("select", { cls: "dbui-menu-select" });

        const formats: { value: NumberFormat; label: string }[] = [
          { value: "plain", label: "Plain number" },
          { value: "progress-bar", label: "Progress bar" },
          { value: "progress-circle", label: "Progress circle" },
        ];

        for (const f of formats) {
          const opt = formatSelect.createEl("option", { value: f.value, text: f.label });
          if ((column.numberFormat || "plain") === f.value) opt.selected = true;
        }

        formatSelect.addEventListener("change", async () => {
          column.numberFormat = formatSelect.value as NumberFormat;
          await onConfigChange();
          renderDynamicOptions();
          reposition();
          onDataUpdated();
        });

        if (column.numberFormat === "progress-bar" || column.numberFormat === "progress-circle") {
          dynamicSection.createDiv({ cls: "dbui-menu-label", text: "Maximum value (for 100%)" });
          const maxInput = dynamicSection.createEl("input", {
            type: "number",
            cls: "dbui-menu-input",
            value: String(column.numberMax || 100),
          });
          maxInput.addEventListener("change", async () => {
            const m = Number(maxInput.value);
            column.numberMax = isNaN(m) || m <= 0 ? 100 : m;
            await onConfigChange();
            onDataUpdated();
          });
        }
      } else if (column.type === "date" || column.type === "time") {
        dynamicSection.createDiv({ cls: "dbui-menu-label", text: "Date display format" });
        const dateSelect = dynamicSection.createEl("select", { cls: "dbui-menu-select" });

        const dateFormats: { value: DateFormat; label: string }[] = [
          { value: "relative", label: "Relative (e.g. In 3 days / Today)" },
          { value: "absolute", label: "Absolute (e.g. 2026-11-08)" },
          { value: "both", label: "Both (e.g. 2026-11-08 (Today))" },
        ];

        for (const df of dateFormats) {
          const opt = dateSelect.createEl("option", { value: df.value, text: df.label });
          if ((column.dateFormat || "relative") === df.value) opt.selected = true;
        }

        dateSelect.addEventListener("change", async () => {
          column.dateFormat = dateSelect.value as DateFormat;
          await onConfigChange();
          onDataUpdated();
        });
      }
    };

    renderDynamicOptions();

    // 3. Actions Divider
    popover.createDiv({ cls: "dbui-menu-divider" });

    // Word Wrap toggle row
    const wrapItem = popover.createDiv({ cls: "dbui-menu-toggle-row" });
    wrapItem.createSpan({ cls: "dbui-menu-toggle-label", text: "Wrap text in cells" });
    const wrapToggle = wrapItem.createEl("input", {
      type: "checkbox",
      cls: "dbui-toggle-checkbox",
    });
    wrapToggle.checked = Boolean(column.wrap);
    const toggleWrap = async () => {
      column.wrap = wrapToggle.checked;
      await onConfigChange();
      onDataUpdated();
    };
    wrapToggle.addEventListener("change", (e) => {
      e.stopPropagation();
      toggleWrap();
    });
    wrapItem.addEventListener("click", (e) => {
      if (e.target === wrapToggle) return;
      wrapToggle.checked = !wrapToggle.checked;
      toggleWrap();
    });

    // Datatype-aware sort items
    const getSortMenuLabels = (type: DataType, options?: StatusOption[]) => {
      switch (type) {
        case "number":
          return { asc: "Sort 0 → 9 (Smallest first)", desc: "Sort 9 → 0 (Largest first)" };
        case "date":
        case "time":
          return { asc: "Sort oldest first", desc: "Sort newest first" };
        case "checkbox":
          return { asc: "Sort unchecked first", desc: "Sort checked first" };
        case "status": {
          const firstOpt = options?.[0]?.label;
          const lastOpt = options?.[options.length - 1]?.label;
          if (firstOpt && lastOpt && firstOpt !== lastOpt) {
            return {
              asc: `Sort ${firstOpt} → ${lastOpt}`,
              desc: `Sort ${lastOpt} → ${firstOpt}`,
            };
          }
          return { asc: "Sort by status order", desc: "Sort reverse status order" };
        }
        case "tag":
        case "multi-tag":
        case "text":
        case "file":
        default:
          return { asc: "Sort A → Z (Ascending)", desc: "Sort Z → A (Descending)" };
      }
    };

    const sortLabels = getSortMenuLabels(
      column.type,
      (config.statusOptions && config.statusOptions[column.key]) || column.options
    );

    const sortAscItem = popover.createDiv({ cls: "dbui-menu-action-item" });
    sortAscItem.createSpan({ text: `${sortLabels.asc} ▲` });
    sortAscItem.addEventListener("click", async () => {
      config.sort = [{ key: column.key, direction: "asc" }];
      await onConfigChange();
      close();
      onDataUpdated();
    });

    const sortDescItem = popover.createDiv({ cls: "dbui-menu-action-item" });
    sortDescItem.createSpan({ text: `${sortLabels.desc} ▼` });
    sortDescItem.addEventListener("click", async () => {
      config.sort = [{ key: column.key, direction: "desc" }];
      await onConfigChange();
      close();
      onDataUpdated();
    });

    // Hide Column & Remove from Table
    if (column.key !== "file.name") {
      const hideItem = popover.createDiv({ cls: "dbui-menu-action-item" });
      hideItem.createSpan({ text: "Hide property" });
      hideItem.setAttribute("title", "Hides column from view. Re-enable in Properties.");
      hideItem.addEventListener("click", async () => {
        column.visible = false;
        await onConfigChange();
        close();
        onDataUpdated();
      });

      const removeItem = popover.createDiv({ cls: "dbui-menu-action-item dbui-danger-item" });
      removeItem.createSpan({ text: "Remove from table" });
      removeItem.setAttribute("title", "Removes from table columns. Property in notes is preserved.");
      removeItem.addEventListener("click", async () => {
        config.columns = config.columns.filter((c) => c.key !== column.key);
        config.removedKeys = config.removedKeys || [];
        if (!config.removedKeys.includes(column.key.toLowerCase())) {
          config.removedKeys.push(column.key.toLowerCase());
        }
        await onConfigChange();
        close();
        onDataUpdated();
      });
    }

    reposition();
  }
}
