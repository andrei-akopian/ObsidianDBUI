import * as obsidian from "obsidian";
import { App } from "obsidian";
import { normalizeConfig } from "../data/config-manager";
import { DBTableView } from "./table-view";

export function registerBasesViewIfAvailable(plugin: obsidian.Plugin): boolean {
  const pluginAny = plugin as any;
  const obsidianAny = obsidian as any;

  if (
    typeof pluginAny.registerBasesView !== "function" ||
    !obsidianAny.BasesView
  ) {
    return false;
  }

  try {
    const BasesViewClass = obsidianAny.BasesView;

    class DBUIBasesView extends BasesViewClass {
      private dbTableView: DBTableView | null = null;
      private rootDiv: HTMLElement;

      constructor(controller: any, parentEl: HTMLElement) {
        super(controller);
        this.rootDiv = parentEl.createDiv({ cls: "dbui-bases-root" });
      }

      onDataUpdated() {
        try {
          if (!this.dbTableView) {
            const app = ((this as any).app || plugin.app) as App;
            const controller = (this as any).controller;
            const folder = controller?.sourceFolder || controller?.folder || "";
            const config = normalizeConfig({
              folder: typeof folder === "string" ? folder : "",
              includeSubfolders: true,
            });

            this.dbTableView = new DBTableView(
              app,
              this.rootDiv,
              config,
              null,
              async (cfg) => {
                // Saved in bases config if controller supports it
                if (typeof controller?.saveConfig === "function") {
                  await controller.saveConfig(cfg);
                }
              }
            );
            this.dbTableView.load();
          } else {
            this.dbTableView.refreshData(false);
          }
        } catch (err) {
          console.debug("[DBUI] Error in DBUIBasesView onDataUpdated:", err);
        }
      }

      onunload() {
        if (this.dbTableView) {
          this.dbTableView.destroy();
          this.dbTableView = null;
        }
        if (this.rootDiv.parentElement) {
          this.rootDiv.empty();
        }
      }
    }

    const registered = pluginAny.registerBasesView("dbui-table", {
      name: "DB UI Table",
      icon: "table",
      factory: (controller: any, containerEl: HTMLElement) =>
        new DBUIBasesView(controller, containerEl),
      options: () => [
        {
          type: "toggle",
          key: "wrapCells",
          displayName: "Wrap text",
          default: false,
        },
      ],
    });

    return Boolean(registered);
  } catch (err) {
    console.debug("[DBUI] registerBasesView optional integration failed:", err);
    return false;
  }
}
