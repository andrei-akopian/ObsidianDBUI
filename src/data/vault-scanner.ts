import { App, TFile, TFolder } from "obsidian";
import { ColumnConfig, DataType, RowData, StatusOption } from "../types";
import { parseDate } from "../utils/date-utils";
import { normalizeTag } from "../utils/string-utils";
import { FrontmatterManager } from "./frontmatter-manager";
import { getRowValue, toNumeric } from "./value-processor";

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
   * Get all markdown files in a folder, safely handling root path and subfolders.
   */
  getNotesInFolder(folderPath: string, includeSubfolders = true): TFile[] {
    const targetPath = folderPath ? folderPath.trim().replace(/^\/+|\/+$/g, "") : "";
    const files = this.app.vault.getMarkdownFiles();

    return files.filter((file) => {
      const rawParent = file.parent ? file.parent.path : "";
      const parentPath = rawParent === "/" ? "" : rawParent.replace(/^\/+|\/+$/g, "");

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
   * Build RowData list from files with case-resilient property mapping and optimistic cache.
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
          // Store lowercase key for case-insensitive lookup
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
    const map = new Map<string, { key: string; values: any[]; count: number }>();

    for (const row of rows) {
      for (const [rawKey, val] of Object.entries(row.values)) {
        if (rawKey === "position" || rawKey.toLowerCase() === "file.name") continue;
        const lowerKey = rawKey.toLowerCase();
        if (val !== undefined && val !== null && val !== "") {
          const existing = map.get(lowerKey);
          if (!existing) {
            map.set(lowerKey, {
              key: rawKey,
              values: [val],
              count: 1,
            });
          } else {
            existing.count++;
            if (existing.values.length < 20) {
              existing.values.push(val);
            }
          }
        }
      }
    }

    const result: DiscoveredProperty[] = [];
    for (const [lowerKey, info] of map.entries()) {
      const inferredType = this.inferMajorityType(info.values, info.key);
      result.push({
        key: info.key,
        name: this.formatKeyToDisplayName(info.key),
        type: inferredType,
        count: info.count,
      });
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Auto-discover properties across notes, strictly respecting removed keys.
   */
  discoverColumns(
    rows: RowData[],
    existingColumns: ColumnConfig[],
    removedKeys: string[] = []
  ): ColumnConfig[] {
    const columnMap = new Map<string, ColumnConfig>();
    const removedSet = new Set(removedKeys.map((k) => k.toLowerCase()));

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

    // Collect values per key to infer accurate types
    const keySamples = new Map<string, { originalKey: string; samples: any[] }>();

    for (const row of rows) {
      for (const [key, val] of Object.entries(row.values)) {
        if (key === "position") continue;
        const lowerKey = key.toLowerCase();
        if (!columnMap.has(lowerKey) && !removedSet.has(lowerKey)) {
          if (!keySamples.has(lowerKey)) {
            keySamples.set(lowerKey, { originalKey: key, samples: [] });
          }
          if (val !== null && val !== undefined && val !== "") {
            const entry = keySamples.get(lowerKey)!;
            if (entry.samples.length < 15) {
              entry.samples.push(val);
            }
          }
        }
      }
    }

    // Add newly discovered columns that were not removed
    for (const [lowerKey, entry] of keySamples.entries()) {
      if (!columnMap.has(lowerKey)) {
        const inferredType = this.inferMajorityType(entry.samples, entry.originalKey);
        const options = inferredType === "status" ? this.scanStatusOptions(rows, entry.originalKey) : undefined;
        columnMap.set(lowerKey, {
          key: entry.originalKey,
          name: this.formatKeyToDisplayName(entry.originalKey),
          type: inferredType,
          width: inferredType === "checkbox" ? 80 : 160,
          visible: true,
          wrap: false,
          numberFormat: inferredType === "number" ? "plain" : undefined,
          dateFormat: inferredType === "date" ? "relative" : undefined,
          options,
        });
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
   * Scan all unique status values for a column across all rows.
   */
  scanStatusOptions(rows: RowData[], colKey: string): StatusOption[] {
    const set = new Set<string>();
    for (const r of rows) {
      const val = getRowValue(r.values, colKey);
      if (val !== null && val !== undefined && val !== "") {
        const s = String(val).trim();
        if (s) set.add(s);
      }
    }
    return Array.from(set).sort().map((label, idx) => ({
      id: `status-${idx}`,
      label,
      color: "",
    }));
  }

  /**
   * Infer type by examining the majority of sampled non-empty values.
   */
  private inferMajorityType(samples: any[], key: string): DataType {
    const typeVotes = new Map<DataType, number>();
    for (const val of samples) {
      const t = this.inferDataType(val, key);
      typeVotes.set(t, (typeVotes.get(t) || 0) + 1);
    }

    let bestType: DataType = "text";
    let bestVotes = 0;
    for (const [t, count] of typeVotes.entries()) {
      if (count > bestVotes) {
        bestVotes = count;
        bestType = t;
      }
    }

    return bestType;
  }

  /**
   * Infer data type from sample value and key name using strict rules and whole word boundaries.
   */
  inferDataType(val: any, key: string): DataType {
    const lowerKey = key.toLowerCase();

    // Check Obsidian's metadataTypeManager if available
    const appAny = this.app as any;
    if (appAny.metadataTypeManager?.getPropertyType) {
      const obsidianType = appAny.metadataTypeManager.getPropertyType(lowerKey);
      if (obsidianType === "checkbox") return "checkbox";
      if (obsidianType === "number") return "number";
      if (obsidianType === "date") return "date";
      if (obsidianType === "datetime") return "time";
      if (obsidianType === "tags" || obsidianType === "multitext") return "multi-tag";
      if (obsidianType === "text") return "text";
    }

    if (lowerKey === "status") return "status";

    // Whole-word matching for tags
    if (/(?:^|[_\s-])(tags?|genre|genres|category|categories)(?:$|[_\s-])/i.test(key)) {
      return "multi-tag";
    }

    // Whole-word matching for dates (avoiding 'candidate', 'created_by')
    if (/(?:^|[_\s-])(date|deadline|due|published|created_at|updated_at)(?:$|[_\s-])/i.test(key)) {
      return "date";
    }

    if (val === null || val === undefined) return "text";
    if (typeof val === "boolean") return "checkbox";
    if (typeof val === "number") return "number";
    if (Array.isArray(val)) return "multi-tag";

    if (typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed.toLowerCase() === "true" || trimmed.toLowerCase() === "false") return "checkbox";
      if (toNumeric(trimmed) !== null) return "number";
      if (parseDate(trimmed) !== null) return "date";
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
