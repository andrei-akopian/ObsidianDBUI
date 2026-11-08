import { App, setIcon } from "obsidian";
import { FrontmatterManager } from "../../data/frontmatter-manager";
import { DiscoveredProperty } from "../../data/vault-scanner";
import { ColumnConfig, DataType, DBConfig, RowData } from "../../types";
import { PopoverManager } from "../popover-manager";
import { ColumnMenuPopover } from "./column-menu-popover";

export class TableHeader {
  static render(
    thead: HTMLTableSectionElement,
    columns: ColumnConfig[],
    config: DBConfig,
    rows: RowData[],
    discoveredProps: DiscoveredProperty[],
    app: App,
    frontmatterManager: FrontmatterManager,
    onConfigChange: () => Promise<void>,
    onDataUpdated: () => void
  ): void {
    thead.empty();
    const tr = thead.createEl("tr", { cls: "dbui-header-row" });

    // 1. Index column header
    if (config.settings.showRowNumbers) {
      const thIndex = tr.createEl("th", { cls: "dbui-th dbui-th-index" });
      thIndex.createSpan({ text: "#" });
    }

    let draggedColKey: string | null = null;

    // 2. Data column headers
    columns.forEach((column) => {
      const th = tr.createEl("th", { cls: "dbui-th" });
      th.style.width = `${column.width || 160}px`;
      th.setAttribute("data-key", column.key);
      th.setAttribute("draggable", "true");

      const contentWrap = th.createDiv({ cls: "dbui-th-content" });

      // Type icon
      const iconSpan = contentWrap.createSpan({ cls: "dbui-th-type-icon" });
      this.renderTypeIcon(iconSpan, column.type);

      // Column display name
      contentWrap.createSpan({ cls: "dbui-th-name", text: column.name });

      // Sort indicator
      const activeSort = config.sort.find((s) => s.key === column.key);
      if (activeSort) {
        contentWrap.createSpan({
          cls: "dbui-th-sort-indicator",
          text: activeSort.direction === "asc" ? " ▲" : " ▼",
        });
      }

      // Column menu trigger button
      const menuBtn = contentWrap.createDiv({ cls: "dbui-th-menu-btn" });
      setIcon(menuBtn, "more-horizontal");

      const openColumnMenu = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        ColumnMenuPopover.open(
          th,
          column,
          config,
          rows,
          app,
          frontmatterManager,
          onConfigChange,
          onDataUpdated
        );
      };

      menuBtn.addEventListener("click", openColumnMenu);
      th.addEventListener("contextmenu", openColumnMenu);

      // Header click: cycle sort (None -> Asc -> Desc -> None)
      contentWrap.addEventListener("click", async (evt) => {
        if (evt.target === menuBtn || menuBtn.contains(evt.target as Node)) return;
        this.cycleSort(column.key, config);
        await onConfigChange();
        onDataUpdated();
      });

      // Drag and Drop Column Reordering
      th.addEventListener("dragstart", (evt) => {
        draggedColKey = column.key;
        th.addClass("is-dragging");
        if (evt.dataTransfer) {
          evt.dataTransfer.effectAllowed = "move";
          evt.dataTransfer.setData("text/plain", column.key);
        }
      });

      th.addEventListener("dragend", () => {
        draggedColKey = null;
        th.removeClass("is-dragging");
        tr.querySelectorAll(".dbui-th").forEach((el) => el.removeClass("is-drag-over"));
      });

      th.addEventListener("dragover", (evt) => {
        evt.preventDefault();
        if (evt.dataTransfer) evt.dataTransfer.dropEffect = "move";
        if (draggedColKey && draggedColKey !== column.key) {
          th.addClass("is-drag-over");
        }
      });

      th.addEventListener("dragleave", () => {
        th.removeClass("is-drag-over");
      });

      th.addEventListener("drop", async (evt) => {
        evt.preventDefault();
        th.removeClass("is-drag-over");
        const sourceKey = draggedColKey || (evt.dataTransfer ? evt.dataTransfer.getData("text/plain") : null);
        const targetKey = column.key;

        if (sourceKey && targetKey && sourceKey !== targetKey) {
          const fromIdx = config.columns.findIndex((c) => c.key === sourceKey);
          const toIdx = config.columns.findIndex((c) => c.key === targetKey);

          if (fromIdx !== -1 && toIdx !== -1) {
            const [moved] = config.columns.splice(fromIdx, 1);
            config.columns.splice(toIdx, 0, moved);
            await onConfigChange();
            onDataUpdated();
          }
        }
      });

      // Resize Handle
      const resizer = th.createDiv({ cls: "dbui-col-resizer" });
      this.attachResizer(resizer, th, column, onConfigChange);
    });

    // 3. "+ Add property" Column Header
    const thAdd = tr.createEl("th", { cls: "dbui-th dbui-th-add-col" });
    const addColBtn = thAdd.createDiv({ cls: "dbui-add-col-btn" });
    const addIcon = addColBtn.createSpan({ cls: "dbui-add-col-icon" });
    setIcon(addIcon, "plus");
    addColBtn.createSpan({ text: "Add property" });

