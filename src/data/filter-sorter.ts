import { ColumnConfig, DBConfig, FilterRule, RowData, SortRule } from "../types";
import { getRowValue, ValueProcessor } from "./value-processor";

export class FilterSorter {
  /**
   * Filter and sort rows based on config rules, column types, and quick search query.
   */
  static process(
    rows: RowData[],
    filters: FilterRule[],
    sorts: SortRule[],
    quickSearch = "",
    columns: ColumnConfig[] = [],
    config?: DBConfig
  ): RowData[] {
    let result = [...rows];

    // 1. Quick search across all row values
    if (quickSearch && quickSearch.trim()) {
      const q = quickSearch.trim().toLowerCase();
      result = result.filter((row) => {
        for (const [key, val] of Object.entries(row.values)) {
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

    // 2. Structured datatype-aware filters
    if (filters && filters.length > 0) {
      result = result.filter((row) => {
        for (const f of filters) {
          if (!this.matchesFilter(row, f, columns)) {
            return false;
          }
        }
        return true;
      });
    }

    // 3. Datatype-Aware Sorting
    if (sorts && sorts.length > 0) {
      result.sort((a, b) => {
        for (const sort of sorts) {
          const col = columns.find(
            (c) => c.key === sort.key || c.key.toLowerCase() === sort.key.toLowerCase()
          );
          const colType = col ? col.type : "text";
          const statusOptions =
            (config?.statusOptions && (config.statusOptions[sort.key] || config.statusOptions[sort.key.toLowerCase()])) ||
            col?.options;

          const valA = getRowValue(a.values, sort.key);
          const valB = getRowValue(b.values, sort.key);
          const cmp = ValueProcessor.compare(valA, valB, colType, statusOptions);
          if (cmp !== 0) {
            return sort.direction === "asc" ? cmp : -cmp;
          }
        }
        return 0;
      });
    }

    return result;
  }

  private static matchesFilter(
    row: RowData,
    filter: FilterRule,
    columns: ColumnConfig[] = []
  ): boolean {
    const rawVal = getRowValue(row.values, filter.key);
    const col = columns.find(
      (c) => c.key === filter.key || c.key.toLowerCase() === filter.key.toLowerCase()
    );
    const colType = col ? col.type : "text";

    return ValueProcessor.matches(rawVal, filter, colType);
  }
}
