// src/lib/utils.ts
import type { Status, StatusPalette } from "@/lib/types";

/**
 * Simple className joiner.
 * Filters out falsy values and joins with spaces.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Get the hex color for a given status from a palette.
 * Falls back to gray if not found.
 */
export function statusColor(status: Status, palette: StatusPalette): string {
  return palette[status] ?? "#9ca3af"; // default gray
}

/**
 * Format a number as a percentage string with fixed decimals.
 * Example: 0.8234 -> "82.3%"
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}
