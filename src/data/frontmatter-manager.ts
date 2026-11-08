import { App, normalizePath, Notice, stringifyYaml, TFile, TFolder } from "obsidian";
import { DataType } from "../types";
import { normalizeTag } from "../utils/string-utils";
import { toBool, toNumeric } from "./value-processor";

export class FrontmatterManager {
  private app: App;
  private static optimisticCache = new Map<string, { value: any; timestamp: number }>();

  constructor(app: App) {
    this.app = app;
  }

  static setOptimisticValue(filePath: string, key: string, value: any): void {
    const cacheKey = `${filePath}::${key.toLowerCase()}`;
    this.optimisticCache.set(cacheKey, { value, timestamp: Date.now() });
  }

  static getOptimisticValue(filePath: string, key: string): { has: boolean; value: any } {
    const cacheKey = `${filePath}::${key.toLowerCase()}`;
    const entry = this.optimisticCache.get(cacheKey);
    if (!entry) return { has: false, value: undefined };
    // Keep optimistic value valid for 3 seconds
    if (Date.now() - entry.timestamp > 3000) {
      this.optimisticCache.delete(cacheKey);
      return { has: false, value: undefined };
    }
    return { has: true, value: entry.value };
  }

  /**
   * Validate a note filename to prevent illegal filesystem and obsidian markdown characters.
   */
  static isValidFileName(name: string): { valid: boolean; reason?: string } {
    const trimmed = name.trim();
    if (!trimmed) {
      return { valid: false, reason: "Filename cannot be empty." };
    }
    // Illegal OS characters and Obsidian link syntax characters
    if (/[\/\\:*?"<>|#^\[\]]/.test(trimmed)) {
      return {
        valid: false,
        reason: 'Filename cannot contain \\ / : * ? " < > | # ^ [ ]',
      };
    }
    return { valid: true };
  }

  /**
   * Update a property in a note's frontmatter.
   */
  async updateProperty(
    file: TFile,
    key: string,
    value: any,
    type?: DataType
  ): Promise<boolean> {
    if (!file || !key) return false;

    // Handle renaming the file
    if (key === "file.name") {
      const newName = String(value).trim();
      if (!newName || newName === file.basename) return true;

      const validation = FrontmatterManager.isValidFileName(newName);
      if (!validation.valid) {
        new Notice(validation.reason || "Invalid note name.");
        return false;
      }

      const parentPath = file.parent ? file.parent.path : "";
      const ext = file.extension ? `.${file.extension}` : ".md";
      const newPath = normalizePath(parentPath ? `${parentPath}/${newName}${ext}` : `${newName}${ext}`);
      try {
        await this.app.fileManager.renameFile(file, newPath);
        return true;
      } catch (err) {
        new Notice(`Failed to rename file: ${err}`);
        return false;
      }
    }

    // Coerce value based on data type
    let finalValue: any = value;
    if (value === null || value === undefined || value === "") {
      finalValue = null;
    } else if (type === "checkbox") {
      finalValue = toBool(value);
    } else if (type === "number") {
      const num = toNumeric(value);
      finalValue = num !== null ? num : value;
    } else if (type === "multi-tag") {
      if (Array.isArray(value)) {
        const arr = value
          .map((v) => (typeof v === "string" ? normalizeTag(v) : String(v)))
          .filter(Boolean);
        finalValue = arr.length > 0 ? arr : null;
      } else if (typeof value === "string") {
        const arr = value
          .split(",")
          .map((s) => normalizeTag(s))
          .filter(Boolean);
        finalValue = arr.length > 0 ? arr : null;
      } else {
        finalValue = [String(value)];
      }
    } else if (type === "tag") {
      if (Array.isArray(value)) {
        const first = value[0];
        finalValue = first ? normalizeTag(String(first)) : null;
      } else {
        finalValue = normalizeTag(String(value)) || null;
      }
    }

    // Store in optimistic cache immediately
    FrontmatterManager.setOptimisticValue(file.path, key, finalValue);

    try {
      await this.app.fileManager.processFrontMatter(file, (fm) => {
        // Find existing keys case-insensitively to avoid duplicates like "Status" vs "status"
        const existingKeys = Object.keys(fm).filter(
          (k) => k.toLowerCase() === key.toLowerCase()
        );
        const targetKey = existingKeys.length > 0 ? existingKeys[0] : key;

        // Clean up only duplicate keys (leaving the original targetKey in place)
        for (let i = 1; i < existingKeys.length; i++) {
          delete fm[existingKeys[i]];
        }

        if (finalValue === null || finalValue === undefined || finalValue === "") {
          delete fm[targetKey];
          return;
        }

        // Assign in-place preserving property position in YAML
        fm[targetKey] = finalValue;
      });
      return true;
    } catch (err) {
      console.error("[DBUI] Error updating frontmatter:", err);
      // Remove failed optimistic value
      FrontmatterManager.optimisticCache.delete(`${file.path}::${key.toLowerCase()}`);
      new Notice(`Failed to update property "${key}": ${err}`);
      return false;
    }
  }

  /**
   * Create a new note in a target folder using stringifyYaml for safe YAML serialization.
   */
  async createNote(
    folderPath: string,
    initialValues: Record<string, any> = {}
  ): Promise<TFile | null> {
    const parent = folderPath ? this.app.vault.getAbstractFileByPath(folderPath) : this.app.vault.getRoot();
    if (folderPath && !(parent instanceof TFolder)) {
      new Notice(`Folder "${folderPath}" does not exist.`);
      return null;
    }

    // Find unique file name
    const basePath = folderPath ? normalizePath(folderPath) : "";
    let baseName = "Untitled";
    let candidatePath = normalizePath(basePath ? `${basePath}/${baseName}.md` : `${baseName}.md`);
    let counter = 1;

    while (this.app.vault.getAbstractFileByPath(candidatePath)) {
      baseName = `Untitled ${counter++}`;
      candidatePath = normalizePath(basePath ? `${basePath}/${baseName}.md` : `${baseName}.md`);
    }

    // Prepare frontmatter data object
    const fmKeys = Object.keys(initialValues).filter((k) => k !== "file.name");
    const fmData: Record<string, any> = {};

    for (const k of fmKeys) {
      const val = initialValues[k];
      if (val !== undefined && val !== null && val !== "") {
        fmData[k] = val;
      }
    }

    let content = "";
    if (Object.keys(fmData).length > 0) {
      content = `---\n${stringifyYaml(fmData)}---\n\n`;
    }

    try {
      const file = await this.app.vault.create(candidatePath, content);
      return file;
    } catch (err) {
      console.error("[DBUI] Failed to create note:", err);
      new Notice(`Failed to create note: ${err}`);
      return null;
    }
  }

  /**
   * Delete a note (move to trash) respecting user's Obsidian deletion preference.
   */
  async deleteNote(file: TFile): Promise<boolean> {
    try {
      await this.app.fileManager.trashFile(file);
      new Notice(`Moved "${file.basename}" to trash.`);
      return true;
    } catch (err) {
      new Notice(`Failed to delete note: ${err}`);
      return false;
    }
  }
}
