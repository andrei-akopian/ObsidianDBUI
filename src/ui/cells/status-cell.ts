import { COLOR_PALETTE } from "../../constants";
import { resolveTagColor } from "../../data/color-palette";
import { ColumnConfig, RowData, StatusOption, TagColor } from "../../types";
import { PopoverManager } from "../popover-manager";

export class StatusCell {
  static render(
    container: HTMLElement,
    row: RowData,
    column: ColumnConfig,
    tagColors: Record<string, TagColor>,
    statusOptions: Record<string, StatusOption[]>,
    onCommit: (newValue: any) => Promise<void>,
    onSaveStatusOptions: (options: StatusOption[]) => Promise<void>
  ): void {
    const rawVal = row.values[column.key];
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
      this.openStatusPopover(container, column, status, tagColors, statusOptions, onCommit, onSaveStatusOptions);
    });
  }

  static openStatusPopover(
    anchor: HTMLElement,
    column: ColumnConfig,
    initialStatus: string,
    tagColors: Record<string, TagColor>,
    statusOptionsMap: Record<string, StatusOption[]>,
    onCommit: (newValue: any) => Promise<void>,
    onSaveStatusOptions: (options: StatusOption[]) => Promise<void>
  ): void {
    let currentStatus = initialStatus;
    const existingOptions: StatusOption[] = statusOptionsMap[column.key] || column.options || [];

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

      for (const opt of matched) {
        const item = listContainer.createDiv({
          cls: `dbui-popover-item ${opt.label.toLowerCase() === currentStatus.toLowerCase() ? "is-selected" : ""}`,
        });

        const color = resolveTagColor(opt.label, tagColors);
        const pill = item.createDiv({ cls: "dbui-pill dbui-status-pill" });
        pill.style.backgroundColor = color.bg;
        pill.style.color = color.text;
        pill.createSpan({ text: opt.label });

        // Checkmark if selected
        if (opt.label.toLowerCase() === currentStatus.toLowerCase()) {
          item.createSpan({ cls: "dbui-item-check", text: "✓" });
        }

        // Color change button
        const colorBtn = item.createDiv({ cls: "dbui-color-dot-btn" });
        colorBtn.style.backgroundColor = color.text;
        colorBtn.setAttribute("title", "Change color");
        colorBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.openColorMenu(colorBtn, opt.label, tagColors, async (newColor) => {
            tagColors[opt.label] = newColor;
            renderList(searchInput.value);
          });
        });

        item.addEventListener("click", async (e) => {
          e.stopPropagation();
          // Update visual checkmark immediately
          currentStatus = opt.label;
          renderList(searchInput.value);
          // Close popover
          close();
          // Commit property update
          await onCommit(opt.label);
        });
      }

      // If user typed something new
      if (q && !existingOptions.some((opt) => opt.label.toLowerCase() === q)) {
        const createItem = listContainer.createDiv({ cls: "dbui-popover-item dbui-create-item" });
        createItem.createSpan({ text: `+ Create "${filter.trim()}"` });
        createItem.addEventListener("click", async (e) => {
          e.stopPropagation();
          const newLabel = filter.trim();
          const newOpt: StatusOption = {
            id: newLabel.toLowerCase().replace(/\s+/g, "-"),
            label: newLabel,
            color: "",
          };
          const updated = [...existingOptions, newOpt];
          statusOptionsMap[column.key] = updated;
          await onSaveStatusOptions(updated);
          currentStatus = newLabel;
          renderList(searchInput.value);
          close();
          await onCommit(newLabel);
        });
      }

      // Clear button
      if (currentStatus) {
        const clearItem = listContainer.createDiv({ cls: "dbui-popover-item dbui-clear-item" });
        clearItem.createSpan({ text: "Clear status" });
        clearItem.addEventListener("click", async (e) => {
          e.stopPropagation();
          currentStatus = "";
          close();
          await onCommit(null);
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
        const q = searchInput.value.trim();
        if (!q) return;
        const exact = existingOptions.find((opt) => opt.label.toLowerCase() === q.toLowerCase());
        if (exact) {
          currentStatus = exact.label;
          close();
          await onCommit(exact.label);
        } else {
          const newOpt: StatusOption = {
            id: q.toLowerCase().replace(/\s+/g, "-"),
            label: q,
            color: "",
          };
          const updated = [...existingOptions, newOpt];
          statusOptionsMap[column.key] = updated;
          await onSaveStatusOptions(updated);
          currentStatus = q;
          close();
          await onCommit(q);
        }
      }
    });
  }

  static openColorMenu(
    anchor: HTMLElement,
    label: string,
    tagColors: Record<string, TagColor>,
    onSelectColor: (color: TagColor) => Promise<void>
  ): void {
    const { el: colorMenu, close } = PopoverManager.createPopover({
      anchor,
      cls: "dbui-color-picker-popover",
      allowNested: true,
    });

    const isDark = document.body.classList.contains("theme-dark");

    for (const preset of COLOR_PALETTE) {
      const row = colorMenu.createDiv({ cls: "dbui-color-preset-row" });
      const swatch = row.createDiv({ cls: "dbui-color-swatch" });
      const bg = isDark ? preset.bgDark : preset.bgLight;
      const text = isDark ? preset.textDark : preset.textLight;

      swatch.style.backgroundColor = bg;
      swatch.style.color = text;
      swatch.createSpan({ text: preset.name });

      row.addEventListener("click", async (e) => {
        e.stopPropagation();
        close();
        await onSelectColor({ bg, text });
      });
    }
  }
}
