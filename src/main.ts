import {
  addIcon,
  Menu,
  normalizePath,
  Notice,
  parseYaml,
  Plugin,
  TFile,
  TFolder,
  WorkspaceLeaf,
} from "obsidian";
import {
  DBUI_CODEBLOCK,
  DBUI_FILE_EXTENSION,
  DBUI_ICON_ID,
  DBUI_ICON_SVG,
  DEFAULT_DB_CONFIG,
  DEFAULT_SETTINGS,
  VIEW_TYPE_DBUI,
} from "./constants";
import { DBConfig, PluginSettings } from "./types";
import { registerBasesViewIfAvailable } from "./ui/bases-adapter";
import { DBUIFileView } from "./ui/dbui-file-view";
import { PopoverManager } from "./ui/popover-manager";
import { DBTableView } from "./ui/table-view";

export default class DBUIPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();

    // 1. Register custom FileView for .dbui files
    this.registerView(
      VIEW_TYPE_DBUI,
      (leaf: WorkspaceLeaf) => new DBUIFileView(leaf)
    );

    // 2. Register .dbui file extension
    this.registerExtensions([DBUI_FILE_EXTENSION], VIEW_TYPE_DBUI);

    // 3. Register Markdown Codeblock processor: ```dbui
    this.registerMarkdownCodeBlockProcessor(
      DBUI_CODEBLOCK,
      async (source, el, ctx) => {
        let config: DBConfig = JSON.parse(JSON.stringify(DEFAULT_DB_CONFIG));

        const trimmed = source.trim();
        if (trimmed) {
          try {
            // Check if YAML or JSON
            let parsed: any;
            if (trimmed.startsWith("{")) {
              parsed = JSON.parse(trimmed);
            } else {
              parsed = parseYaml(trimmed);
            }

            if (parsed && typeof parsed === "object") {
              // If referencing a .dbui file: `file: "ReadingList.dbui"`
              if (parsed.file) {
                const targetFile = this.app.vault.getFileByPath(parsed.file);
                if (targetFile) {
                  const content = await this.app.vault.read(targetFile);
                  config = Object.assign({}, DEFAULT_DB_CONFIG, JSON.parse(content));
                }
              } else {
                config = Object.assign({}, DEFAULT_DB_CONFIG, parsed);
              }
            }
          } catch (err) {
            console.error("[DBUI] Error parsing codeblock config:", err);
          }
        } else {
          // Default to folder of the current file
          const currentFile = this.app.vault.getFileByPath(ctx.sourcePath);
          if (currentFile && currentFile.parent) {
            config.folder = currentFile.parent.path;
          }
        }

        const tableView = new DBTableView(this.app, el, config, null, async (newCfg) => {
          // If codeblock references a file, save there
        });
        await tableView.load();

        // Clean up when codeblock is unloaded
        ctx.addChild({
          onload() {},
          onunload() {
            tableView.destroy();
          },
          containerEl: el,
        } as any);
      }
    );

    // 4. Try registering Obsidian Bases custom view
    registerBasesViewIfAvailable(this);

    // Register custom unique icon for DB UI in sidebar/ribbon
    addIcon(DBUI_ICON_ID, DBUI_ICON_SVG);

    // 5. Add Ribbon Icon
    this.addRibbonIcon(DBUI_ICON_ID, "DB UI: New Database Table", async () => {
      await this.createNewDatabaseFile("");
    });

    // 6. Commands
    this.addCommand({
      id: "create-dbui-table",
      name: "Create new database table",
      callback: async () => {
        const activeFile = this.app.workspace.getActiveFile();
        const folder = activeFile && activeFile.parent ? activeFile.parent.path : "";
        await this.createNewDatabaseFile(folder);
      },
    });

    // 7. Context Menu on Folders
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu: Menu, file) => {
        if (file instanceof TFolder) {
          menu.addItem((item) => {
            item
              .setTitle("New Database Table in this folder")
              .setIcon("table")
              .onClick(async () => {
                await this.createNewDatabaseFile(file.path);
              });
          });
        }
      })
    );
    // 8. Close floating menus/popovers on tab or layout change
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        PopoverManager.closeAll();
      })
    );
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        PopoverManager.closeAll();
      })
    );
  }

  async createNewDatabaseFile(folderPath = ""): Promise<TFile | null> {
    const parentPath = folderPath ? normalizePath(folderPath) : "";
    let baseName = "Database";
    let candidatePath = normalizePath(
      parentPath ? `${parentPath}/${baseName}.${DBUI_FILE_EXTENSION}` : `${baseName}.${DBUI_FILE_EXTENSION}`
    );
    let counter = 1;

    while (this.app.vault.getAbstractFileByPath(candidatePath)) {
      baseName = `Database ${counter++}`;
      candidatePath = normalizePath(
        parentPath ? `${parentPath}/${baseName}.${DBUI_FILE_EXTENSION}` : `${baseName}.${DBUI_FILE_EXTENSION}`
      );
    }

    const initialConfig: DBConfig = Object.assign({}, DEFAULT_DB_CONFIG, {
      folder: folderPath,
      includeSubfolders: true,
    });

    try {
      const file = await this.app.vault.create(
        candidatePath,
        JSON.stringify(initialConfig, null, 2)
      );
      new Notice(`Created database "${file.basename}".`);

      const leaf = this.app.workspace.getLeaf("tab");
      await leaf.openFile(file);
      return file;
    } catch (err) {
      new Notice(`Failed to create database: ${err}`);
      return null;
    }
  }

  onunload(): void {
    PopoverManager.closeAll();
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
