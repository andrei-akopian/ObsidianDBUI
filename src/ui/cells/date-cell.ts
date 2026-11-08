import { ColumnConfig, RowData } from "../../types";
import { formatAbsoluteDate, formatDateWithFormat, isDateInFuture, isDateToday, parseDate } from "../../utils/date-utils";
import { PopoverManager } from "../popover-manager";

export class DateCell {
  static render(
    container: HTMLElement,
    row: RowData,
    column: ColumnConfig,
    onCommit: (newValue: any) => Promise<void>
  ): void {
    const rawVal = row.values[column.key];
    const parsed = parseDate(rawVal);
    const format = column.dateFormat || "relative";
    const includeTime = column.type === "time";

    container.empty();
    const wrapper = container.createDiv({ cls: "dbui-date-cell" });

    if (!parsed) {
      wrapper.createSpan({ cls: "dbui-cell-placeholder", text: "" });
    } else {
      const displayText = formatDateWithFormat(parsed, format, includeTime);
      const span = wrapper.createSpan({ cls: "dbui-date-text", text: displayText });

      if (isDateToday(parsed)) {
        span.addClass("is-today");
      } else if (isDateInFuture(parsed)) {
        span.addClass("is-future");
      }
    }

    container.addEventListener("click", (evt) => {
      evt.stopPropagation();
      this.openCalendarPopover(container, column, parsed, onCommit);
    });
  }

  static openCalendarPopover(
    anchor: HTMLElement,
    column: ColumnConfig,
    initialDate: Date | null,
    onCommit: (newValue: any) => Promise<void>
  ): void {
    const { el: popover, close, reposition } = PopoverManager.createPopover({
      anchor,
      cls: "dbui-calendar-popover",
    });

    const viewDate = initialDate ? new Date(initialDate.getTime()) : new Date();

    const renderCalendar = () => {
      popover.empty();

      // Header: Month, Year, and nav buttons
      const header = popover.createDiv({ cls: "dbui-calendar-header" });
      const prevBtn = header.createDiv({ cls: "dbui-calendar-nav-btn", text: "‹" });
      const titleSpan = header.createSpan({
        cls: "dbui-calendar-title",
        text: viewDate.toLocaleString("default", { month: "long", year: "numeric" }),
      });
      const nextBtn = header.createDiv({ cls: "dbui-calendar-nav-btn", text: "›" });

      prevBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        viewDate.setMonth(viewDate.getMonth() - 1);
        renderCalendar();
      });

      nextBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        viewDate.setMonth(viewDate.getMonth() + 1);
        renderCalendar();
      });

      // Days of week
      const dayHeaders = popover.createDiv({ cls: "dbui-calendar-weekdays" });
      const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
      for (const wd of weekdays) {
        dayHeaders.createSpan({ cls: "dbui-calendar-weekday", text: wd });
      }

      // Days grid
      const grid = popover.createDiv({ cls: "dbui-calendar-grid" });
      const year = viewDate.getFullYear();
      const month = viewDate.getMonth();

      const firstDayIndex = new Date(year, month, 1).getDay();
      const lastDayDate = new Date(year, month + 1, 0).getDate();
      const prevLastDay = new Date(year, month, 0).getDate();

      const today = new Date();

      // Prev month filler
      for (let i = firstDayIndex - 1; i >= 0; i--) {
        const dayNum = prevLastDay - i;
        const cell = grid.createDiv({ cls: "dbui-calendar-day is-overflow", text: String(dayNum) });
        cell.addEventListener("click", async (e) => {
          e.stopPropagation();
          const d = new Date(year, month - 1, dayNum);
          await commitDate(d);
        });
      }

      // Current month days
      for (let day = 1; day <= lastDayDate; day++) {
        const cell = grid.createDiv({ cls: "dbui-calendar-day", text: String(day) });
        const currentDate = new Date(year, month, day);

        if (
          today.getFullYear() === year &&
          today.getMonth() === month &&
          today.getDate() === day
        ) {
          cell.addClass("is-today");
        }

        if (
          initialDate &&
          initialDate.getFullYear() === year &&
          initialDate.getMonth() === month &&
          initialDate.getDate() === day
        ) {
          cell.addClass("is-selected");
        }

        cell.addEventListener("click", async (e) => {
          e.stopPropagation();
          await commitDate(currentDate);
        });
      }

      // Next month filler to fill out 42 total slots
      const totalCells = firstDayIndex + lastDayDate;
      const nextDays = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
      for (let day = 1; day <= nextDays; day++) {
        const cell = grid.createDiv({ cls: "dbui-calendar-day is-overflow", text: String(day) });
        cell.addEventListener("click", async (e) => {
          e.stopPropagation();
          const d = new Date(year, month + 1, day);
          await commitDate(d);
        });
      }

      // Time picker if datetime or time type
      let timeInput: HTMLInputElement | null = null;
      if (column.type === "time") {
        const timeRow = popover.createDiv({ cls: "dbui-calendar-time-row" });
        timeRow.createSpan({ text: "Time:" });
        timeInput = timeRow.createEl("input", {
          type: "time",
          cls: "dbui-calendar-time-input",
          value: initialDate
            ? `${String(initialDate.getHours()).padStart(2, "0")}:${String(
                initialDate.getMinutes()
              ).padStart(2, "0")}`
            : "12:00",
        });
      }

      // Quick action bar: "Today", "Clear"
      const footer = popover.createDiv({ cls: "dbui-calendar-footer" });
      const todayBtn = footer.createDiv({ cls: "dbui-calendar-btn dbui-today-btn", text: "Today" });
      todayBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await commitDate(new Date());
      });

      if (initialDate) {
        const clearBtn = footer.createDiv({ cls: "dbui-calendar-btn dbui-clear-btn", text: "Clear" });
        clearBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          close();
          await onCommit(null);
        });
      }

      const commitDate = async (selected: Date) => {
        if (timeInput && timeInput.value) {
          const [h, m] = timeInput.value.split(":").map(Number);
          selected.setHours(h || 0, m || 0, 0);
        }
        const formatted = formatAbsoluteDate(selected, column.type === "time");
        close();
        await onCommit(formatted);
      };
    };

    renderCalendar();
    reposition();
  }
}
