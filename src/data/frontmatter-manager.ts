import { App, normalizePath, Notice, TFile, TFolder } from "obsidian";
import { DataType } from "../types";

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

    // Coerce value based on type
    let finalValue: any = value;
    if (value === null || value === undefined || value === "") {
      finalValue = null;
    } else if (type === "number") {
      const num = Number(value);
      finalValue = isNaN(num) ? value : num;
    } else if (type === "checkbox") {
      finalValue = Boolean(value);
    } else if (type === "multi-tag" || type === "tag") {
      if (Array.isArray(value)) {
        finalValue = value.length === 0 ? null : value;
      } else if (typeof value === "string") {
        const arr = value.split(",").map((s) => s.trim()).filter(Boolean);
        finalValue = arr.length > 1 ? arr : (arr[0] || null);
      } else {
        finalValue = value;
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

        // Clean up duplicates if any exist
        for (const k of existingKeys) {
          delete fm[k];
        }

        if (finalValue === null || finalValue === undefined || finalValue === "") {
          return;
        }

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
   * Create a new note in a target folder.
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

    // Prepare frontmatter YAML string
    const fmKeys = Object.keys(initialValues).filter((k) => k !== "file.name");
    let content = "";
    if (fmKeys.length > 0) {
      content += "---\n";
      for (const k of fmKeys) {
        const val = initialValues[k];
        if (val !== undefined && val !== null && val !== "") {
          if (Array.isArray(val)) {
            content += `${k}:\n${val.map((v) => `  - ${v}`).join("\n")}\n`;
          } else if (typeof val === "string") {
            content += `${k}: "${val.replace(/"/g, '\\"')}"\n`;
          } else {
            content += `${k}: ${val}\n`;
          }
        }
      }
      content += "---\n\n";
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
   * Rename a frontmatter key across all notes in a folder.
   */
  async renamePropertyAcrossFolder(
    files: TFile[],
    oldKey: string,
    newKey: string
  ): Promise<void> {
    if (!oldKey || !newKey || oldKey === newKey) return;
    for (const file of files) {
      await this.app.fileManager.processFrontMatter(file, (fm) => {
        const matchingKey = Object.keys(fm).find(
          (k) => k.toLowerCase() === oldKey.toLowerCase()
        );
        if (matchingKey && fm[matchingKey] !== undefined) {
          const val = fm[matchingKey];
          delete fm[matchingKey];
          fm[newKey] = val;
        }
      });
    }
    new Notice(`Renamed "${oldKey}" to "${newKey}" across ${files.length} notes.`);
  }

  /**
   * Delete a note (move to trash).
   */
  async deleteNote(file: TFile): Promise<boolean> {
    try {
      await this.app.vault.trash(file, false);
      new Notice(`Moved "${file.basename}" to trash.`);
      return true;
    } catch (err) {
      new Notice(`Failed to delete note: ${err}`);
      return false;
    }
  }
}
