import { DateFormat } from "../types";

/**
 * Strict parser that only accepts ISO-like date strings:
 * - YYYY-MM-DD
 * - YYYY-MM-DDTHH:mm / YYYY-MM-DD HH:mm
 * - YYYY-MM-DDTHH:mm:ss / YYYY-MM-DD HH:mm:ss
 * - Optional 'Z' or '+/-HH:mm' timezone offset
 *
 * Does NOT accept arbitrary numbers or arbitrary strings like "Book 2", "5", "Chapter 1".
 */
export function parseDate(val: any): Date | null {
  if (val === null || val === undefined) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  // Never treat plain numbers as dates in database properties
  if (typeof val === "number") {
    return null;
  }

  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return null;

    // Strict regex matching: YYYY-MM-DD with optional time and optional timezone
    const match = trimmed.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?(?:(Z)|([+-]\d{2}):?(\d{2})?)?$/i
    );
    if (!match) return null;

    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);

    // Validate calendar month and day ranges
    if (month < 0 || month > 11 || day < 1 || day > 31) return null;

    const hasTime = match[4] !== undefined;
    const hour = hasTime ? parseInt(match[4], 10) : 0;
    const minute = match[5] !== undefined ? parseInt(match[5], 10) : 0;
    const second = match[6] !== undefined ? parseInt(match[6], 10) : 0;

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return null;

    // If timezone is present (e.g. Z or +02:00)
    const hasTz = Boolean(match[7] || match[8]);
    if (hasTz) {
      const d = new Date(trimmed);
      return isNaN(d.getTime()) ? null : d;
    }

    // Local date construction to avoid unexpected UTC shifts when only date is provided
    const d = new Date(year, month, day, hour, minute, second);
    if (isNaN(d.getTime())) return null;

    // Double check day didn't rollover (e.g. Feb 30 -> Mar 2)
    if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) {
      return null;
    }

    return d;
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
  if (includeTime) {
    res += `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
