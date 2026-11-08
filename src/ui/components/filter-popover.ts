import { ColumnConfig, DataType, DBConfig, FilterOperator, FilterRule, StatusOption } from "../../types";
import { PopoverManager } from "../popover-manager";

export class FilterPopover {
  static open(
    anchor: HTMLElement,
    config: DBConfig,
    columns: ColumnConfig[],
    onConfigChange: () => Promise<void>,
    onDataUpdated: () => void
  ): void {
    const { el: popover, reposition } = PopoverManager.createPopover({
      anchor,
      cls: "dbui-filter-popover",
    });

    const header = popover.createDiv({ cls: "dbui-popover-header" });
    header.createSpan({ cls: "dbui-popover-title", text: "Filters" });

    const clearAllBtn = header.createSpan({ cls: "dbui-popover-link-btn", text: "Clear all" });
    const updateClearBtn = () => {
      clearAllBtn.style.display = config.filters.length > 0 ? "inline-block" : "none";
    };
    updateClearBtn();

    clearAllBtn.addEventListener("click", async () => {
      config.filters = [];
      await onConfigChange();
      updateClearBtn();
      renderFilters();
      reposition();
      onDataUpdated();
    });

    const listContainer = popover.createDiv({ cls: "dbui-filter-list" });

    const getOperatorsForType = (type: DataType): { value: FilterOperator | string; label: string }[] => {
      switch (type) {
        case "number":
          return [
            { value: "equals", label: "=" },
            { value: "not-equals", label: "≠" },
            { value: "greater", label: ">" },
            { value: "greater-equal", label: "≥" },
            { value: "less", label: "<" },
            { value: "less-equal", label: "≤" },
            { value: "is-empty", label: "is empty" },
            { value: "is-not-empty", label: "is not empty" },
          ];
        case "checkbox":
          return [
            { value: "is-checked", label: "is checked (true)" },
            { value: "is-unchecked", label: "is unchecked (false)" },
          ];
        case "status":
          return [
            { value: "equals", label: "is" },
            { value: "not-equals", label: "is not" },
            { value: "is-empty", label: "is empty" },
            { value: "is-not-empty", label: "is not empty" },
          ];
        case "date":
        case "time":
          return [
            { value: "equals", label: "is" },
            { value: "less", label: "is before" },
            { value: "greater", label: "is after" },
            { value: "is-today", label: "is today" },
            { value: "is-past", label: "is in past" },
            { value: "is-future", label: "is in future" },
            { value: "is-empty", label: "is empty" },
            { value: "is-not-empty", label: "is not empty" },
          ];
        case "tag":
        case "multi-tag":
          return [
            { value: "contains", label: "contains" },
            { value: "not-contains", label: "does not contain" },
            { value: "is-empty", label: "is empty" },
            { value: "is-not-empty", label: "is not empty" },
          ];
        case "text":
        case "file":
        default:
          return [
            { value: "contains", label: "contains" },
            { value: "not-contains", label: "does not contain" },
            { value: "equals", label: "is" },
            { value: "not-equals", label: "is not" },
            { value: "starts-with", label: "starts with" },
            { value: "ends-with", label: "ends with" },
            { value: "is-empty", label: "is empty" },
            { value: "is-not-empty", label: "is not empty" },
          ];
      }
    };

    const renderFilters = () => {
      listContainer.empty();
      updateClearBtn();

      if (config.filters.length === 0) {
        listContainer.createDiv({ cls: "dbui-empty-hint", text: "No active filters." });
      }

      config.filters.forEach((filter, idx) => {
        const row = listContainer.createDiv({ cls: "dbui-filter-row" });

        const currentCol = columns.find((c) => c.key === filter.key) || {
          key: filter.key,
          name: `${filter.key} (missing)`,
          type: "text" as DataType,
          width: 160,
          visible: true,
        };

        // 1. Column select
        const colSelect = row.createEl("select", { cls: "dbui-select dbui-filter-col-select" });
        const hasMatchingCol = columns.some((c) => c.key === filter.key);
        if (!hasMatchingCol) {
          const opt = colSelect.createEl("option", { value: filter.key, text: `${filter.key} (missing)` });
          opt.selected = true;
        }
        for (const col of columns) {
          const opt = colSelect.createEl("option", { value: col.key, text: col.name });
          if (col.key === filter.key) opt.selected = true;
        }

        colSelect.addEventListener("change", async () => {
          filter.key = colSelect.value;
          const newCol = columns.find((c) => c.key === filter.key);
          const ops = getOperatorsForType(newCol ? newCol.type : "text");
          filter.operator = ops[0].value as FilterOperator;
          filter.value = "";
          await onConfigChange();
          renderFilters();
          reposition();
          onDataUpdated();
        });

        // 2. Operator select
        const opSelect = row.createEl("select", { cls: "dbui-select dbui-filter-op-select" });
        const operators = getOperatorsForType(currentCol.type);

        // Ensure current operator is valid for type
        if (!operators.some((op) => op.value === filter.operator)) {
          filter.operator = operators[0].value as FilterOperator;
        }

        for (const op of operators) {
          const opt = opSelect.createEl("option", { value: String(op.value), text: op.label });
          if (String(op.value) === String(filter.operator)) opt.selected = true;
        }

        opSelect.addEventListener("change", async () => {
          filter.operator = opSelect.value as FilterOperator;
          await onConfigChange();
          renderFilters();
          reposition();
          onDataUpdated();
        });

        // 3. Datatype-Aware Value Control
        const noValueNeeded = [
          "is-empty",
          "is-not-empty",
          "is-today",
          "is-past",
          "is-future",
          "is-checked",
          "is-unchecked",
        ].includes(String(filter.operator));

        if (!noValueNeeded) {
          if (currentCol.type === "status") {
            // Status options dropdown
            const statusSelect = row.createEl("select", {
              cls: "dbui-select dbui-filter-val-input",
            });
            const options: StatusOption[] =
              (config.statusOptions && config.statusOptions[currentCol.key]) || currentCol.options || [];

            statusSelect.createEl("option", { value: "", text: "-- Select status --" });
            for (const opt of options) {
              const o = statusSelect.createEl("option", { value: opt.label, text: opt.label });
              if (String(filter.value) === opt.label) o.selected = true;
            }

            statusSelect.addEventListener("change", async () => {
              filter.value = statusSelect.value;
              await onConfigChange();
              onDataUpdated();
            });
          } else if (currentCol.type === "date" || currentCol.type === "time") {
            // Date picker input
            const dateInput = row.createEl("input", {
              type: "date",
              cls: "dbui-input dbui-filter-val-input",
              value: filter.value ? String(filter.value).slice(0, 10) : "",
            });
            dateInput.addEventListener("change", async () => {
              filter.value = dateInput.value;
              await onConfigChange();
              onDataUpdated();
            });
          } else if (currentCol.type === "number") {
            // Numeric input
            const numInput = row.createEl("input", {
              type: "number",
              cls: "dbui-input dbui-filter-val-input",
              value: filter.value !== undefined && filter.value !== null ? String(filter.value) : "",
              placeholder: "0",
            });
            numInput.addEventListener("input", async () => {
              filter.value = numInput.value ? Number(numInput.value) : "";
              await onConfigChange();
              onDataUpdated();
            });
          } else {
            // Text / Tag input
            const valInput = row.createEl("input", {
              type: "text",
              cls: "dbui-input dbui-filter-val-input",
              value: filter.value !== undefined && filter.value !== null ? String(filter.value) : "",
              placeholder: "Value...",
            });
            valInput.addEventListener("input", async () => {
              filter.value = valInput.value;
              await onConfigChange();
              onDataUpdated();
            });
          }
        } else {
          // Spacer placeholder to maintain layout balance
          row.createDiv({ cls: "dbui-filter-val-spacer" });
        }

        // Delete button
        const delBtn = row.createDiv({ cls: "dbui-icon-btn dbui-del-btn", text: "×" });
        delBtn.setAttribute("title", "Remove filter");
        delBtn.addEventListener("click", async () => {
          config.filters = config.filters.filter((_, i) => i !== idx);
          await onConfigChange();
          renderFilters();
          reposition();
          onDataUpdated();
        });
      });
    };

    // Footer container created ONCE outside renderFilters
    const footer = popover.createDiv({ cls: "dbui-filter-footer" });
    const addBtn = footer.createDiv({ cls: "dbui-add-filter-btn", text: "+ Add filter" });
    addBtn.addEventListener("click", async () => {
      const firstCol = columns[0] || { key: "file.name", type: "text" as DataType };
      const ops = getOperatorsForType(firstCol.type);
      const newRule: FilterRule = {
        id: `f_${Date.now()}`,
        key: firstCol.key,
        operator: ops[0].value as FilterOperator,
        value: "",
      };
      config.filters.push(newRule);
      await onConfigChange();
      renderFilters();
      reposition();
      onDataUpdated();
    });

    renderFilters();
    reposition();
  }
}
