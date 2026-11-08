import { App, TFile, TFolder } from "obsidian";
import { ColumnConfig, DataType, RowData } from "../types";
import { parseDate } from "../utils/date-utils";
import { normalizeTag } from "../utils/string-utils";
import { FrontmatterManager } from "./frontmatter-manager";

export interface DiscoveredProperty {
  key: string;
  name: string;
  type: DataType;
  count: number;
}

export class VaultScanner {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Get all folders in the vault.
   */
  getAllFolders(): { path: string; name: string }[] {
    const folders: { path: string; name: string }[] = [];
    const files = this.app.vault.getAllLoadedFiles();
    folders.push({ path: "", name: "/ (Vault Root)" });
    for (const f of files) {
      if (f instanceof TFolder && f.path) {
        folders.push({ path: f.path, name: f.path });
      }
    }
    folders.sort((a, b) => a.name.localeCompare(b.name));
    return folders;
  }

  /**
   * Get all markdown files in a folder.
   */
  getNotesInFolder(folderPath: string, includeSubfolders = true): TFile[] {
    const targetPath = folderPath.trim();
    const files = this.app.vault.getMarkdownFiles();
    return files.filter((file) => {
      const parentPath = file.parent ? file.parent.path : "";
      if (!targetPath) {
        return includeSubfolders ? true : parentPath === "";
      }
      if (parentPath === targetPath) {
        return true;
      }
      if (includeSubfolders && parentPath.startsWith(targetPath + "/")) {
        return true;
      }
      return false;
    });
  }

  /**
   * Build RowData list from files with optimistic cache awareness.
   */
  buildRows(files: TFile[]): RowData[] {
    return files.map((file) => {
      const cache = this.app.metadataCache.getFileCache(file);
      const fm = cache?.frontmatter || {};
      const values: Record<string, any> = {
        "file.name": file.basename,
      };

      for (const [k, v] of Object.entries(fm)) {
        if (k !== "position") {
          // Check if there is an optimistic value waiting to be reflected
          const opt = FrontmatterManager.getOptimisticValue(file.path, k);
          const val = opt.has ? opt.value : v;
          values[k] = val;
          // Also set normalized lowercase key for resilient lookup
          values[k.toLowerCase()] = val;
        }
      }

      return {
        file,
        basename: file.basename,
        path: file.path,
        values,
      };
    });
  }

  /**
   * Get all unique properties present across notes in the folder.
   */
  getDiscoveredPropertiesInFolder(rows: RowData[]): DiscoveredProperty[] {
    const map = new Map<string, { type: DataType; count: number }>();

    for (const row of rows) {
      for (const [rawKey, val] of Object.entries(row.values)) {
        if (rawKey === "position" || rawKey === "file.name") continue;
        const key = rawKey.toLowerCase();
        if (val !== undefined && val !== null && val !== "") {
          const existing = map.get(key);
          if (!existing) {
            map.set(key, {
              type: this.inferDataType(val, key),
              count: 1,
            });
          } else {
            existing.count++;
          }
        }
      }
    }

    const result: DiscoveredProperty[] = [];
    for (const [key, info] of map.entries()) {
      result.push({
        key,
        name: this.formatKeyToDisplayName(key),
        type: info.type,
        count: info.count,
      });
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Auto-discover properties across all notes in the folder and infer their types.
   */
  discoverColumns(
    rows: RowData[],
    existingColumns: ColumnConfig[]
  ): ColumnConfig[] {
    const columnMap = new Map<string, ColumnConfig>();
    for (const col of existingColumns) {
      columnMap.set(col.key.toLowerCase(), { ...col });
    }

    // Ensure file.name column is always present as first column
    if (!columnMap.has("file.name")) {
      columnMap.set("file.name", {
        key: "file.name",
        name: "Name",
        type: "file",
        width: 220,
        visible: true,
        wrap: false,
      });
    }

    // Scan all rows for unique frontmatter keys
    for (const row of rows) {
      for (const [key, val] of Object.entries(row.values)) {
        if (key === "position") continue;
        const lowerKey = key.toLowerCase();
        if (!columnMap.has(lowerKey)) {
          const inferredType = this.inferDataType(val, key);
          columnMap.set(lowerKey, {
            key,
            name: this.formatKeyToDisplayName(key),
            type: inferredType,
            width: inferredType === "checkbox" ? 80 : 160,
            visible: true,
            wrap: false,
            numberFormat: inferredType === "number" ? "plain" : undefined,
            dateFormat: inferredType === "date" ? "relative" : undefined,
          });
        }
      }
    }

    // Preserve existing column ordering, then append any newly discovered columns
    const result: ColumnConfig[] = [];
    const added = new Set<string>();

    for (const col of existingColumns) {
      const lowerKey = col.key.toLowerCase();
      if (columnMap.has(lowerKey)) {
        result.push(columnMap.get(lowerKey)!);
        added.add(lowerKey);
      }
    }

    for (const [lowerKey, col] of columnMap.entries()) {
      if (!added.has(lowerKey)) {
        result.push(col);
        added.add(lowerKey);
      }
    }

    return result;
  }

  /**
   * Infer data type from sample value and key name.
   */
  inferDataType(val: any, key: string): DataType {
    const lowerKey = key.toLowerCase();
    if (lowerKey === "status") return "status";
    if (lowerKey.includes("tag") || lowerKey.includes("genre") || lowerKey.includes("category")) {
      return "multi-tag";
    }
    if (lowerKey.includes("date") || lowerKey.includes("created") || lowerKey.includes("deadline")) {
      return "date";
    }

    if (val === null || val === undefined) return "text";
    if (typeof val === "boolean") return "checkbox";
    if (typeof val === "number") return "number";
    if (Array.isArray(val)) return "multi-tag";
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed === "true" || trimmed === "false") return "checkbox";
      if (!isNaN(Number(trimmed)) && trimmed !== "") return "number";
      if (parseDate(trimmed)) return "date";
    }
    return "text";
  }

  /**
   * Format frontmatter key to human friendly title (e.g. "parent_item" -> "Parent Item").
   */
  formatKeyToDisplayName(key: string): string {
    if (key === "file.name") return "Name";
    return key
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  /**
   * Collect all tags across vault and database notes.
   */
  getAllVaultTags(rows: RowData[]): string[] {
    const tagSet = new Set<string>();

    // 1. Vault metadataCache tags
    const vaultTags = (this.app.metadataCache as any).getTags?.() || {};
    for (const tag of Object.keys(vaultTags)) {
      const clean = normalizeTag(tag);
      if (clean) tagSet.add(clean);
    }

    // 2. Frontmatter values in current rows
    for (const row of rows) {
      for (const val of Object.values(row.values)) {
        if (Array.isArray(val)) {
          for (const item of val) {
            if (typeof item === "string") {
              const clean = normalizeTag(item);
              if (clean) tagSet.add(clean);
            }
          }
        } else if (typeof val === "string" && val.startsWith("#")) {
          const clean = normalizeTag(val);
          if (clean) tagSet.add(clean);
        }
      }
    }

    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }
}
