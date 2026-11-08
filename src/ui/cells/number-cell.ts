import { ColumnConfig, RowData } from "../../types";

export class NumberCell {
  static render(
    container: HTMLElement,
    row: RowData,
    column: ColumnConfig,
    onCommit: (newValue: any) => Promise<void>
  ): void {
    const rawVal = row.values[column.key];
    const num = rawVal !== undefined && rawVal !== null && rawVal !== "" ? Number(rawVal) : null;
    const format = column.numberFormat || "plain";
    const maxVal = column.numberMax || 100;

    container.empty();
    const wrapper = container.createDiv({ cls: `dbui-number-cell dbui-format-${format}` });

    if (num === null || isNaN(num)) {
      wrapper.createSpan({ cls: "dbui-cell-placeholder", text: "" });
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
      this.startEditing(container, num !== null ? String(num) : "", onCommit);
    });
  }

  static startEditing(
    container: HTMLElement,
    initialVal: string,
    onCommit: (newValue: any) => Promise<void>
  ): void {
    container.empty();
    const input = container.createEl("input", {
      type: "number",
      cls: "dbui-cell-input",
      value: initialVal,
    });

    input.focus();
    input.select();

    let committed = false;
    const commit = async () => {
      if (committed) return;
      committed = true;
      const raw = input.value.trim();
      if (!raw) {
        await onCommit(null);
      } else {
        const n = Number(raw);
        await onCommit(isNaN(n) ? raw : n);
      }
    };

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") {
        input.blur();
      } else if (evt.key === "Escape") {
        committed = true;
        container.empty();
        container.createSpan({ cls: "dbui-number-plain", text: initialVal });
      }
    });
  }
}
