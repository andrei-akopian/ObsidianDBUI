import { COLOR_PALETTE } from "../../constants";
import { resolveTagColor } from "../../data/color-palette";
import { ColumnConfig, RowData, TagColor } from "../../types";
import { fuzzyMatch, normalizeTag } from "../../utils/string-utils";
import { PopoverManager } from "../popover-manager";

export class TagCell {
  static render(
    container: HTMLElement,
    row: RowData,
    column: ColumnConfig,
    allVaultTags: string[],
    tagColors: Record<string, TagColor>,
    onCommit: (newValue: any) => Promise<void>,
    onSaveTagColors: (colors: Record<string, TagColor>) => Promise<void>
  ): void {
    const rawVal = row.values[column.key];
    const tags: string[] = [];

    if (Array.isArray(rawVal)) {
      for (const item of rawVal) {
        if (item !== null && item !== undefined && item !== "") {
          const t = normalizeTag(String(item));
          if (t) tags.push(t);
        }
      }
    } else if (typeof rawVal === "string") {
      const parts = rawVal.split(",").map((s) => normalizeTag(s)).filter(Boolean);
      tags.push(...parts);
    } else if (rawVal !== null && rawVal !== undefined && rawVal !== "") {
      const t = normalizeTag(String(rawVal));
      if (t) tags.push(t);
    }

    container.empty();
    const wrapper = container.createDiv({ cls: "dbui-tag-cell" });

    if (tags.length === 0) {
      wrapper.createSpan({ cls: "dbui-cell-placeholder", text: "" });
    } else {
      for (const tag of tags) {
        const color = resolveTagColor(tag, tagColors);
        const pill = wrapper.createDiv({ cls: "dbui-pill dbui-tag-pill" });
        pill.style.backgroundColor = color.bg;
        pill.style.color = color.text;
        pill.createSpan({ text: tag });
      }
    }

    container.addEventListener("click", (evt) => {
      evt.stopPropagation();
      this.openTagPopover(
        container,
        column,
        tags,
        allVaultTags,
        tagColors,
        onCommit,
        onSaveTagColors
      );
    });
  }

