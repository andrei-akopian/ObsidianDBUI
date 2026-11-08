import { App, debounce, EventRef, Notice, TFile } from "obsidian";
import { DEFAULT_DB_CONFIG } from "../constants";
import { FilterSorter } from "../data/filter-sorter";
import { FrontmatterManager } from "../data/frontmatter-manager";
import { DiscoveredProperty, VaultScanner } from "../data/vault-scanner";
import { DBConfig, RowData } from "../types";
import { TableBody } from "./components/table-body";
import { TableHeader } from "./components/table-header";
import { TableToolbar } from "./components/toolbar";
import { PopoverManager } from "./popover-manager";

export class DBTableView {
  private app: App;
  private containerEl: HTMLElement;
  private config: DBConfig;
  private file: TFile | null;
  private onSaveCallback?: (cfg: DBConfig) => Promise<void>;

  private frontmatterManager: FrontmatterManager;
  private vaultScanner: VaultScanner;

  private rootEl: HTMLElement;
  private toolbarEl: HTMLElement;
  private tableContainerEl: HTMLElement;
  private tableEl: HTMLTableElement;
  private theadEl: HTMLTableSectionElement;
  private tbodyEl: HTMLTableSectionElement;

  private rawRows: RowData[] = [];
  private processedRows: RowData[] = [];
  private discoveredProps: DiscoveredProperty[] = [];
  private allVaultTags: string[] = [];
  private quickSearch = "";
  private eventRefs: EventRef[] = [];

  constructor(
    app: App,
    containerEl: HTMLElement,
    initialConfig?: DBConfig,
    file?: TFile | null,
    onSaveCallback?: (cfg: DBConfig) => Promise<void>
  ) {
    this.app = app;
    this.containerEl = containerEl;
    this.config = initialConfig ? this.cloneConfig(initialConfig) : this.cloneConfig(DEFAULT_DB_CONFIG);
    this.file = file || null;
    this.onSaveCallback = onSaveCallback;

    this.frontmatterManager = new FrontmatterManager(app);
    this.vaultScanner = new VaultScanner(app);

    this.buildDOM();
    this.registerVaultEvents();
  }

  private cloneConfig(cfg: DBConfig): DBConfig {
    return JSON.parse(JSON.stringify(cfg));
  }

  private buildDOM(): void {
    this.containerEl.empty();
    this.rootEl = this.containerEl.createDiv({ cls: "dbui-root" });

    this.toolbarEl = this.rootEl.createDiv({ cls: "dbui-toolbar-container" });
    this.tableContainerEl = this.rootEl.createDiv({ cls: "dbui-table-container" });

    this.tableEl = this.tableContainerEl.createEl("table", { cls: "dbui-table" });
    this.theadEl = this.tableEl.createEl("thead");
    this.tbodyEl = this.tableEl.createEl("tbody");
  }

  private registerVaultEvents(): void {
    const debouncedRefresh = debounce(() => {
      this.refreshData(false);
    }, 200);

    // Watch metadata changes
    this.eventRefs.push(
      this.app.metadataCache.on("changed", (changedFile) => {
        if (changedFile.extension === "md") {
          debouncedRefresh();
        }
      })
    );

    // Watch vault creation / deletion / rename
    this.eventRefs.push(
      this.app.vault.on("create", (f) => {
        if (f instanceof TFile && f.extension === "md") debouncedRefresh();
      })
    );
    this.eventRefs.push(
      this.app.vault.on("delete", (f) => {
        if (f instanceof TFile && f.extension === "md") debouncedRefresh();
      })
    );
    this.eventRefs.push(
      this.app.vault.on("rename", (f) => {
        if (f instanceof TFile && f.extension === "md") debouncedRefresh();
      })
    );
  }

  destroy(): void {
    PopoverManager.closeAll();
    for (const ref of this.eventRefs) {
      this.app.metadataCache.offref(ref);
      this.app.vault.offref(ref);
    }
    this.eventRefs = [];
  }

  async load(): Promise<void> {
    await this.refreshData(true);
  }

