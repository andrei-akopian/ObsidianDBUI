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
    allRows: RowData[],
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
      const colWidth = column.width || 160;
      th.style.width = `${colWidth}px`;
      th.style.minWidth = `${colWidth}px`;
      th.setAttribute("data-key", column.key);
      th.setAttribute("draggable", "true");

      const contentWrap = th.createDiv({ cls: "dbui-th-content" });

      // Type icon
      const iconSpan = contentWrap.createSpan({ cls: "dbui-th-type-icon" });
      this.renderTypeIcon(iconSpan, column.type);

      // Column display name
      contentWrap.createSpan({ cls: "dbui-th-name", text: column.name });

      // Sort indicator
      const activeSort = config.sort.find((s) => s.key === column.key || s.key.toLowerCase() === column.key.toLowerCase());
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
          allRows,
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
        thead.querySelectorAll(".dbui-th").forEach((el) => {
          el.removeClass("is-drag-over");
        });
      });

      th.addEventListener("dragover", (evt) => {
        evt.preventDefault();
        if (evt.dataTransfer) evt.dataTransfer.dropEffect = "move";
        if (draggedColKey && draggedColKey !== column.key && !th.classList.contains("is-drag-over")) {
          th.addClass("is-drag-over");
        }
      });

      th.addEventListener("dragleave", () => {
        th.removeClass("is-drag-over");
      });

      th.addEventListener("drop", async (evt) => {
        evt.preventDefault();
        th.removeClass("is-drag-over");
        const sourceKey = evt.dataTransfer?.getData("text/plain") || draggedColKey;
        if (!sourceKey || sourceKey === column.key) return;

        const fromIdx = config.columns.findIndex((c) => c.key === sourceKey);
        const toIdx = config.columns.findIndex((c) => c.key === column.key);

        if (fromIdx !== -1 && toIdx !== -1) {
          const [moved] = config.columns.splice(fromIdx, 1);
          config.columns.splice(toIdx, 0, moved);
          await onConfigChange();
          onDataUpdated();
        }
      });

      // Resize handle
      const resizer = th.createDiv({ cls: "dbui-col-resizer dbui-th-resizer" });
      resizer.setAttribute("title", "Drag to resize column");
      this.attachResizer(resizer, th, column, onConfigChange);
    });

    // 3. Rightmost sticky "+ Add column" header button
    const thAdd = tr.createEl("th", { cls: "dbui-th dbui-th-add-col" });
    const addColBtn = thAdd.createDiv({ cls: "dbui-add-col-btn" });
    setIcon(addColBtn, "plus");
    addColBtn.createSpan({ text: "Add property" });

    addColBtn.addEventListener("click", (evt) => {
      evt.stopPropagation();
      this.openAddColumnPopover(
        addColBtn,
        config,
        discoveredProps,
        onConfigChange,
        onDataUpdated
      );
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
    const existingIdx = config.sort.findIndex((s) => s.key === key || s.key.toLowerCase() === key.toLowerCase());
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
    resizer.addEventListener("pointerdown", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      resizer.setPointerCapture(evt.pointerId);

      const startX = evt.clientX;
      const startWidth = th.getBoundingClientRect().width;
      let newWidth = startWidth;

      const doc = th.ownerDocument || document;
      doc.body.addClass("is-resizing-column");

      // Find matching column cells in tbody
      const trParent = th.parentElement;
      const colIndex = trParent ? Array.from(trParent.children).indexOf(th) : -1;
      const table = th.closest("table");
      const colTds = colIndex >= 0 && table
        ? table.querySelectorAll<HTMLTableCellElement>(`tbody tr td:nth-child(${colIndex + 1})`)
        : null;

      const onPointerMove = (moveEvt: PointerEvent) => {
        const delta = moveEvt.clientX - startX;
        newWidth = Math.max(60, startWidth + delta);
        th.style.width = `${newWidth}px`;
        th.style.minWidth = `${newWidth}px`;
        if (colTds) {
          colTds.forEach((td) => {
            td.style.width = `${newWidth}px`;
            td.style.minWidth = `${newWidth}px`;
          });
        }
      };

      const onPointerUp = async (upEvt: PointerEvent) => {
        resizer.releasePointerCapture(upEvt.pointerId);
        doc.body.removeClass("is-resizing-column");
        resizer.removeEventListener("pointermove", onPointerMove);
        resizer.removeEventListener("pointerup", onPointerUp);

        column.width = Math.round(newWidth);
        await onConfigChange();
      };

      resizer.addEventListener("pointermove", onPointerMove);
      resizer.addEventListener("pointerup", onPointerUp);
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
      popover.createDiv({ cls: "dbui-popover-subtitle", text: "From Notes" });
      const list = popover.createDiv({ cls: "dbui-add-prop-list" });

      for (const prop of availableProps) {
        const item = list.createDiv({ cls: "dbui-add-prop-item" });
        const nameSpan = item.createSpan({ cls: "dbui-add-prop-name", text: prop.name });
        item.createSpan({
          cls: "dbui-add-prop-meta",
          text: `(${prop.type} • ${prop.count} note${prop.count > 1 ? "s" : ""})`,
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
          if (config.removedKeys) {
            config.removedKeys = config.removedKeys.filter(
              (k) => k.toLowerCase() !== prop.key.toLowerCase()
            );
          }
          await onConfigChange();
          close();
          onDataUpdated();
        });
      }
    }

    // 2. Create new property section
    popover.createDiv({ cls: "dbui-popover-subtitle", text: "New Property" });
    const newWrap = popover.createDiv({ cls: "dbui-add-new-wrap" });

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
      let baseKey = name.toLowerCase().replace(/[\s\-_]+/g, "_").replace(/[^\w]/g, "");
      if (!baseKey || baseKey === "file_name" || baseKey === "name") {
        baseKey = "property";
      }

      let candidateKey = baseKey;
      let suffix = 1;
      while (
        candidateKey.toLowerCase() === "file.name" ||
        config.columns.some((c) => c.key.toLowerCase() === candidateKey.toLowerCase())
      ) {
        candidateKey = `${baseKey}_${suffix++}`;
      }

      const newCol: ColumnConfig = {
        key: candidateKey,
        name,
        type: typeSelect.value as DataType,
        width: typeSelect.value === "checkbox" ? 80 : 160,
        visible: true,
        wrap: false,
        numberFormat: typeSelect.value === "number" ? "plain" : undefined,
        dateFormat: typeSelect.value === "date" ? "relative" : undefined,
      };

      config.columns.push(newCol);
      if (config.removedKeys) {
        config.removedKeys = config.removedKeys.filter(
          (k) => k.toLowerCase() !== candidateKey.toLowerCase()
        );
      }
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
