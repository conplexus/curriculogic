import { z } from "zod";

export const NodeKind = z.enum(["STANDARD","COURSE","OBJECTIVE","ASSESSMENT","ITEM"]);

export const NodeCreate = z.object({
  mapId: z.number().int(),
  kind: NodeKind,
  code: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  meta: z.record(z.unknown()).optional(),
});

export const NodeUpdate = NodeCreate.partial();

export const EdgeCreate = z.object({
  mapId: z.number().int(),
  sourceId: z.number().int(),
  targetId: z.number().int(),
  label: z.string().optional(),
});
