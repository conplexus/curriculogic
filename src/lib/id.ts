// src/lib/id.ts
export function djb2(str: string) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return String(h >>> 0);
}

export function kindFromId(id: string): string {
  if (id.startsWith("stditem:")) return "standard";
  if (id.startsWith("course:")) return "course";
  if (id.startsWith("obj:")) return "objective";
  if (id.startsWith("asm:")) return "assessment";
  if (id.startsWith("q-") || id.startsWith("q:")) return "question";
  return "unknown";
}

export function uiKindToDbKind(
  k?: string
): "STANDARD" | "COURSE" | "OBJECTIVE" | "ASSESSMENT" | "ITEM" {
  const v = (k ?? "standard").toLowerCase();
  switch (v) {
    case "standard": return "STANDARD";
    case "course": return "COURSE";
    case "objective": return "OBJECTIVE";
    case "assessment": return "ASSESSMENT";
    case "question": return "ITEM"; // UI = question, DB = ITEM
    default: return "STANDARD";
  }
}

/** Accepts "obj:123" | "course:45" | "123" | number */
export function toDbId(gid: string | number | null | undefined): number {
  if (gid == null) return NaN as any;
  if (typeof gid === "number") return gid;
  const last = gid.split(":").pop()!;
  const n = Number(last);
  return Number.isFinite(n) ? n : (NaN as any);
}