  async refreshData(discoverCols = false): Promise<void> {
    // 1. Scan notes in folder
    const notes = this.vaultScanner.getNotesInFolder(
      this.config.folder,
      this.config.includeSubfolders !== false
    );
    this.rawRows = this.vaultScanner.buildRows(notes);

    // 2. Discover columns on initial load or folder change
    if (discoverCols) {
      this.config.columns = this.vaultScanner.discoverColumns(
        this.rawRows,
        this.config.columns
      );
      await this.saveConfig();
    }

    // 3. Track all discovered properties in folder
    this.discoveredProps = this.vaultScanner.getDiscoveredPropertiesInFolder(this.rawRows);

    // 4. Collect tags
    this.allVaultTags = this.vaultScanner.getAllVaultTags(this.rawRows);

    // 5. Filter and sort
    this.processedRows = FilterSorter.process(
      this.rawRows,
      this.config.filters,
      this.config.sort,
      this.quickSearch
    );

    // 6. Render
    this.render();
  }

  private render(): void {
    // Apply density & wrap classes
    this.rootEl.toggleClass("is-compact", this.config.settings.rowDensity === "compact");
    this.rootEl.toggleClass("is-wrap-cells", Boolean(this.config.settings.wrapCells));

    // Render Toolbar
    TableToolbar.render(
      this.toolbarEl,
      this.app,
      this.config,
      this.discoveredProps,
      (query) => {
        this.quickSearch = query;
        this.processedRows = FilterSorter.process(
          this.rawRows,
          this.config.filters,
          this.config.sort,
          this.quickSearch
        );
        this.renderBody();
      },
      async (newFolder) => {
        this.config.folder = newFolder;
        await this.saveConfig();
        await this.refreshData(true);
      },
      async () => {
        await this.handleCreateNewNote();
      },
      async () => {
        await this.saveConfig();
        TableToolbar.updateBadges(this.toolbarEl, this.config);
      },
      () => {
        this.processedRows = FilterSorter.process(
          this.rawRows,
          this.config.filters,
          this.config.sort,
          this.quickSearch
        );
        this.renderHeaderAndBody();
        TableToolbar.updateBadges(this.toolbarEl, this.config);
      }
    );

    this.renderHeaderAndBody();
  }

  private renderHeaderAndBody(): void {
    const visibleColumns = this.config.columns.filter((c) => c.visible !== false);
    TableHeader.render(
      this.theadEl,
      visibleColumns,
      this.config,
      this.processedRows,
      this.discoveredProps,
      this.app,
      this.frontmatterManager,
      async () => {
        await this.saveConfig();
        TableToolbar.updateBadges(this.toolbarEl, this.config);
      },
      () => {
        this.processedRows = FilterSorter.process(
          this.rawRows,
          this.config.filters,
          this.config.sort,
          this.quickSearch
        );
        this.renderBody();
      }
    );

    this.renderBody();
  }

  private renderBody(): void {
    const visibleColumns = this.config.columns.filter((c) => c.visible !== false);
    TableBody.render(
      this.tbodyEl,
      this.processedRows,
      visibleColumns,
      this.config,
      this.app,
      this.frontmatterManager,
      this.allVaultTags,
      this.quickSearch,
      () => {
        this.quickSearch = "";
        const searchInput = this.toolbarEl.querySelector(".dbui-search-input") as HTMLInputElement;
        if (searchInput) searchInput.value = "";
        this.processedRows = FilterSorter.process(
          this.rawRows,
          this.config.filters,
          this.config.sort,
          ""
        );
        this.renderBody();
      },
      async () => {
        await this.handleCreateNewNote();
      },
      async () => {
        await this.saveConfig();
        TableToolbar.updateBadges(this.toolbarEl, this.config);
      },
      () => {
        this.renderBody();
      }
    );
  }

  private async handleCreateNewNote(): Promise<void> {
    const initialValues: Record<string, any> = {};
    for (const col of this.config.columns) {
      if (col.key !== "file.name") {
        if (col.type === "checkbox") initialValues[col.key] = false;
        else if (col.type === "status" && col.options && col.options.length > 0) {
          initialValues[col.key] = col.options[0].label;
        }
      }
    }

    const created = await this.frontmatterManager.createNote(
      this.config.folder,
      initialValues
    );

    if (created) {
      await this.refreshData(false);
      // Reveal row
      new Notice(`Created "${created.basename}".`);
    }
  }

  async saveConfig(): Promise<void> {
    if (this.onSaveCallback) {
      await this.onSaveCallback(this.config);
      return;
    }

    if (this.file) {
      try {
        const content = JSON.stringify(this.config, null, 2);
        await this.app.vault.modify(this.file, content);
      } catch (err) {
        console.error("[DBUI] Error saving config:", err);
      }
    }
  }

  setConfig(newConfig: DBConfig): void {
    this.config = this.cloneConfig(newConfig);
    this.refreshData(false);
  }

  getConfig(): DBConfig {
    return this.config;
  }
}
