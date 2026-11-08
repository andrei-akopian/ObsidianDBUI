import { TFile } from "obsidian";

export type DataType = 
  | "text" 
  | "number" 
  | "status" 
  | "tag" 
  | "multi-tag" 
  | "date" 
  | "time" 
  | "checkbox" 
  | "file";

export type NumberFormat = "plain" | "progress-bar" | "progress-circle";

export type DateFormat = "relative" | "absolute" | "both";

export interface StatusOption {
  id: string;
  label: string;
  color: string;
}

export interface ColumnConfig {
  key: string;
  name: string;
  type: DataType;
  width: number;
  visible: boolean;
  wrap?: boolean;
  numberFormat?: NumberFormat;
  numberMax?: number;
  dateFormat?: DateFormat;
  options?: StatusOption[];
}

export type FilterOperator =
  | "contains"
  | "not-contains"
  | "equals"
  | "not-equals"
  | "starts-with"
  | "ends-with"
  | "greater"
  | "greater-equal"
  | "less"
  | "less-equal"
  | "is-empty"
  | "is-not-empty"
  | "is-today"
  | "is-past"
  | "is-future"
  | "is-checked"
  | "is-unchecked";

export interface FilterRule {
  id: string;
  key: string;
  operator: FilterOperator;
  value: any;
}

export type SortDirection = "asc" | "desc";

export interface SortRule {
  key: string;
  direction: SortDirection;
}

export interface TagColor {
  bg: string;
  text: string;
  border?: string;
}

export interface ViewSettings {
  wrapCells: boolean;
  rowDensity: "compact" | "comfortable";
  showRowNumbers: boolean;
}

export interface DBConfig {
  version?: number;
  folder: string;
  includeSubfolders: boolean;
  columns: ColumnConfig[];
  sort: SortRule[];
  filters: FilterRule[];
  tagColors: Record<string, TagColor>;
  statusOptions: Record<string, StatusOption[]>;
  settings: ViewSettings;
  removedKeys?: string[];
}

export interface RowData {
  file: TFile;
  basename: string;
  path: string;
  values: Record<string, any>;
}

export interface PluginSettings {
  defaultDensity: "compact" | "comfortable";
  defaultWrap: boolean;
}
