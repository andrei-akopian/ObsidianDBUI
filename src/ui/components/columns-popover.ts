import { setIcon } from "obsidian";
import { DiscoveredProperty } from "../../data/vault-scanner";
import { ColumnConfig, DataType, DBConfig } from "../../types";
import { PopoverManager } from "../popover-manager";

export class ColumnsPopover {
  static open(
    anchor: HTMLElement,
    config: DBConfig,
    discoveredProps: DiscoveredProperty[],
    onConfigChange: () => Promise<void>,
    onDataUpdated: () => void
  ): void {
    const { el: popover, reposition } = PopoverManager.createPopover({
      anchor,
      cls: "dbui-columns-popover",
    });

    const header = popover.createDiv({ cls: "dbui-popover-header" });
    header.createSpan({ cls: "dbui-popover-title", text: "Properties" });

    // Show all / Hide all quick links
    const actions = header.createDiv({ cls: "dbui-popover-header-actions" });
    const showAllBtn = actions.createSpan({ cls: "dbui-popover-link-btn", text: "Show all" });
    showAllBtn.addEventListener("click", async () => {
      config.columns.forEach((c) => (c.visible = true));
      await onConfigChange();
      renderContent();
      onDataUpdated();
    });

    const container = popover.createDiv({ cls: "dbui-columns-content" });

    const renderContent = () => {
      container.empty();

      // Section 1: Active table columns
      const tableSection = container.createDiv({ cls: "dbui-columns-section" });
      tableSection.createDiv({ cls: "dbui-section-title", text: "Columns in Table" });
      const tableList = tableSection.createDiv({ cls: "dbui-columns-toggle-list" });

      for (const col of config.columns) {
        const item = tableList.createDiv({ cls: "dbui-column-toggle-item" });

        const checkbox = item.createEl("input", {
          type: "checkbox",
          cls: "dbui-toggle-checkbox",
        });
        checkbox.checked = col.visible !== false;

        const label = item.createSpan({ cls: "dbui-toggle-label", text: col.name });

        if (col.key === "file.name") {
          checkbox.disabled = true;
          item.createSpan({ cls: "dbui-toggle-lock", text: "(required)" });
        } else {
          checkbox.addEventListener("change", async () => {
            col.visible = checkbox.checked;
            await onConfigChange();
            onDataUpdated();
          });

          // Quick remove button
          const removeBtn = item.createDiv({ cls: "dbui-icon-btn dbui-del-btn", text: "×" });
          removeBtn.setAttribute("title", "Remove from table");
          removeBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            config.columns = config.columns.filter((c) => c.key !== col.key);
            await onConfigChange();
            renderContent();
            reposition();
            onDataUpdated();
          });
        }
      }

      // Section 2: Discovered properties in notes not currently in table
      const existingKeys = new Set(config.columns.map((c) => c.key.toLowerCase()));
      const availableProps = discoveredProps.filter(
        (p) => !existingKeys.has(p.key.toLowerCase())
      );

      if (availableProps.length > 0) {
        const availSection = container.createDiv({ cls: "dbui-columns-section dbui-avail-section" });
        availSection.createDiv({
          cls: "dbui-section-title",
          text: `Properties in Notes (${availableProps.length})`,
        });
        const availList = availSection.createDiv({ cls: "dbui-avail-props-list" });

        for (const prop of availableProps) {
          const row = availList.createDiv({ cls: "dbui-avail-prop-row" });

          const infoWrap = row.createDiv({ cls: "dbui-avail-info" });
          infoWrap.createSpan({ cls: "dbui-avail-name", text: prop.name });
          infoWrap.createSpan({
            cls: "dbui-avail-meta",
            text: `${prop.type} • ${prop.count} note${prop.count > 1 ? "s" : ""}`,
          });

          const addBtn = row.createDiv({ cls: "dbui-btn dbui-btn-small", text: "+ Add" });
          addBtn.setAttribute("title", `Add "${prop.name}" to table`);
          addBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
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
            renderContent();
            reposition();
            onDataUpdated();
          });
        }
      }
    };

    renderContent();
    reposition();
  }
}
