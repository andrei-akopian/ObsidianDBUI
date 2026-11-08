import { App, Modal, setIcon } from "obsidian";
import { DataType } from "../../types";

export interface TypeCompatibilityCheck {
  incompatible: boolean;
  reason: string;
  affectedNotes: { basename: string; sampleValue: any }[];
}

export function checkTypeCompatibility(
  oldType: DataType,
  newType: DataType,
  columnKey: string,
  rows: { basename: string; values: Record<string, any> }[]
): TypeCompatibilityCheck {
  if (oldType === newType) {
    return { incompatible: false, reason: "", affectedNotes: [] };
  }

  // Filter notes that actually have a value for this property
  const affected: { basename: string; sampleValue: any }[] = [];
  for (const r of rows) {
    const val = r.values[columnKey];
    if (val !== undefined && val !== null && val !== "") {
      if (!Array.isArray(val) || val.length > 0) {
        affected.push({ basename: r.basename, sampleValue: val });
      }
    }
  }

  if (affected.length === 0) {
    // No notes have values, safe to change
    return { incompatible: false, reason: "", affectedNotes: [] };
  }

  // 1. Multi-tag / Tag to primitive types
  if ((oldType === "multi-tag" || oldType === "tag") && (newType === "checkbox" || newType === "number" || newType === "date" || newType === "time")) {
    return {
      incompatible: true,
      reason: `Tag list cannot be converted to a ${newType}.`,
      affectedNotes: affected,
    };
  }

  // 2. Conversion to Checkbox
  if (newType === "checkbox") {
    // Incompatible if values are not boolean or "true"/"false"
    const hasNonBoolean = affected.some((a) => {
      const v = String(a.sampleValue).trim().toLowerCase();
      return v !== "true" && v !== "false";
    });
    if (hasNonBoolean) {
      return {
        incompatible: true,
        reason: `Existing text or status values cannot be converted to checkboxes.`,
        affectedNotes: affected,
      };
    }
  }

  // 3. Conversion to Number
  if (newType === "number") {
    const hasNonNumber = affected.some((a) => {
      if (Array.isArray(a.sampleValue)) return true;
      const num = Number(a.sampleValue);
      return isNaN(num);
    });
    if (hasNonNumber) {
      return {
        incompatible: true,
        reason: `Existing text or status values contain non-numeric data.`,
        affectedNotes: affected,
      };
    }
  }

  // 4. Conversion to Date / Time
  if (newType === "date" || newType === "time") {
    const hasNonDate = affected.some((a) => {
      if (Array.isArray(a.sampleValue)) return true;
      const str = String(a.sampleValue).trim();
      const isDate = /^\d{4}-\d{2}-\d{2}/.test(str) || !isNaN(Date.parse(str));
      return !isDate;
    });
    if (hasNonDate) {
      return {
        incompatible: true,
        reason: `Existing values are not valid dates (YYYY-MM-DD).`,
        affectedNotes: affected,
      };
    }
  }

  // 5. Status to Checkbox or Number
  if (oldType === "status" && (newType === "checkbox" || newType === "number")) {
    return {
      incompatible: true,
      reason: `Status options cannot be represented as a ${newType}.`,
      affectedNotes: affected,
    };
  }

  return { incompatible: false, reason: "", affectedNotes: [] };
}

export class TypeWarningModal extends Modal {
  private colName: string;
  private oldType: DataType;
  private newType: DataType;
  private check: TypeCompatibilityCheck;
  private onConfirm: () => void;
  private onCancel: () => void;

  constructor(
    app: App,
    colName: string,
    oldType: DataType,
    newType: DataType,
    check: TypeCompatibilityCheck,
    onConfirm: () => void,
    onCancel: () => void
  ) {
    super(app);
    this.colName = colName;
    this.oldType = oldType;
    this.newType = newType;
    this.check = check;
    this.onConfirm = onConfirm;
    this.onCancel = onCancel;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("dbui-warning-modal");

    // Header
    const header = contentEl.createDiv({ cls: "dbui-modal-header" });
    const iconSpan = header.createSpan({ cls: "dbui-warning-icon" });
    setIcon(iconSpan, "alert-triangle");
    header.createEl("h3", { text: `Change property type to ${this.newType}?` });

    // Warning text
    const desc = contentEl.createDiv({ cls: "dbui-modal-desc" });
    desc.createEl("p", {
      text: `Changing "${this.colName}" from ${this.oldType} to ${this.newType} may cause existing data to be lost or displayed incorrectly.`,
    });

    if (this.check.reason) {
      const reasonEl = desc.createDiv({ cls: "dbui-warning-reason" });
      reasonEl.createSpan({ text: `Reason: ${this.check.reason}` });
    }

    // Affected notes preview
    const count = this.check.affectedNotes.length;
    desc.createEl("p", {
      cls: "dbui-affected-count",
      text: `${count} note${count > 1 ? "s" : ""} have values for this property:`,
    });

    const samplesList = contentEl.createDiv({ cls: "dbui-samples-list" });
    const previewList = this.check.affectedNotes.slice(0, 5);
    for (const note of previewList) {
      const item = samplesList.createDiv({ cls: "dbui-sample-item" });
      item.createSpan({ cls: "dbui-sample-name", text: note.basename });
      const displayVal = Array.isArray(note.sampleValue)
        ? `[${note.sampleValue.join(", ")}]`
        : String(note.sampleValue);
      item.createSpan({ cls: "dbui-sample-val", text: displayVal });
    }
    if (count > 5) {
      samplesList.createDiv({
        cls: "dbui-sample-more",
        text: `...and ${count - 5} more note${count - 5 > 1 ? "s" : ""}`,
      });
    }

    // Action buttons
    const btnRow = contentEl.createDiv({ cls: "dbui-modal-btn-row" });

    const cancelBtn = btnRow.createEl("button", {
      cls: "dbui-btn",
      text: "Cancel",
    });
    cancelBtn.addEventListener("click", () => {
      this.close();
      this.onCancel();
    });

    const confirmBtn = btnRow.createEl("button", {
      cls: "dbui-btn dbui-btn-danger",
      text: "Change type anyway",
    });
    confirmBtn.addEventListener("click", () => {
      this.close();
      this.onConfirm();
    });
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
