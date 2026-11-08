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
        if (typeof item === "string") {
          const t = normalizeTag(item);
          if (t) tags.push(t);
        }
      }
    } else if (typeof rawVal === "string") {
      const t = normalizeTag(rawVal);
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
    const { el: popover, close, reposition } = PopoverManager.createPopover({
      anchor,
      cls: "dbui-tag-popover",
    });

    let selectedTags = [...currentTags];

    // Selected chips container
    const selectedWrapper = popover.createDiv({ cls: "dbui-tag-selected-wrap" });

    // Search input
    const searchWrapper = popover.createDiv({ cls: "dbui-popover-search-wrap" });
    const searchInput = searchWrapper.createEl("input", {
      type: "text",
      cls: "dbui-popover-search-input",
      placeholder: "Search or add tags...",
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
          renderSelected();
          renderList(searchInput.value);
          reposition();
          await commitChanges();
        });
      }
    };

    const commitChanges = async () => {
      const isSingle = column.type === "tag";
      if (isSingle) {
        await onCommit(selectedTags[0] || null);
      } else {
        await onCommit(selectedTags.length > 0 ? selectedTags : null);
      }
    };

    const renderList = (filter = "") => {
      listContainer.empty();
      activeIndex = -1;
      const q = filter.trim().toLowerCase();

      // Combine vault tags and current tags, deduplicate
      const candidateSet = new Set<string>([...allVaultTags, ...selectedTags]);
      const candidates = Array.from(candidateSet);

      // Filter and limit to top 50 for ultra fast UI responsiveness
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
            selectedTags.push(newTag);
            searchInput.value = "";
            renderSelected();
            renderList("");
            reposition();
            await commitChanges();
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
            renderSelected();
            renderList(searchInput.value);
          });
        });

        item.addEventListener("click", async () => {
          const isSingle = column.type === "tag";
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
          renderSelected();
          renderList("");
          reposition();
          await commitChanges();
          if (isSingle) {
            close();
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
      const items = listContainer.querySelectorAll(".dbui-popover-item");
      if (evt.key === "ArrowDown") {
        evt.preventDefault();
        activeIndex = Math.min(items.length - 1, activeIndex + 1);
        updateActiveItem(items);
      } else if (evt.key === "ArrowUp") {
        evt.preventDefault();
        activeIndex = Math.max(0, activeIndex - 1);
        updateActiveItem(items);
      } else if (evt.key === "Enter") {
        evt.preventDefault();
        if (activeIndex >= 0 && activeIndex < items.length) {
          (items[activeIndex] as HTMLElement).click();
        } else if (searchInput.value.trim()) {
          const newTag = normalizeTag(searchInput.value);
          if (newTag && !selectedTags.includes(newTag)) {
            selectedTags.push(newTag);
            searchInput.value = "";
            renderSelected();
            renderList("");
            reposition();
            await commitChanges();
          }
        }
      } else if (evt.key === "Backspace" && !searchInput.value && selectedTags.length > 0) {
        selectedTags.pop();
        renderSelected();
        renderList("");
        reposition();
        await commitChanges();
      }
    });

    const updateActiveItem = (items: NodeListOf<Element>) => {
      items.forEach((it, idx) => {
        if (idx === activeIndex) {
          it.addClass("is-focused");
          (it as HTMLElement).scrollIntoView({ block: "nearest" });
        } else {
          it.removeClass("is-focused");
        }
      });
    };
  }

  static openColorPicker(
    anchor: HTMLElement,
    tag: string,
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
