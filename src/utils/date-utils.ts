import { DateFormat } from "../types";

export function parseDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  if (typeof val === "number") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return null;
    // Handle standard YYYY-MM-DD
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10) - 1;
      const day = parseInt(isoMatch[3], 10);
      const hour = isoMatch[4] ? parseInt(isoMatch[4], 10) : 0;
      const minute = isoMatch[5] ? parseInt(isoMatch[5], 10) : 0;
      const second = isoMatch[6] ? parseInt(isoMatch[6], 10) : 0;
      const d = new Date(year, month, day, hour, minute, second);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function formatRelativeDate(date: Date, now = new Date()): string {
  // Compare by calendar days
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(date) - startOfDay(now)) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";

  if (diffDays > 1 && diffDays < 7) return `In ${diffDays} days`;
  if (diffDays < -1 && diffDays > -7) return `${Math.abs(diffDays)} days ago`;

  const diffWeeks = Math.round(diffDays / 7);
  if (Math.abs(diffDays) < 30) {
    if (diffWeeks > 0) return `In ${diffWeeks} week${diffWeeks > 1 ? "s" : ""}`;
    return `${Math.abs(diffWeeks)} week${Math.abs(diffWeeks) > 1 ? "s" : ""} ago`;
  }

  const diffMonths = Math.round(diffDays / 30.44);
  if (Math.abs(diffDays) < 365) {
    if (diffMonths > 0) return `In ${diffMonths} month${diffMonths > 1 ? "s" : ""}`;
    return `${Math.abs(diffMonths)} month${Math.abs(diffMonths) > 1 ? "s" : ""} ago`;
  }

  const diffYears = Math.round(diffDays / 365.25);
  if (diffYears > 0) return `In ${diffYears} year${diffYears > 1 ? "s" : ""}`;
  return `${Math.abs(diffYears)} year${Math.abs(diffYears) > 1 ? "s" : ""} ago`;
}

export function formatAbsoluteDate(date: Date, includeTime = false): string {
  const pad = (n: number) => (n < 10 ? "0" + n : String(n));
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  let res = `${year}-${month}-${day}`;
  if (includeTime && (date.getHours() !== 0 || date.getMinutes() !== 0)) {
    res += ` ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  return res;
}

export function formatDateWithFormat(date: Date, format: DateFormat = "relative", includeTime = false): string {
  const abs = formatAbsoluteDate(date, includeTime);
  const rel = formatRelativeDate(date);
  if (format === "relative") {
    return rel;
  }
  if (format === "both") {
    return `${abs} (${rel})`;
  }
  return abs;
}

export function isDateInPast(date: Date, now = new Date()): boolean {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return startOfDay(date) < startOfDay(now);
}

export function isDateInFuture(date: Date, now = new Date()): boolean {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return startOfDay(date) > startOfDay(now);
}

export function isDateToday(date: Date, now = new Date()): boolean {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return startOfDay(date) === startOfDay(now);
}
