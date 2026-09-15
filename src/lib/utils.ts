import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalizes an ISO date string to ensure UTC parsing if timezone offset is missing.
 */
export function parseUtcDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  let s = dateStr.trim();
  // If no timezone suffix (Z or +HH:mm or -HH:mm), append Z for UTC
  if (!s.endsWith("Z") && !/[+-]\d{2}(:\d{2})?$/.test(s) && !/[+-]\d{4}$/.test(s)) {
    s += "Z";
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formats a date string into standard local datetime: YYYY-MM-DD HH:mm:ss
 */
export function formatTime(dateStr?: string | null): string {
  if (!dateStr) return "-";
  const d = parseUtcDate(dateStr);
  if (!d) return dateStr;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Formats a date string into human-friendly relative time (e.g. 刚刚, 5分钟前, 2小时前)
 */
export function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return "-";
  const d = parseUtcDate(dateStr);
  if (!d) return dateStr;

  const now = Date.now();
  const diffMs = now - d.getTime();

  // If time is slightly in future due to clock skew, treat as "刚刚"
  if (diffMs < 5000) return "刚刚";

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec} 秒前`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} 分钟前`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} 小时前`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} 天前`;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Formats a date string into YYYY-MM-DD
 */
export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "-";
  const d = parseUtcDate(dateStr);
  if (!d) return dateStr;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
