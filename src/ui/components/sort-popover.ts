import { ColumnConfig, DataType, DBConfig, SortDirection, SortRule, StatusOption } from "../../types";
import { PopoverManager } from "../popover-manager";

export class SortPopover {
  static open(
    anchor: HTMLElement,
    config: DBConfig,
    columns: ColumnConfig[],
    onConfigChange: () => Promise<void>,
    onDataUpdated: () => void
  ): void {
    const { el: popover, reposition } = PopoverManager.createPopover({
      anchor,
      cls: "dbui-sort-popover",
    });

    const header = popover.createDiv({ cls: "dbui-popover-header" });
    header.createSpan({ cls: "dbui-popover-title", text: "Sort" });

    const clearBtn = header.createSpan({ cls: "dbui-popover-link-btn", text: "Clear all" });
    const updateClearBtn = () => {
      clearBtn.style.display = config.sort.length > 0 ? "inline-block" : "none";
    };
    updateClearBtn();

    clearBtn.addEventListener("click", async () => {
      config.sort = [];
      await onConfigChange();
      updateClearBtn();
      renderSorts();
      reposition();
      onDataUpdated();
    });

    const listContainer = popover.createDiv({ cls: "dbui-sort-list" });

    const getDirectionLabels = (type: DataType, options?: StatusOption[]) => {
      switch (type) {
        case "number":
          return { asc: "0 → 9 (Smallest first)", desc: "9 → 0 (Largest first)" };
        case "date":
        case "time":
          return { asc: "Oldest first (Ascending)", desc: "Newest first (Descending)" };
        case "checkbox":
          return { asc: "Unchecked first", desc: "Checked first" };
        case "status": {
          const firstOpt = options?.[0]?.label;
          const lastOpt = options?.[options.length - 1]?.label;
          if (firstOpt && lastOpt && firstOpt !== lastOpt) {
            return {
              asc: `${firstOpt} → ${lastOpt} (Status order)`,
              desc: `${lastOpt} → ${firstOpt} (Reverse order)`,
            };
          }
          return { asc: "Status order (Ascending)", desc: "Reverse status order (Descending)" };
        }
        case "tag":
        case "multi-tag":
          return { asc: "A → Z (Ascending)", desc: "Z → A (Descending)" };
        case "text":
        case "file":
        default:
          return { asc: "A → Z (Ascending)", desc: "Z → A (Descending)" };
      }
    };

    const renderSorts = () => {
      listContainer.empty();
      updateClearBtn();

      if (config.sort.length === 0) {
        listContainer.createDiv({ cls: "dbui-empty-hint", text: "No active sorts." });
      }

      config.sort.forEach((sort, idx) => {
        const row = listContainer.createDiv({ cls: "dbui-sort-row" });

        const currentCol = columns.find((c) => c.key === sort.key) || columns[0] || {
          key: sort.key,
          name: sort.key,
          type: "text" as DataType,
          width: 160,
          visible: true,
        };

        // 1. Column select
        const colSelect = row.createEl("select", { cls: "dbui-select dbui-sort-col-select" });
        for (const col of columns) {
          const opt = colSelect.createEl("option", { value: col.key, text: col.name });
          if (col.key === sort.key) opt.selected = true;
        }
        colSelect.addEventListener("change", async () => {
          sort.key = colSelect.value;
          await onConfigChange();
          renderSorts();
          reposition();
          onDataUpdated();
        });

        // 2. Datatype-aware direction select
        const dirSelect = row.createEl("select", { cls: "dbui-select dbui-sort-dir-select" });
        const labels = getDirectionLabels(
          currentCol.type,
          (config.statusOptions && config.statusOptions[currentCol.key]) || currentCol.options
        );

        const dirOptAsc = dirSelect.createEl("option", { value: "asc", text: labels.asc });
        const dirOptDesc = dirSelect.createEl("option", { value: "desc", text: labels.desc });
        if (sort.direction === "asc") dirOptAsc.selected = true;
        else dirOptDesc.selected = true;

        dirSelect.addEventListener("change", async () => {
          sort.direction = dirSelect.value as SortDirection;
          await onConfigChange();
          onDataUpdated();
        });

        // 3. Delete button
        const delBtn = row.createDiv({ cls: "dbui-icon-btn dbui-del-btn", text: "×" });
        delBtn.setAttribute("title", "Remove sort");
        delBtn.addEventListener("click", async () => {
          config.sort = config.sort.filter((_, i) => i !== idx);
          await onConfigChange();
          renderSorts();
          reposition();
          onDataUpdated();
        });
      });
    };

    // Footer created ONCE outside renderSorts
    const footer = popover.createDiv({ cls: "dbui-sort-footer" });
    const addBtn = footer.createDiv({ cls: "dbui-add-filter-btn", text: "+ Add sort" });
    addBtn.addEventListener("click", async () => {
      const unusedCol = columns.find((c) => !config.sort.some((s) => s.key === c.key));
      const colKey = unusedCol ? unusedCol.key : columns[0]?.key || "file.name";
      const newRule: SortRule = {
        key: colKey,
        direction: "asc",
      };
      config.sort.push(newRule);
      await onConfigChange();
      renderSorts();
      reposition();
      onDataUpdated();
    });

    renderSorts();
    reposition();
  }
}
