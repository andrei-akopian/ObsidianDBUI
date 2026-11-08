import { COLOR_PALETTE, ColorPreset } from "../constants";
import { TagColor } from "../types";
import { hashString } from "../utils/string-utils";

export function isDarkMode(): boolean {
  return document.body.classList.contains("theme-dark");
}

export function getDeterministicColor(label: string): TagColor {
  const hash = hashString(label);
  const preset: ColorPreset = COLOR_PALETTE[hash % COLOR_PALETTE.length];
  const dark = isDarkMode();
  return {
    bg: dark ? preset.bgDark : preset.bgLight,
    text: dark ? preset.textDark : preset.textLight,
  };
}

export function resolveTagColor(label: string, customColors?: Record<string, TagColor>): TagColor {
  if (customColors && customColors[label]) {
    return customColors[label];
  }
  return getDeterministicColor(label);
}

export function getAllPalettePresets(): ColorPreset[] {
  return COLOR_PALETTE;
}