    addColBtn.addEventListener("click", () => {
      this.openAddColumnPopover(addColBtn, config, discoveredProps, onConfigChange, onDataUpdated);
    });
  }

  private static renderTypeIcon(el: HTMLElement, type: DataType): void {
    switch (type) {
      case "file":
        setIcon(el, "file-text");
        break;
      case "text":
        setIcon(el, "type");
        break;
      case "number":
        setIcon(el, "hash");
        break;
      case "status":
        setIcon(el, "circle-dot");
        break;
      case "tag":
      case "multi-tag":
        setIcon(el, "tag");
        break;
      case "date":
      case "time":
        setIcon(el, "calendar");
        break;
      case "checkbox":
        setIcon(el, "check-square");
        break;
      default:
        setIcon(el, "type");
        break;
    }
  }

  private static cycleSort(key: string, config: DBConfig): void {
    const existingIdx = config.sort.findIndex((s) => s.key === key);
    if (existingIdx === -1) {
      config.sort = [{ key, direction: "asc" }];
    } else if (config.sort[existingIdx].direction === "asc") {
      config.sort[existingIdx].direction = "desc";
    } else {
      config.sort.splice(existingIdx, 1);
    }
  }

  private static attachResizer(
    resizer: HTMLElement,
    th: HTMLElement,
    column: ColumnConfig,
    onConfigChange: () => Promise<void>
  ): void {
    resizer.addEventListener("mousedown", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();

      const startX = evt.clientX;
      const startWidth = th.getBoundingClientRect().width;
      let newWidth = startWidth;

      document.body.addClass("is-resizing-column");

      const onMouseMove = (moveEvt: MouseEvent) => {
        const delta = moveEvt.clientX - startX;
        newWidth = Math.max(60, startWidth + delta);
        th.style.width = `${newWidth}px`;
      };

      const onMouseUp = async () => {
        document.body.removeClass("is-resizing-column");
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);

        column.width = Math.round(newWidth);
        await onConfigChange();
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  }

  private static openAddColumnPopover(
    anchor: HTMLElement,
    config: DBConfig,
    discoveredProps: DiscoveredProperty[],
    onConfigChange: () => Promise<void>,
    onDataUpdated: () => void
  ): void {
    const { el: popover, close, reposition } = PopoverManager.createPopover({
      anchor,
      cls: "dbui-add-column-popover",
    });

    popover.createDiv({ cls: "dbui-popover-title", text: "Add Property" });

    // 1. Existing properties in notes not currently in table
    const existingKeys = new Set(config.columns.map((c) => c.key.toLowerCase()));
    const availableProps = discoveredProps.filter(
      (p) => !existingKeys.has(p.key.toLowerCase())
    );

    if (availableProps.length > 0) {
      const availWrap = popover.createDiv({ cls: "dbui-avail-add-section" });
      availWrap.createDiv({ cls: "dbui-menu-label", text: "Existing in notes" });

      const availList = availWrap.createDiv({ cls: "dbui-popover-list" });
      for (const prop of availableProps) {
        const item = availList.createDiv({ cls: "dbui-popover-item" });
        const nameSpan = item.createSpan({ text: prop.name });
        item.createSpan({
          cls: "dbui-avail-meta",
          text: `(${prop.type} • ${prop.count})`,
        });

        item.addEventListener("click", async () => {
          const newCol: ColumnConfig = {
            key: prop.key,
            name: prop.name,
            type: prop.type,
            width: prop.type === "checkbox" ? 80 : 160,
            visible: true,
            wrap: false,
            numberFormat: prop.type === "number" ? "plain" : undefined,
            dateFormat: prop.type === "date" ? "relative" : undefined,
          };
          config.columns.push(newCol);
          await onConfigChange();
          close();
          onDataUpdated();
        });
      }

      popover.createDiv({ cls: "dbui-menu-divider" });
    }

    // 2. Create new property section
    const newWrap = popover.createDiv({ cls: "dbui-new-prop-section" });
    newWrap.createDiv({ cls: "dbui-menu-label", text: "Create new property" });

    const input = newWrap.createEl("input", {
      type: "text",
      cls: "dbui-input",
      placeholder: "Property name...",
    });

    const typeSelect = newWrap.createEl("select", { cls: "dbui-select" });
    const types: { value: DataType; label: string }[] = [
      { value: "text", label: "Text" },
      { value: "number", label: "Number" },
      { value: "status", label: "Status (Dropdown)" },
      { value: "multi-tag", label: "Multi-tag" },
      { value: "tag", label: "Tag" },
      { value: "date", label: "Date" },
      { value: "checkbox", label: "Checkbox" },
    ];

    for (const t of types) {
      typeSelect.createEl("option", { value: t.value, text: t.label });
    }

    const createBtn = newWrap.createDiv({ cls: "dbui-btn dbui-btn-primary", text: "Create" });

    const doCreate = async () => {
      const name = input.value.trim();
      if (!name) return;
      const key = name.toLowerCase().replace(/\s+/g, "_");

      const newCol: ColumnConfig = {
        key,
        name,
        type: typeSelect.value as DataType,
        width: 160,
        visible: true,
        wrap: false,
        numberFormat: typeSelect.value === "number" ? "plain" : undefined,
        dateFormat: typeSelect.value === "date" ? "relative" : undefined,
      };

      config.columns.push(newCol);
      await onConfigChange();
      close();
      onDataUpdated();
    };

    createBtn.addEventListener("click", doCreate);
    input.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") await doCreate();
    });

    reposition();
    input.focus();
  }
}
