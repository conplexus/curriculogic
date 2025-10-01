// src/lib/palette.ts
import type { Status } from "@/lib/types";

export type StatusPalette = Record<Status, string>;

export const DEFAULT_PALETTE: StatusPalette = {
  GREEN: "#22c55e",
  AMBER: "#f59e0b",
  RED: "#ef4444",
  GRAY: "#9ca3af",
};
