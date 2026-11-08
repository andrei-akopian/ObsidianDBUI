import { DEFAULT_DB_CONFIG, DEFAULT_VIEW_SETTINGS } from "../constants";
import { ColumnConfig, DataType, DBConfig, FilterRule, SortRule } from "../types";

const VALID_DATA_TYPES = new Set<DataType>([
  "text",
  "number",
  "status",
  "tag",
  "multi-tag",
  "date",
  "time",
  "checkbox",
  "file",
]);

export function normalizeConfig(raw: any): DBConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return JSON.parse(JSON.stringify(DEFAULT_DB_CONFIG));
  }

  const folder = typeof raw.folder === "string" ? raw.folder.trim().replace(/^\/+|\/+$/g, "") : "";
  const includeSubfolders = raw.includeSubfolders !== false;

  // Normalize settings
  const rawSettings = raw.settings && typeof raw.settings === "object" ? raw.settings : {};
  const settings = {
    wrapCells: Boolean(rawSettings.wrapCells ?? DEFAULT_VIEW_SETTINGS.wrapCells),
    rowDensity: rawSettings.rowDensity === "comfortable" ? ("comfortable" as const) : ("compact" as const),
    showRowNumbers: Boolean(rawSettings.showRowNumbers ?? DEFAULT_VIEW_SETTINGS.showRowNumbers),
  };

  // Normalize columns
  const rawCols: any[] = Array.isArray(raw.columns) ? raw.columns : [];
  const columns: ColumnConfig[] = [];
  const seenKeys = new Set<string>();

  for (const c of rawCols) {
    if (!c || typeof c !== "object" || typeof c.key !== "string") continue;
    const lowerKey = c.key.toLowerCase();
    if (seenKeys.has(lowerKey)) continue;
    seenKeys.add(lowerKey);

    const type: DataType = VALID_DATA_TYPES.has(c.type) ? c.type : "text";
    const width = typeof c.width === "number" && c.width >= 40 ? Math.round(c.width) : (type === "checkbox" ? 80 : 160);

    columns.push({
      key: c.key,
      name: typeof c.name === "string" && c.name.trim() ? c.name.trim() : c.key,
      type,
      width,
      visible: c.visible !== false,
      wrap: Boolean(c.wrap),
      numberFormat: c.numberFormat === "progress-bar" || c.numberFormat === "progress-circle" ? c.numberFormat : "plain",
      numberMax: typeof c.numberMax === "number" && !isNaN(c.numberMax) ? c.numberMax : 100,
      dateFormat: c.dateFormat === "absolute" || c.dateFormat === "both" ? c.dateFormat : "relative",
      options: Array.isArray(c.options) ? c.options : undefined,
    });
  }

  // Ensure file.name is present as the first column
  const fileNameIdx = columns.findIndex((c) => c.key.toLowerCase() === "file.name");
  if (fileNameIdx === -1) {
    columns.unshift({
      key: "file.name",
      name: "Name",
      type: "file",
      width: 220,
      visible: true,
      wrap: false,
    });
  } else if (fileNameIdx > 0) {
    const [fileNameCol] = columns.splice(fileNameIdx, 1);
    columns.unshift(fileNameCol);
  }

  // Normalize sort
  const rawSort: any[] = Array.isArray(raw.sort) ? raw.sort : [];
  const sort: SortRule[] = [];
  for (const s of rawSort) {
    if (s && typeof s === "object" && typeof s.key === "string") {
      sort.push({
        key: s.key,
        direction: s.direction === "desc" ? "desc" : "asc",
      });
    }
  }

  // Normalize filters
  const rawFilters: any[] = Array.isArray(raw.filters) ? raw.filters : [];
  const filters: FilterRule[] = [];
  for (const f of rawFilters) {
    if (f && typeof f === "object" && typeof f.key === "string" && typeof f.operator === "string") {
      filters.push({
        id: typeof f.id === "string" ? f.id : String(Date.now() + Math.random()),
        key: f.key,
        operator: f.operator,
        value: f.value,
      });
    }
  }

  // Normalize tagColors
  const tagColors = raw.tagColors && typeof raw.tagColors === "object" && !Array.isArray(raw.tagColors)
    ? { ...raw.tagColors }
    : {};

  // Normalize statusOptions
  const statusOptions = raw.statusOptions && typeof raw.statusOptions === "object" && !Array.isArray(raw.statusOptions)
    ? { ...raw.statusOptions }
    : {};

  // Normalize removedKeys
  const removedKeys = Array.isArray(raw.removedKeys)
    ? raw.removedKeys.filter((k: any) => typeof k === "string").map((k: string) => k.toLowerCase())
    : [];

  return {
    version: typeof raw.version === "number" ? raw.version : 1,
    folder,
    includeSubfolders,
    columns,
    sort,
    filters,
    tagColors,
    statusOptions,
    settings,
    removedKeys,
  };
}