  static openTagPopover(
    anchor: HTMLElement,
    column: ColumnConfig,
    currentTags: string[],
    allVaultTags: string[],
    tagColors: Record<string, TagColor>,
    onCommit: (newValue: any) => Promise<void>,
    onSaveTagColors: (colors: Record<string, TagColor>) => Promise<void>
  ): void {
    let selectedTags = [...currentTags];
    const isSingle = column.type === "tag";
    let hasCommitted = false;

    const updateCellVisuals = () => {
      if (!anchor.isConnected) return;
      anchor.empty();
      const wrapper = anchor.createDiv({ cls: "dbui-tag-cell" });
      if (selectedTags.length === 0) {
        wrapper.createSpan({ cls: "dbui-cell-placeholder", text: "" });
      } else {
        for (const tag of selectedTags) {
          const color = resolveTagColor(tag, tagColors);
          const pill = wrapper.createDiv({ cls: "dbui-pill dbui-tag-pill" });
          pill.style.backgroundColor = color.bg;
          pill.style.color = color.text;
          pill.createSpan({ text: tag });
        }
      }
    };

    const commitChanges = async () => {
      if (hasCommitted) return;
      // Check if tags actually changed
      const changed =
        selectedTags.length !== currentTags.length ||
        selectedTags.some((t, i) => t !== currentTags[i]);
      if (!changed) return;

      hasCommitted = true;
      if (isSingle) {
        await onCommit(selectedTags[0] || null);
      } else {
        await onCommit(selectedTags.length > 0 ? selectedTags : null);
      }
    };

    const { el: popover, close, reposition } = PopoverManager.createPopover({
      anchor,
      cls: "dbui-tag-popover",
      onClose: async () => {
        if (!isSingle) {
          await commitChanges();
        }
      },
    });

    // Selected chips container
    const selectedWrapper = popover.createDiv({ cls: "dbui-tag-selected-wrap" });

    // Search input
    const searchWrapper = popover.createDiv({ cls: "dbui-popover-search-wrap" });
    const searchInput = searchWrapper.createEl("input", {
      type: "text",
      cls: "dbui-popover-search-input",
      placeholder: isSingle ? "Select tag..." : "Search or add tags...",
    });

    // Suggestions list
    const listContainer = popover.createDiv({ cls: "dbui-popover-list" });

    let activeIndex = -1;

    const renderSelected = () => {
      selectedWrapper.empty();
      if (selectedTags.length === 0) {
        selectedWrapper.style.display = "none";
        return;
      }
      selectedWrapper.style.display = "flex";
      for (const tag of selectedTags) {
        const color = resolveTagColor(tag, tagColors);
        const chip = selectedWrapper.createDiv({ cls: "dbui-pill dbui-tag-pill is-removable" });
        chip.style.backgroundColor = color.bg;
        chip.style.color = color.text;
        chip.createSpan({ text: tag });

        const removeBtn = chip.createSpan({ cls: "dbui-pill-remove", text: "×" });
        removeBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          selectedTags = selectedTags.filter((t) => t !== tag);
          updateCellVisuals();
          renderSelected();
          renderList(searchInput.value);
          reposition();
        });
      }
    };

    const renderList = (filter = "") => {
      listContainer.empty();
      activeIndex = -1;
      const q = filter.trim().toLowerCase();

      // Combine vault tags and current tags, deduplicate
      const candidateSet = new Set<string>([...allVaultTags, ...selectedTags]);
      const candidates = Array.from(candidateSet);

      // Filter and limit to top 50 for fast responsiveness
      const matched: string[] = [];
      for (const tag of candidates) {
        if (!q || fuzzyMatch(q, tag)) {
          matched.push(tag);
          if (matched.length >= 50) break;
        }
      }

      // Check if exact match exists
      const exactMatch = candidates.find((t) => t.toLowerCase() === q);

      // Create new tag option if not exact match
      if (q && !exactMatch) {
        const createItem = listContainer.createDiv({ cls: "dbui-popover-item dbui-create-item" });
        createItem.createSpan({ text: `+ Create tag "${filter.trim()}"` });
        createItem.addEventListener("click", async () => {
          const newTag = normalizeTag(filter);
          if (newTag && !selectedTags.includes(newTag)) {
            if (isSingle) {
              selectedTags = [newTag];
              updateCellVisuals();
              await commitChanges();
              close();
              return;
            } else {
              selectedTags.push(newTag);
            }
            searchInput.value = "";
            updateCellVisuals();
            renderSelected();
            renderList("");
            reposition();
          }
        });
      }

      for (let i = 0; i < matched.length; i++) {
        const tag = matched[i];
        const isSelected = selectedTags.includes(tag);
        const item = listContainer.createDiv({
          cls: `dbui-popover-item ${isSelected ? "is-selected" : ""}`,
        });

        const color = resolveTagColor(tag, tagColors);
        const pill = item.createDiv({ cls: "dbui-pill dbui-tag-pill" });
        pill.style.backgroundColor = color.bg;
        pill.style.color = color.text;
        pill.createSpan({ text: tag });

        if (isSelected) {
          item.createSpan({ cls: "dbui-item-check", text: "✓" });
        }

        // Color button
        const colorBtn = item.createDiv({ cls: "dbui-color-dot-btn" });
        colorBtn.style.backgroundColor = color.text;
        colorBtn.setAttribute("title", "Change color");
        colorBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.openColorPicker(colorBtn, tag, tagColors, async (newColor) => {
            tagColors[tag] = newColor;
            await onSaveTagColors(tagColors);
            updateCellVisuals();
            renderSelected();
            renderList(searchInput.value);
          });
        });

        item.addEventListener("click", async () => {
          if (isSelected) {
            selectedTags = selectedTags.filter((t) => t !== tag);
          } else {
            if (isSingle) {
              selectedTags = [tag];
            } else {
              selectedTags.push(tag);
            }
          }
          searchInput.value = "";
          updateCellVisuals();
          if (isSingle) {
            await commitChanges();
            close();
          } else {
            renderSelected();
            renderList("");
            reposition();
          }
        });
      }
    };

    renderSelected();
    renderList();
    reposition();

    searchInput.focus();
    searchInput.addEventListener("input", () => {
      renderList(searchInput.value);
      reposition();
    });

    searchInput.addEventListener("keydown", async (evt) => {
      const items = listContainer.querySelectorAll<HTMLElement>(".dbui-popover-item");
      if (evt.key === "ArrowDown") {
        evt.preventDefault();
        if (items.length > 0) {
          activeIndex = (activeIndex + 1) % items.length;
          items.forEach((it, idx) => it.toggleClass("is-active", idx === activeIndex));
          items[activeIndex]?.scrollIntoView({ block: "nearest" });
        }
      } else if (evt.key === "ArrowUp") {
        evt.preventDefault();
        if (items.length > 0) {
          activeIndex = (activeIndex - 1 + items.length) % items.length;
          items.forEach((it, idx) => it.toggleClass("is-active", idx === activeIndex));
          items[activeIndex]?.scrollIntoView({ block: "nearest" });
        }
      } else if (evt.key === "Enter") {
        evt.preventDefault();
        if (activeIndex >= 0 && items[activeIndex]) {
          items[activeIndex].click();
        } else if (searchInput.value.trim()) {
          const createBtn = listContainer.querySelector<HTMLElement>(".dbui-create-item");
          if (createBtn) createBtn.click();
        }
      }
    });
  }

  static openColorPicker(
    anchor: HTMLElement,
    tag: string,
    tagColors: Record<string, TagColor>,
    onSelect: (color: TagColor) => Promise<void>
  ): void {
    const { el: popover, close } = PopoverManager.createPopover({
      anchor,
      cls: "dbui-color-picker-popover",
      allowNested: true,
    });

    popover.createDiv({ cls: "dbui-color-picker-title", text: `Color for "${tag}"` });
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
