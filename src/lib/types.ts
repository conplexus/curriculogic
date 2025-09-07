export type Status = "GREEN" | "AMBER" | "RED" | "GRAY";

export type RollupNode = {
  id: string;
  label: string;
  status: Status;
  parentId?: string;
};

export type RollupEdge = {
  id: string;
  source: string;
  target: string;
};
