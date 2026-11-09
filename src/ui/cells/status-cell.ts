import { setIcon } from "obsidian";
import { COLOR_PALETTE } from "../../constants";
import { resolveTagColor } from "../../data/color-palette";
import { getRowValue } from "../../data/value-processor";
import { ColumnConfig, RowData, StatusOption, TagColor } from "../../types";
import { PopoverManager } from "../popover-manager";

export class StatusCell {
  static render(
    container: HTMLElement,
    row: RowData,
    column: ColumnConfig,
    tagColors: Record<string, TagColor>,
    statusOptions: Record<string, StatusOption[]>,
    allRows: RowData[],
    onCommit: (newValue: any) => Promise<void>,
    onSaveStatusOptions: (options: StatusOption[]) => Promise<void>
  ): void {
    const rawVal = getRowValue(row.values, column.key);
    const status = rawVal ? String(rawVal).trim() : "";

    container.empty();
    const wrapper = container.createDiv({ cls: "dbui-status-cell" });

    if (status) {
      const color = resolveTagColor(status, tagColors);
      const pill = wrapper.createDiv({ cls: "dbui-pill dbui-status-pill" });
      pill.style.backgroundColor = color.bg;
      pill.style.color = color.text;
      pill.createSpan({ text: status });
    } else {
      wrapper.createSpan({ cls: "dbui-cell-placeholder", text: "" });
    }

    container.addEventListener("click", (evt) => {
      evt.stopPropagation();
      this.openStatusPopover(
        container,
        column,
        status,
        tagColors,
        statusOptions,
        allRows,
        onCommit,
        onSaveStatusOptions
      );
    });
  }

  static openStatusPopover(
    anchor: HTMLElement,
    column: ColumnConfig,
    initialStatus: string,
    tagColors: Record<string, TagColor>,
    statusOptionsMap: Record<string, StatusOption[]>,
    allRows: RowData[],
    onCommit: (newValue: any) => Promise<void>,
    onSaveStatusOptions: (options: StatusOption[]) => Promise<void>
  ): void {
    let currentStatus = initialStatus;
    const existingOptions: StatusOption[] = [
      ...(statusOptionsMap[column.key] || column.options || []),
    ];

    // Scan all rows across the table for all unique status values in this column
    if (allRows && allRows.length > 0) {
      for (const r of allRows) {
        const val = getRowValue(r.values, column.key);
        if (val !== null && val !== undefined && val !== "") {
          const label = String(val).trim();
          if (label && !existingOptions.some((o) => o.label.toLowerCase() === label.toLowerCase())) {
            existingOptions.push({
              id: `scanned-${label.toLowerCase()}`,
              label,
              color: "",
            });
          }
        }
      }
    }

    // If note has an existing status value not yet added, add it
    if (
      initialStatus &&
      !existingOptions.some((o) => o.label.toLowerCase() === initialStatus.toLowerCase())
    ) {
      existingOptions.push({
        id: `existing-${Date.now()}`,
        label: initialStatus,
        color: "",
      });
    }

    const { el: popover, close, reposition } = PopoverManager.createPopover({
      anchor,
      cls: "dbui-status-popover",
    });

    // Search input
    const searchWrapper = popover.createDiv({ cls: "dbui-popover-search-wrap" });
    const searchInput = searchWrapper.createEl("input", {
      type: "text",
      cls: "dbui-popover-search-input",
      placeholder: "Select or create status...",
    });

    const listContainer = popover.createDiv({ cls: "dbui-popover-list" });

    const renderList = (filter = "") => {
      listContainer.empty();
      const q = filter.trim().toLowerCase();
      const matched = existingOptions.filter((opt) => opt.label.toLowerCase().includes(q));

      for (let i = 0; i < matched.length; i++) {
        const opt = matched[i];
        const originalIndex = existingOptions.findIndex(
          (o) => o.id === opt.id || o.label.toLowerCase() === opt.label.toLowerCase()
        );

        const item = listContainer.createDiv({
          cls: `dbui-popover-item dbui-status-item ${
            opt.label.toLowerCase() === currentStatus.toLowerCase() ? "is-selected" : ""
          }`,
        });
        item.setAttribute("draggable", "true");

        // Drag handle with grip-vertical icon
        const dragHandle = item.createDiv({
          cls: "dbui-status-drag-handle",
          attr: { title: "Drag to reorder" },
        });
        setIcon(dragHandle, "grip-vertical");

        // Drag & Drop reorder
        item.addEventListener("dragstart", (e) => {
          e.dataTransfer?.setData("text/plain", String(originalIndex));
          item.addClass("is-dragging");
        });
        item.addEventListener("dragover", (e) => {
          e.preventDefault();
          item.addClass("is-drag-over");
        });
        item.addEventListener("dragleave", () => {
          item.removeClass("is-drag-over");
        });
        item.addEventListener("drop", async (e) => {
          e.preventDefault();
          item.removeClass("is-drag-over");
          const fromIdx = parseInt(e.dataTransfer?.getData("text/plain") || "-1", 10);
          if (fromIdx >= 0 && fromIdx !== originalIndex && fromIdx < existingOptions.length) {
            const [moved] = existingOptions.splice(fromIdx, 1);
            existingOptions.splice(originalIndex, 0, moved);
            statusOptionsMap[column.key] = [...existingOptions];
            column.options = [...existingOptions];
            await onSaveStatusOptions(existingOptions);
            renderList(searchInput.value);
            reposition();
          }
        });
        item.addEventListener("dragend", () => {
          item.removeClass("is-dragging");
        });

        const color = resolveTagColor(opt.label, tagColors);
        const pill = item.createDiv({ cls: "dbui-pill dbui-status-pill" });
        pill.style.backgroundColor = color.bg;
        pill.style.color = color.text;
        pill.createSpan({ text: opt.label });

        // Checkmark if selected
        if (opt.label.toLowerCase() === currentStatus.toLowerCase()) {
          item.createSpan({ cls: "dbui-item-check", text: "✓" });
        } else {
          item.createSpan({ cls: "dbui-item-check-spacer" });
        }

        // Color change button (opens palette grid)
        const colorBtn = item.createDiv({ cls: "dbui-color-dot-btn" });
        colorBtn.style.backgroundColor = color.text;
        colorBtn.setAttribute("title", "Change color");
        colorBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.openColorMenu(colorBtn, opt.label, tagColors, async (newColor) => {
            tagColors[opt.label] = newColor;
            await onSaveStatusOptions(existingOptions);
            renderList(searchInput.value);
          });
        });

        item.addEventListener("click", async (e) => {
          e.stopPropagation();
          currentStatus = opt.label;
          renderList(searchInput.value);
          close();
          await onCommit(opt.label);
        });
      }

