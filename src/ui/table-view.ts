import { App, debounce, Debouncer, EventRef, Menu, Notice, TFile, TFolder } from "obsidian";
import { normalizeConfig } from "../data/config-manager";
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

  private rootEl!: HTMLElement;
  private toolbarEl!: HTMLElement;
  private tableContainerEl!: HTMLElement;
  private tableEl!: HTMLTableElement;
  private theadEl!: HTMLTableSectionElement;
  private tbodyEl!: HTMLTableSectionElement;
  private emptyContainerEl!: HTMLElement;

  private rawRows: RowData[] = [];
  private processedRows: RowData[] = [];
  private discoveredProps: DiscoveredProperty[] = [];
  private allVaultTags: string[] = [];
  private quickSearch = "";
  private eventRefs: EventRef[] = [];
  private debouncedRefresh!: Debouncer<[], void>;

  constructor(
    app: App,
    containerEl: HTMLElement,
    initialConfig?: DBConfig,
    file?: TFile | null,
    onSaveCallback?: (cfg: DBConfig) => Promise<void>
  ) {
    this.app = app;
    this.containerEl = containerEl;
    this.config = normalizeConfig(initialConfig);
    this.file = file || null;
    this.onSaveCallback = onSaveCallback;

    this.frontmatterManager = new FrontmatterManager(app);
    this.vaultScanner = new VaultScanner(app);

    this.buildDOM();
    this.registerVaultEvents();
  }

  private buildDOM(): void {
    this.containerEl.empty();
    this.rootEl = this.containerEl.createDiv({ cls: "dbui-root" });

    this.toolbarEl = this.rootEl.createDiv({ cls: "dbui-toolbar-container" });
    this.tableContainerEl = this.rootEl.createDiv({ cls: "dbui-table-container" });

    this.tableEl = this.tableContainerEl.createEl("table", { cls: "dbui-table" });
    this.theadEl = this.tableEl.createEl("thead");
    this.tbodyEl = this.tableEl.createEl("tbody");

    // Empty state container placed OUTSIDE the table to avoid cramped columns
    this.emptyContainerEl = this.tableContainerEl.createDiv({ cls: "dbui-empty-container" });
    this.emptyContainerEl.style.display = "none";

    // Global '/' shortcut inside table view (focuses search box)
    this.rootEl.addEventListener("keydown", (evt: KeyboardEvent) => {
      const target = evt.target as HTMLElement;
      const isInput =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (!isInput && evt.key === "/" && !evt.metaKey && !evt.ctrlKey && !evt.altKey) {
        evt.preventDefault();
        evt.stopPropagation();
        TableToolbar.focusSearch(this.toolbarEl);
      } else if ((evt.metaKey || evt.ctrlKey) && evt.key.toLowerCase() === "k") {
        evt.preventDefault();
        evt.stopPropagation();
        TableToolbar.focusSearch(this.toolbarEl);
      }
    });

    // Right-click empty container area opens context menu with "New note"
    this.tableContainerEl.addEventListener("contextmenu", (evt) => {
      const target = evt.target as HTMLElement;
      if (target.closest(".dbui-row") || target.closest(".dbui-th")) return;
      evt.preventDefault();
      const menu = new Menu();
      menu.addItem((item) => {
        item
          .setTitle("New note")
          .setIcon("plus")
          .onClick(async () => {
            await this.handleCreateNewNote();
          });
      });
      menu.showAtMouseEvent(evt);
    });
  }

  private isFileInSourceFolder(file: TFile): boolean {
    const targetFolder = this.config.folder.trim().replace(/^\/+|\/+$/g, "");
    const parentPath = file.parent ? file.parent.path.replace(/^\/+|\/+$/g, "") : "";

    if (!targetFolder) {
      return this.config.includeSubfolders !== false ? true : parentPath === "";
    }
    if (parentPath === targetFolder) return true;
    if (this.config.includeSubfolders !== false && parentPath.startsWith(targetFolder + "/")) {
      return true;
    }
    return false;
  }

  private registerVaultEvents(): void {
    this.debouncedRefresh = debounce(() => {
      // If user is currently editing or interacting with an open popover, defer refresh
      if (
        PopoverManager.hasActivePopover(this.rootEl) ||
        (this.rootEl.contains(document.activeElement) &&
          (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA"))
      ) {
        return;
      }
      this.refreshData(false);
    }, 250);

    // Watch metadata changes strictly within the source folder
    this.eventRefs.push(
      this.app.metadataCache.on("changed", (changedFile) => {
        if (changedFile.extension === "md" && this.isFileInSourceFolder(changedFile)) {
          this.debouncedRefresh();
        }
      })
    );

    // Watch vault creation / deletion / rename
    this.eventRefs.push(
      this.app.vault.on("create", (f) => {
        if (f instanceof TFile && f.extension === "md" && this.isFileInSourceFolder(f)) {
          this.debouncedRefresh();
        }
      })
    );
    this.eventRefs.push(
      this.app.vault.on("delete", (f) => {
        if (f instanceof TFile && f.extension === "md" && this.isFileInSourceFolder(f)) {
          this.debouncedRefresh();
        }
      })
    );
    this.eventRefs.push(
      this.app.vault.on("rename", (f, oldPath) => {
        // If the source folder itself was renamed
        if (f instanceof TFolder) {
          const normOld = oldPath.replace(/^\/+|\/+$/g, "");
          const currentNorm = this.config.folder.replace(/^\/+|\/+$/g, "");
          if (normOld && normOld === currentNorm) {
            this.config.folder = f.path;
            this.saveConfig();
            this.refreshData(false);
            return;
          }
        }
        if (f instanceof TFile && f.extension === "md") {
          if (this.isFileInSourceFolder(f) || oldPath.startsWith(this.config.folder)) {
            this.debouncedRefresh();
          }
        }
      })
    );
  }

  destroy(): void {
    if (this.debouncedRefresh) {
      this.debouncedRefresh.cancel();
    }
    PopoverManager.closeAll(this.rootEl);
    for (const ref of this.eventRefs) {
      this.app.metadataCache.offref(ref);
      this.app.vault.offref(ref);
    }
    this.eventRefs = [];
  }

  async load(): Promise<void> {
    await this.refreshData(true);
  }

  private filterAndSortRows(searchQuery = this.quickSearch): void {
    this.processedRows = FilterSorter.process(
      this.rawRows,
      this.config.filters,
      this.config.sort,
      searchQuery,
      this.config.columns,
      this.config
    );
  }

  async refreshData(discoverCols = false): Promise<void> {
    // 1. Scan notes in folder
    const notes = this.vaultScanner.getNotesInFolder(
      this.config.folder,
      this.config.includeSubfolders !== false
    );
    this.rawRows = this.vaultScanner.buildRows(notes);

    // 2. Discover columns on initial load or folder change, respecting removedKeys
    if (discoverCols) {
      const prevCount = this.config.columns.length;
      this.config.columns = this.vaultScanner.discoverColumns(
        this.rawRows,
        this.config.columns,
        this.config.removedKeys || []
      );
      if (this.config.columns.length !== prevCount) {
        await this.saveConfig();
      }
    }

    // 3. Track all discovered properties in folder
    this.discoveredProps = this.vaultScanner.getDiscoveredPropertiesInFolder(this.rawRows);

    // 4. Collect tags
    this.allVaultTags = this.vaultScanner.getAllVaultTags(this.rawRows);

    // 5. Datatype-aware filter and sort
    this.filterAndSortRows();

    // 6. Render
    this.render();
  }

  private render(): void {
    // Apply density & wrap classes
    this.rootEl.toggleClass("is-compact", this.config.settings.rowDensity === "compact");
    this.rootEl.toggleClass("is-wrap-cells", Boolean(this.config.settings.wrapCells));
    this.rootEl.toggleClass("is-search-active", Boolean(this.quickSearch && this.quickSearch.trim()));

    // Render Toolbar with quickSearch preserved
    TableToolbar.render(
      this.toolbarEl,
      this.app,
      this.config,
      this.discoveredProps,
      this.quickSearch,
      (query) => {
        this.quickSearch = query;
        this.filterAndSortRows();
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
        this.filterAndSortRows();
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
      this.rawRows, // pass rawRows so type checks cover all notes
      this.discoveredProps,
      this.app,
      this.frontmatterManager,
      async () => {
        await this.saveConfig();
        TableToolbar.updateBadges(this.toolbarEl, this.config);
      },
      () => {
        this.filterAndSortRows();
        this.renderHeaderAndBody();
      }
    );

    this.renderBody();
  }

  private renderBody(): void {
    const visibleColumns = this.config.columns.filter((c) => c.visible !== false);
    this.rootEl.toggleClass("is-search-active", Boolean(this.quickSearch && this.quickSearch.trim()));

    if (this.processedRows.length === 0) {
      this.tbodyEl.empty();
      this.emptyContainerEl.style.display = "flex";
      this.emptyContainerEl.empty();

      if (this.quickSearch && this.quickSearch.trim()) {
        this.emptyContainerEl.className = "dbui-empty-container is-search-empty";
        this.emptyContainerEl.createDiv({
          cls: "dbui-empty-title",
          text: `No notes matching "${this.quickSearch.trim()}".`,
        });
        const actions = this.emptyContainerEl.createDiv({ cls: "dbui-empty-actions" });
        const clearBtn = actions.createDiv({
          cls: "dbui-btn dbui-empty-create-btn",
          text: "Clear search",
        });
        clearBtn.addEventListener("click", () => {
          this.quickSearch = "";
          const searchInput = this.toolbarEl.querySelector(".dbui-search-input") as HTMLInputElement;
          if (searchInput) {
            searchInput.value = "";
            const clearIcon = this.toolbarEl.querySelector(".dbui-search-clear") as HTMLElement;
            if (clearIcon) clearIcon.style.display = "none";
          }
          this.filterAndSortRows("");
          this.render();
        });
      } else if (this.config.filters && this.config.filters.length > 0) {
        this.emptyContainerEl.className = "dbui-empty-container";
        this.emptyContainerEl.createDiv({
          cls: "dbui-empty-title",
          text: "No notes match active filters.",
        });
        const actions = this.emptyContainerEl.createDiv({ cls: "dbui-empty-actions" });
        const clearBtn = actions.createDiv({
          cls: "dbui-btn dbui-empty-create-btn",
          text: "Clear filters",
        });
        clearBtn.addEventListener("click", async () => {
          this.config.filters = [];
          await this.saveConfig();
          this.filterAndSortRows();
          this.renderHeaderAndBody();
          TableToolbar.updateBadges(this.toolbarEl, this.config);
        });
      } else {
        this.emptyContainerEl.className = "dbui-empty-container";
        this.emptyContainerEl.createDiv({
          cls: "dbui-empty-title",
          text: this.config.folder
            ? `No notes found in "${this.config.folder}".`
            : "No notes found in vault root.",
        });
        const actions = this.emptyContainerEl.createDiv({ cls: "dbui-empty-actions" });
        const createBtn = actions.createDiv({
          cls: "dbui-btn dbui-btn-primary dbui-empty-create-btn",
          text: "+ New note",
        });
        createBtn.addEventListener("click", async () => {
          await this.handleCreateNewNote();
        });
      }
      return;
    }

    // When rows exist, hide empty container and render table body
    this.emptyContainerEl.className = "dbui-empty-container";
    this.emptyContainerEl.style.display = "none";

    TableBody.render(
      this.tbodyEl,
      this.processedRows,
      visibleColumns,
      this.config,
      this.app,
      this.frontmatterManager,
      this.allVaultTags,
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
      new Notice(`Created "${created.basename}".`);

      // Scroll to newly created note and highlight it
      setTimeout(() => {
        const targetRow = this.tbodyEl.querySelector(
          `tr[data-path="${CSS.escape(created.path)}"]`
        ) as HTMLElement;
        if (targetRow) {
          targetRow.scrollIntoView({ block: "nearest", behavior: "smooth" });
          targetRow.addClass("dbui-row-newly-created");
          setTimeout(() => {
            targetRow.removeClass("dbui-row-newly-created");
          }, 1800);
        }
      }, 50);
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
    this.config = normalizeConfig(newConfig);
    this.refreshData(false);
  }

  getConfig(): DBConfig {
    return this.config;
  }
}
