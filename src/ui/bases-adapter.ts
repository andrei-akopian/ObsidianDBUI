import * as obsidian from "obsidian";
import { App } from "obsidian";
import { DBConfig } from "../types";
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
        if (!this.dbTableView) {
          const app = (this as any).app as App;
          const folder = (this as any).controller?.sourceFolder || "";
          const config: Partial<DBConfig> = {
            folder: folder,
            includeSubfolders: true,
          };

          this.dbTableView = new DBTableView(
            app,
            this.rootDiv,
            config as DBConfig,
            null,
            async (cfg) => {
              // Saved in bases config
            }
          );
          this.dbTableView.load();
        } else {
          this.dbTableView.refreshData(false);
        }
      }

      onClose() {
        if (this.dbTableView) {
          this.dbTableView.destroy();
          this.dbTableView = null;
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
