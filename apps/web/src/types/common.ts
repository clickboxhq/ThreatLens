export type Severity = "critical" | "high" | "medium" | "low";

export type Note = {
  id: string;
  author: string;
  ts: string;
  body: string;
};
