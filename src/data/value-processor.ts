import { DataType, FilterOperator, FilterRule, StatusOption } from "../types";
import { isDateInFuture, isDateInPast, isDateToday, parseDate } from "../utils/date-utils";
import { normalizeTag } from "../utils/string-utils";

/**
 * Unified boolean conversion.
 * Strictly treats `true`, `"true"`, `1`, `"1"` as true.
 * String `"false"`, `0`, `""`, `null`, `undefined` are false.
 */
export function toBool(val: any): boolean {
  if (val === true || val === 1) return true;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    return s === "true" || s === "1";
  }
  return false;
}

/**
 * Unified numeric parser.
 * Handles numbers, numeric strings, and cleanly formatted strings like "1,000" or "$50".
 * Returns null if input is not a valid number.
 */
export function toNumeric(val: any): number | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "boolean") return null;
  if (typeof val === "number") {
    return isNaN(val) ? null : val;
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return null;
    // Direct number check
    const direct = Number(trimmed);
    if (!isNaN(direct)) return direct;

    // Remove currency / thousands separators
    const cleaned = trimmed.replace(/[$€£¥,]/g, "");
    const parsed = Number(cleaned);
    if (!isNaN(parsed) && cleaned.length > 0) return parsed;
  }
  return null;
}

/**
 * Canonical helper to retrieve a value from row values,
 * checking both original key and lowercase key.
 */
export function getRowValue(values: Record<string, any>, key: string): any {
  if (!values || !key) return undefined;
  if (key in values) return values[key];
  const lower = key.toLowerCase();
  if (lower in values) return values[lower];
  return undefined;
}

/**
 * ValueProcessor: single source of truth for parsing, comparing, and filtering values
 * based on column data type.
 */
