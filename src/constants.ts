import { DBConfig, PluginSettings } from "./types";

export const VIEW_TYPE_DBUI = "dbui-view";
export const DBUI_FILE_EXTENSION = "dbui";
export const DBUI_CODEBLOCK = "dbui";
export const DBUI_ICON_ID = "dbui-layout-icon";

export const DBUI_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect width="18" height="18" x="3" y="3" rx="2.5"/>
  <path d="M3 9h18"/>
  <path d="M9 21V9"/>
  <circle cx="6" cy="6" r="1" fill="currentColor"/>
  <circle cx="6" cy="12.5" r="1" fill="currentColor"/>
  <circle cx="6" cy="17.5" r="1" fill="currentColor"/>
  <path d="M12.5 13h5.5"/>
  <path d="M12.5 17h3.5"/>
</svg>`;

export const DEFAULT_SETTINGS: PluginSettings = {
  defaultDensity: "compact",
  defaultWrap: false,
};

export const DEFAULT_VIEW_SETTINGS = {
  wrapCells: false,
  rowDensity: "compact" as const,
  showRowNumbers: true,
};

export const DEFAULT_DB_CONFIG: DBConfig = {
  folder: "",
  includeSubfolders: true,
  columns: [
    {
      key: "file.name",
      name: "Name",
      type: "file",
      width: 220,
      visible: true,
      wrap: false,
    },
  ],
  sort: [],
  filters: [],
  tagColors: {},
  statusOptions: {},
  settings: DEFAULT_VIEW_SETTINGS,
};

export interface ColorPreset {
  name: string;
  bgLight: string;
  textLight: string;
  bgDark: string;
  textDark: string;
}

export const COLOR_PALETTE: ColorPreset[] = [
  { name: "Gray", bgLight: "#f1f3f5", textLight: "#495057", bgDark: "#2c2e33", textDark: "#adb5bd" },
  { name: "Brown", bgLight: "#f4ece8", textLight: "#744210", bgDark: "#382c26", textDark: "#d69e2e" },
  { name: "Orange", bgLight: "#fff4e6", textLight: "#d9480f", bgDark: "#3d2a1d", textDark: "#ffa94d" },
  { name: "Yellow", bgLight: "#fef9c3", textLight: "#854d0e", bgDark: "#39321b", textDark: "#fde047" },
  { name: "Green", bgLight: "#ebfbee", textLight: "#2b8a3e", bgDark: "#1c3829", textDark: "#69db7c" },
  { name: "Emerald", bgLight: "#ecfdf5", textLight: "#047857", bgDark: "#133e32", textDark: "#6ee7b7" },
  { name: "Teal", bgLight: "#e6fcf5", textLight: "#0ca678", bgDark: "#183b38", textDark: "#63e6be" },
  { name: "Cyan", bgLight: "#e0fcff", textLight: "#0c8599", bgDark: "#173b45", textDark: "#66d9e8" },
  { name: "Blue", bgLight: "#e7f5ff", textLight: "#1c7ed6", bgDark: "#18324f", textDark: "#74c0fc" },
  { name: "Indigo", bgLight: "#edf2ff", textLight: "#4263eb", bgDark: "#232b53", textDark: "#91a7ff" },
  { name: "Purple", bgLight: "#f3f0ff", textLight: "#7950f2", bgDark: "#2d2449", textDark: "#b197fc" },
  { name: "Pink", bgLight: "#fff0f6", textLight: "#d6336c", bgDark: "#3d1f30", textDark: "#f783ac" },
  { name: "Rose", bgLight: "#ffe4e6", textLight: "#be123c", bgDark: "#3f1c24", textDark: "#fda4af" },
  { name: "Red", bgLight: "#ffe3e3", textLight: "#e03131", bgDark: "#3d1e1e", textDark: "#ff8787" },
];
