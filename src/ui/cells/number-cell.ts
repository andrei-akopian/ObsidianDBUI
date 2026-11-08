import { toNumeric } from "../../data/value-processor";
import { ColumnConfig, RowData } from "../../types";

export class NumberCell {
  static render(
    container: HTMLElement,
    row: RowData,
    column: ColumnConfig,
    onCommit: (newValue: any) => Promise<void>
  ): void {
    const rawVal = row.values[column.key];
    const num = toNumeric(rawVal);
    const hasRaw = rawVal !== undefined && rawVal !== null && rawVal !== "";
    const format = column.numberFormat || "plain";
    const maxVal = column.numberMax || 100;

    container.empty();
    const wrapper = container.createDiv({ cls: `dbui-number-cell dbui-format-${format}` });

    if (!hasRaw) {
      wrapper.createSpan({ cls: "dbui-cell-placeholder", text: "" });
    } else if (num === null) {
      // Non-numeric raw value: display raw text with warning class to prevent silent data loss
      wrapper.createSpan({ cls: "dbui-number-invalid", text: String(rawVal) });
    } else if (format === "progress-bar") {
      const pct = Math.min(100, Math.max(0, Math.round((num / maxVal) * 100)));
      const barTrack = wrapper.createDiv({ cls: "dbui-progress-bar-track" });
      const barFill = barTrack.createDiv({ cls: "dbui-progress-bar-fill" });
      barFill.style.width = `${pct}%`;
      wrapper.createSpan({ cls: "dbui-progress-label", text: `${num}` });
    } else if (format === "progress-circle") {
      const pct = Math.min(100, Math.max(0, Math.round((num / maxVal) * 100)));
      const radius = 8;
      const circumference = 2 * Math.PI * radius;
      const strokeDashoffset = circumference - (pct / 100) * circumference;

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.classList.add("dbui-progress-circle-svg");

      const bgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      bgCircle.setAttribute("cx", "12");
      bgCircle.setAttribute("cy", "12");
      bgCircle.setAttribute("r", `${radius}`);
      bgCircle.classList.add("dbui-progress-circle-bg");
      svg.appendChild(bgCircle);

      const fgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      fgCircle.setAttribute("cx", "12");
      fgCircle.setAttribute("cy", "12");
      fgCircle.setAttribute("r", `${radius}`);
      fgCircle.classList.add("dbui-progress-circle-fg");
      fgCircle.style.strokeDasharray = `${circumference}`;
      fgCircle.style.strokeDashoffset = `${strokeDashoffset}`;
      svg.appendChild(fgCircle);

      wrapper.appendChild(svg);
      wrapper.createSpan({ cls: "dbui-progress-circle-label", text: `${num}` });
    } else {
      wrapper.createSpan({ cls: "dbui-number-plain", text: String(num) });
    }

    container.addEventListener("click", () => {
      if (container.querySelector(".dbui-cell-input")) return;
      const initialStr = num !== null ? String(num) : (hasRaw ? String(rawVal) : "");
      this.startEditing(container, initialStr, rawVal, num, onCommit);
    });
  }

  static startEditing(
    container: HTMLElement,
    initialStr: string,
    rawVal: any,
    currentNum: number | null,
    onCommit: (newValue: any) => Promise<void>
  ): void {
    container.empty();
    const input = container.createEl("input", {
      type: "text",
      cls: "dbui-cell-input",
      value: initialStr,
    });

    input.focus();
    input.select();

    let committed = false;
    const commit = async () => {
      if (committed) return;
      committed = true;
      const val = input.value.trim();

      if (val === "") {
        // Changed to empty -> commit null only if it originally had a value
        if (rawVal !== null && rawVal !== undefined && rawVal !== "") {
          await onCommit(null);
        } else {
          container.empty();
          container.createSpan({ cls: "dbui-cell-placeholder", text: "" });
        }
        return;
      }

      const parsedNum = toNumeric(val);
      if (parsedNum !== null) {
        if (parsedNum !== currentNum) {
          await onCommit(parsedNum);
        } else {
          // Unchanged number, re-render display
          container.empty();
          const wrapper = container.createDiv({ cls: "dbui-number-cell dbui-format-plain" });
          wrapper.createSpan({ cls: "dbui-number-plain", text: String(parsedNum) });
        }
      } else {
        // User entered a non-numeric string or didn't change invalid raw string
        if (val !== String(rawVal)) {
          await onCommit(val);
        } else {
          container.empty();
          const wrapper = container.createDiv({ cls: "dbui-number-cell" });
          wrapper.createSpan({ cls: "dbui-number-invalid", text: String(rawVal) });
        }
      }
    };

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") {
        input.blur();
      } else if (evt.key === "Escape") {
        committed = true;
        container.empty();
        const wrapper = container.createDiv({ cls: "dbui-number-cell" });
        if (currentNum !== null) {
          wrapper.createSpan({ cls: "dbui-number-plain", text: String(currentNum) });
        } else if (rawVal !== null && rawVal !== undefined && rawVal !== "") {
          wrapper.createSpan({ cls: "dbui-number-invalid", text: String(rawVal) });
        } else {
          wrapper.createSpan({ cls: "dbui-cell-placeholder", text: "" });
        }
      }
    });
  }
}