      // If user typed something new
      if (q && !existingOptions.some((opt) => opt.label.toLowerCase() === q)) {
        const createItem = listContainer.createDiv({ cls: "dbui-popover-item dbui-create-item" });
        createItem.createSpan({ text: `+ Create "${filter.trim()}"` });
        createItem.addEventListener("click", async () => {
          const newLabel = filter.trim();
          const newOpt: StatusOption = {
            id: String(Date.now()),
            label: newLabel,
            color: "",
          };
          existingOptions.push(newOpt);
          statusOptionsMap[column.key] = [...existingOptions];
          column.options = [...existingOptions];
          await onSaveStatusOptions(existingOptions);
          currentStatus = newLabel;
          close();
          await onCommit(newLabel);
        });
      }
    };

    renderList();
    reposition();

    searchInput.focus();
    searchInput.addEventListener("input", () => {
      renderList(searchInput.value);
      reposition();
    });

    searchInput.addEventListener("keydown", async (evt) => {
      if (evt.key === "Enter") {
        const first = listContainer.querySelector(".dbui-popover-item") as HTMLElement;
        if (first) first.click();
      }
    });
  }

  static openColorMenu(
    anchor: HTMLElement,
    statusLabel: string,
    tagColors: Record<string, TagColor>,
    onSelect: (color: TagColor) => Promise<void>
  ): void {
    const { el: popover, close } = PopoverManager.createPopover({
      anchor,
      cls: "dbui-color-picker-popover",
      allowNested: true,
    });

    popover.createDiv({ cls: "dbui-color-picker-title", text: `Color for "${statusLabel}"` });
    const grid = popover.createDiv({ cls: "dbui-color-grid" });

    const isDark = document.body.classList.contains("theme-dark");

    for (const preset of COLOR_PALETTE) {
      const item = grid.createDiv({ cls: "dbui-color-item" });
      const bg = isDark ? preset.bgDark : preset.bgLight;
      const text = isDark ? preset.textDark : preset.textLight;

      const swatch = item.createDiv({ cls: "dbui-color-swatch" });
      swatch.style.backgroundColor = bg;
      swatch.style.color = text;
      swatch.createSpan({ text: preset.name });

      item.addEventListener("click", async (e) => {
        e.stopPropagation();
        close();
        await onSelect({ bg, text });
      });
    }
  }
}
