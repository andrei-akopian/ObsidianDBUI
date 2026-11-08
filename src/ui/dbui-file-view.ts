import { TextFileView, WorkspaceLeaf } from "obsidian";
import { normalizeConfig } from "../data/config-manager";
import { DEFAULT_DB_CONFIG, VIEW_TYPE_DBUI } from "../constants";
import { DBConfig } from "../types";
import { DBTableView } from "./table-view";

export class DBUIFileView extends TextFileView {
  private tableView: DBTableView | null = null;
  private currentConfig: DBConfig = DEFAULT_DB_CONFIG;
  private hasParseError = false;
  private rawContent = "";

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
    if (this.hasParseError) {
      // Never overwrite a corrupt file with defaults!
      return this.rawContent;
    }
    if (this.tableView) {
      return JSON.stringify(this.tableView.getConfig(), null, 2);
    }
    return JSON.stringify(this.currentConfig, null, 2);
  }

  async setViewData(data: string, clear: boolean): Promise<void> {
    this.rawContent = data;

    if (clear && this.tableView) {
      this.tableView.destroy();
      this.tableView = null;
      this.contentEl.empty();
    }

    const trimmed = data.trim();
    let parsed: any = null;

    if (trimmed) {
      try {
        parsed = JSON.parse(trimmed);
        this.hasParseError = false;
      } catch (err: any) {
        console.error("[DBUI] Could not parse DBUI file data:", err);
        this.hasParseError = true;
        this.clear();
        this.showParseErrorUI(data, err.message);
        return;
      }
    } else {
      parsed = {};
      this.hasParseError = false;
    }

    this.currentConfig = normalizeConfig(parsed);

    if (!this.tableView) {
      this.contentEl.empty();
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

  private showParseErrorUI(rawText: string, errorMsg: string): void {
    this.contentEl.empty();
    const container = this.contentEl.createDiv({ cls: "dbui-corrupt-file-container" });
    container.style.padding = "24px";
    container.style.maxWidth = "800px";
    container.style.margin = "0 auto";

    const title = container.createEl("h3", { text: "Database Configuration Error" });
    title.style.color = "var(--text-error, #e03131)";

    container.createEl("p", {
      text: "This .dbui file contains invalid JSON syntax. To protect your data, DB UI has stopped and will not overwrite this file with defaults.",
    });

    const callout = container.createDiv({ cls: "callout callout-error" });
    callout.style.padding = "12px";
    callout.style.backgroundColor = "var(--background-secondary)";
    callout.style.borderLeft = "4px solid var(--text-error, #e03131)";
    callout.style.marginBottom = "16px";
    callout.createEl("code", { text: errorMsg });

    container.createEl("h4", { text: "File Content:" });
    const pre = container.createEl("pre");
    pre.style.maxHeight = "300px";
    pre.style.overflow = "auto";
    pre.style.padding = "12px";
    pre.style.backgroundColor = "var(--background-primary-alt)";
    pre.style.borderRadius = "4px";
    pre.createEl("code", { text: rawText });
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