export class ValueProcessor {
  /**
   * Compare two values based on their column type.
   * Transitive, stable comparator. Nulls/empties sort to bottom.
   */
  static compare(
    valA: any,
    valB: any,
    type: DataType = "text",
    statusOptions?: StatusOption[]
  ): number {
    // 1. Checkbox
    if (type === "checkbox") {
      const boolA = toBool(valA);
      const boolB = toBool(valB);
      if (boolA !== boolB) {
        return boolA ? 1 : -1;
      }
      return 0;
    }

    // Null checks for all non-boolean values (empty values always sort to bottom)
    const isNullA = valA === null || valA === undefined || valA === "";
    const isNullB = valB === null || valB === undefined || valB === "";

    if (isNullA && isNullB) return 0;
    if (isNullA) return 1;
    if (isNullB) return -1;

    // 2. Status
    if (type === "status") {
      if (statusOptions && statusOptions.length > 0) {
        const strA = String(valA).trim().toLowerCase();
        const strB = String(valB).trim().toLowerCase();
        const idxA = statusOptions.findIndex((o) => o.label.toLowerCase() === strA);
        const idxB = statusOptions.findIndex((o) => o.label.toLowerCase() === strB);

        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
      }
      return String(valA).localeCompare(String(valB), undefined, {
        numeric: true,
        sensitivity: "base",
      });
    }

    // 3. Number
    if (type === "number") {
      const numA = toNumeric(valA);
      const numB = toNumeric(valB);
      if (numA !== null && numB !== null) return numA - numB;
      if (numA !== null) return -1;
      if (numB !== null) return 1;
      return String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: "base" });
    }

    // 4. Date / Time
    if (type === "date" || type === "time") {
      const dateA = parseDate(valA);
      const dateB = parseDate(valB);
      if (dateA && dateB) return dateA.getTime() - dateB.getTime();
      if (dateA) return -1;
      if (dateB) return 1;
      return String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: "base" });
    }

    // 5. Tag / Multi-tag
    if (type === "tag" || type === "multi-tag") {
      const strA = Array.isArray(valA) ? valA.join(", ") : String(valA);
      const strB = Array.isArray(valB) ? valB.join(", ") : String(valB);
      return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: "base" });
    }

    // 6. Text / File / General
    const strA = String(Array.isArray(valA) ? valA.join(", ") : valA);
    const strB = String(Array.isArray(valB) ? valB.join(", ") : valB);
    return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: "base" });
  }

  /**
   * Test whether a row value matches a filter rule for a given column type.
   */
  static matches(rawVal: any, filter: FilterRule, type: DataType = "text"): boolean {
    const op = filter.operator;
    const target = filter.value;

    // Unary empty operators
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

    // Unary checkbox operators
    if (op === "is-checked") {
      return toBool(rawVal) === true;
    }
    if (op === "is-unchecked") {
      return toBool(rawVal) === false;
    }

    // Unary date operators
    if (op === "is-today" || op === "is-past" || op === "is-future") {
      const d = parseDate(rawVal);
      if (!d) return false;
      if (op === "is-today") return isDateToday(d);
      if (op === "is-past") return isDateInPast(d);
      if (op === "is-future") return isDateInFuture(d);
    }

    // For all binary operators, if the filter target is empty/unspecified,
    // do not filter out rows (standard DB UX when user hasn't typed a target yet)
    if (target === null || target === undefined || target === "") {
      return true;
    }

    // Null checks for raw value in binary comparisons
    if (rawVal === null || rawVal === undefined) return false;

    // 1. Checkbox column
    if (type === "checkbox") {
      const bRow = toBool(rawVal);
      const bTarget = toBool(target);
      if (op === "equals") return bRow === bTarget;
      if (op === "not-equals") return bRow !== bTarget;
      return false;
    }

    // 2. Number column
    if (type === "number") {
      const numA = toNumeric(rawVal);
      const numTarget = toNumeric(target);
      if (numA === null || numTarget === null) return false;

      if (op === "equals") return numA === numTarget;
      if (op === "not-equals") return numA !== numTarget;
      if (op === "greater") return numA > numTarget;
      if (op === "greater-equal") return numA >= numTarget;
      if (op === "less") return numA < numTarget;
      if (op === "less-equal") return numA <= numTarget;
      return false;
    }

    // 3. Date / Time column
    if (type === "date" || type === "time") {
      const dateA = parseDate(rawVal);
      const dateTarget = parseDate(target);
      if (!dateA || !dateTarget) return false;

      if (op === "equals") {
        return (
          dateA.getFullYear() === dateTarget.getFullYear() &&
          dateA.getMonth() === dateTarget.getMonth() &&
          dateA.getDate() === dateTarget.getDate()
        );
      }
      if (op === "not-equals") {
        return (
          dateA.getFullYear() !== dateTarget.getFullYear() ||
          dateA.getMonth() !== dateTarget.getMonth() ||
          dateA.getDate() !== dateTarget.getDate()
        );
      }
      if (op === "less") return dateA.getTime() < dateTarget.getTime();
      if (op === "less-equal") return dateA.getTime() <= dateTarget.getTime();
      if (op === "greater") return dateA.getTime() > dateTarget.getTime();
      if (op === "greater-equal") return dateA.getTime() >= dateTarget.getTime();
      return false;
    }

    // 4. Tag / Multi-tag column
    if (type === "tag" || type === "multi-tag" || Array.isArray(rawVal)) {
      const items: string[] = Array.isArray(rawVal)
        ? rawVal.map((v) => String(v).trim().toLowerCase())
        : [String(rawVal).trim().toLowerCase()];
      const strTarget = String(target).trim().toLowerCase();

      if (op === "equals") {
        return items.some((item) => item === strTarget);
      }
      if (op === "not-equals") {
        return !items.some((item) => item === strTarget);
      }
      if (op === "contains") {
        return items.some((item) => item.includes(strTarget));
      }
      if (op === "not-contains") {
        return !items.some((item) => item.includes(strTarget));
      }
      return false;
    }

    // 5. Text / Status / File / General string comparisons
    const strA = String(rawVal).toLowerCase();
    const strB = String(target).toLowerCase();

    if (op === "equals") return strA === strB;
    if (op === "not-equals") return strA !== strB;
    if (op === "contains") return strA.includes(strB);
    if (op === "not-contains") return !strA.includes(strB);
    if (op === "starts-with") return strA.startsWith(strB);
    if (op === "ends-with") return strA.endsWith(strB);

    return false;
  }
}
