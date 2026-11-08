import { FilterRule, RowData, SortRule } from "../types";
import { isDateInFuture, isDateInPast, isDateToday, parseDate } from "../utils/date-utils";

export class FilterSorter {
  /**
   * Filter and sort rows based on config rules and quick search query.
   */
  static process(
    rows: RowData[],
    filters: FilterRule[],
    sorts: SortRule[],
    quickSearch = ""
  ): RowData[] {
    let result = [...rows];

    // 1. Quick search across all row values
    if (quickSearch && quickSearch.trim()) {
      const q = quickSearch.trim().toLowerCase();
      result = result.filter((row) => {
        for (const val of Object.values(row.values)) {
          if (val === null || val === undefined) continue;
          if (Array.isArray(val)) {
            if (val.some((v) => String(v).toLowerCase().includes(q))) return true;
          } else if (String(val).toLowerCase().includes(q)) {
            return true;
          }
        }
        return false;
      });
    }

    // 2. Structured filters
    if (filters && filters.length > 0) {
      result = result.filter((row) => {
        for (const f of filters) {
          if (!this.matchesFilter(row, f)) {
            return false;
          }
        }
        return true;
      });
    }

    // 3. Sorting
    if (sorts && sorts.length > 0) {
      result.sort((a, b) => {
        for (const sort of sorts) {
          const valA = a.values[sort.key];
          const valB = b.values[sort.key];
          const cmp = this.compareValues(valA, valB);
          if (cmp !== 0) {
            return sort.direction === "asc" ? cmp : -cmp;
          }
        }
        return 0;
      });
    }

    return result;
  }

  private static matchesFilter(row: RowData, filter: FilterRule): boolean {
    const rawVal = row.values[filter.key];
    const op = filter.operator;
    const target = filter.value;

    // Empty checks
    if (op === "is-empty") {
      return (
        rawVal === null ||
        rawVal === undefined ||
        rawVal === "" ||
        (Array.isArray(rawVal) && rawVal.length === 0)
      );
    }
    if (op === "is-not-empty") {
      return (
        rawVal !== null &&
        rawVal !== undefined &&
        rawVal !== "" &&
        (!Array.isArray(rawVal) || rawVal.length > 0)
      );
    }

    // Checkbox special operators
    if (op === "is-today" || op === "is-past" || op === "is-future") {
      const d = parseDate(rawVal);
      if (!d) return false;
      if (op === "is-today") return isDateToday(d);
      if (op === "is-past") return isDateInPast(d);
      if (op === "is-future") return isDateInFuture(d);
    }

    // Boolean check
    const boolVal = typeof rawVal === "boolean" ? rawVal : String(rawVal).toLowerCase() === "true";
    if (String(op) === "is-checked") return Boolean(rawVal) === true;
    if (String(op) === "is-unchecked") return Boolean(rawVal) === false;

    // Null checks for other operators
    if (rawVal === null || rawVal === undefined) return false;

    // Date comparisons
    const dateVal = parseDate(rawVal);
    const dateTarget = parseDate(target);
    if (dateVal && dateTarget) {
      if (op === "less") return dateVal.getTime() < dateTarget.getTime();
      if (op === "greater") return dateVal.getTime() > dateTarget.getTime();
      if (op === "equals") {
        return (
          dateVal.getFullYear() === dateTarget.getFullYear() &&
          dateVal.getMonth() === dateTarget.getMonth() &&
          dateVal.getDate() === dateTarget.getDate()
        );
      }
      if (op === "not-equals") {
        return (
          dateVal.getFullYear() !== dateTarget.getFullYear() ||
          dateVal.getMonth() !== dateTarget.getMonth() ||
          dateVal.getDate() !== dateTarget.getDate()
        );
      }
    }

    // Number comparisons
    const numA = Number(rawVal);
    const numTarget = Number(target);
    const isNum = !isNaN(numA) && !isNaN(numTarget) && typeof rawVal !== "boolean";

    if (isNum) {
      if (op === "greater") return numA > numTarget;
      if (op === "greater-equal") return numA >= numTarget;
      if (op === "less") return numA < numTarget;
      if (op === "less-equal") return numA <= numTarget;
      if (op === "equals") return numA === numTarget;
      if (op === "not-equals") return numA !== numTarget;
    }

    // Array / Tag values
    if (Array.isArray(rawVal)) {
      const strTarget = String(target || "").toLowerCase();
      const stringArr = rawVal.map((v) => String(v).toLowerCase());
      if (op === "contains" || op === "equals") {
        return stringArr.some((item) => item.includes(strTarget));
      }
      if (op === "not-contains" || op === "not-equals") {
        return !stringArr.some((item) => item.includes(strTarget));
      }
    }

    // String / General comparisons
    const strA = String(rawVal).toLowerCase();
    const strB = String(target || "").toLowerCase();

    if (op === "equals") return strA === strB;
    if (op === "not-equals") return strA !== strB;
    if (op === "contains") return strA.includes(strB);
    if (op === "not-contains") return !strA.includes(strB);
    if (op === "starts-with") return strA.startsWith(strB);
    if (op === "ends-with") return strA.endsWith(strB);

    return true;
  }

  private static compareValues(valA: any, valB: any): number {
    const isNullA = valA === null || valA === undefined || valA === "";
    const isNullB = valB === null || valB === undefined || valB === "";

    if (isNullA && isNullB) return 0;
    if (isNullA) return 1; // nulls at bottom
    if (isNullB) return -1;

    // Date comparison
    const dateA = parseDate(valA);
    const dateB = parseDate(valB);
    if (dateA && dateB) {
      return dateA.getTime() - dateB.getTime();
    }

    // Number comparison
    const numA = Number(valA);
    const numB = Number(valB);
    if (!isNaN(numA) && !isNaN(numB) && typeof valA !== "boolean" && typeof valB !== "boolean") {
      return numA - numB;
    }

    // Boolean comparison
    if (typeof valA === "boolean" && typeof valB === "boolean") {
      return valA === valB ? 0 : valA ? 1 : -1;
    }

    // String natural comparison
    const strA = String(Array.isArray(valA) ? valA.join(", ") : valA);
    const strB = String(Array.isArray(valB) ? valB.join(", ") : valB);
    return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: "base" });
  }
}
