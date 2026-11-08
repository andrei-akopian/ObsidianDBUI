import { ColumnConfig, DBConfig, FilterOperator, FilterRule } from "../../types";
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

    const renderFilters = () => {
      listContainer.empty();
      updateClearBtn();

      if (config.filters.length === 0) {
        listContainer.createDiv({ cls: "dbui-empty-hint", text: "No active filters." });
      }

      config.filters.forEach((filter, idx) => {
        const row = listContainer.createDiv({ cls: "dbui-filter-row" });

        // Column select
        const colSelect = row.createEl("select", { cls: "dbui-select" });
        for (const col of columns) {
          const opt = colSelect.createEl("option", { value: col.key, text: col.name });
          if (col.key === filter.key) opt.selected = true;
        }
        colSelect.addEventListener("change", async () => {
          filter.key = colSelect.value;
          await onConfigChange();
          onDataUpdated();
        });

        // Operator select
        const opSelect = row.createEl("select", { cls: "dbui-select" });
        const operators: { value: FilterOperator; label: string }[] = [
          { value: "contains", label: "contains" },
          { value: "not-contains", label: "does not contain" },
          { value: "equals", label: "is" },
          { value: "not-equals", label: "is not" },
          { value: "greater", label: ">" },
          { value: "less", label: "<" },
          { value: "is-empty", label: "is empty" },
          { value: "is-not-empty", label: "is not empty" },
          { value: "is-today", label: "is today" },
          { value: "is-past", label: "is in past" },
          { value: "is-future", label: "is in future" },
        ];

        for (const op of operators) {
          const opt = opSelect.createEl("option", { value: op.value, text: op.label });
          if (op.value === filter.operator) opt.selected = true;
        }
        opSelect.addEventListener("change", async () => {
          filter.operator = opSelect.value as FilterOperator;
          await onConfigChange();
          renderFilters();
          reposition();
          onDataUpdated();
        });

        // Value input (hidden for empty/date-state operators)
        const needsValue = !["is-empty", "is-not-empty", "is-today", "is-past", "is-future"].includes(
          filter.operator
        );
        if (needsValue) {
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
      const firstCol = columns[0] ? columns[0].key : "file.name";
      const newRule: FilterRule = {
        id: `f_${Date.now()}`,
        key: firstCol,
        operator: "contains",
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
