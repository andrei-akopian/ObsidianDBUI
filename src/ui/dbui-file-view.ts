import { TextFileView, WorkspaceLeaf } from "obsidian";
import { DEFAULT_DB_CONFIG, VIEW_TYPE_DBUI } from "../constants";
import { DBConfig } from "../types";
import { DBTableView } from "./table-view";

export class DBUIFileView extends TextFileView {
  private tableView: DBTableView | null = null;
  private currentConfig: DBConfig = DEFAULT_DB_CONFIG;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_DBUI;
  }

  getDisplayText(): string {
    return this.file ? this.file.basename : "Database View";
  }

  getViewData(): string {
    if (this.tableView) {
      return JSON.stringify(this.tableView.getConfig(), null, 2);
    }
    return JSON.stringify(this.currentConfig, null, 2);
  }

  async setViewData(data: string, clear: boolean): Promise<void> {
    if (clear && this.tableView) {
      this.tableView.destroy();
      this.tableView = null;
      this.contentEl.empty();
    }

    try {
      this.currentConfig = data.trim()
        ? Object.assign({}, DEFAULT_DB_CONFIG, JSON.parse(data))
        : Object.assign({}, DEFAULT_DB_CONFIG);
    } catch (err) {
      console.warn("[DBUI] Could not parse DBUI file data, using defaults.", err);
      this.currentConfig = Object.assign({}, DEFAULT_DB_CONFIG);
    }

    if (!this.tableView) {
      this.tableView = new DBTableView(
        this.app,
        this.contentEl,
        this.currentConfig,
        this.file,
        async (cfg) => {
          this.currentConfig = cfg;
          this.requestSave();
        }
      );
      await this.tableView.load();
    } else {
      this.tableView.setConfig(this.currentConfig);
    }
  }

  clear(): void {
    if (this.tableView) {
      this.tableView.destroy();
      this.tableView = null;
    }
    this.contentEl.empty();
  }

  async onClose(): Promise<void> {
    this.clear();
  }
}
