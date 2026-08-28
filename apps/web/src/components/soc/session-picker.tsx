import type { SessionListItemDto } from "@/types/socverse-operations";
import { ChevronDown } from "lucide-react";

/** Shown in the header of pages scoped to one active investigation (Alert Center, Identity/
 * Device/Email portals) — a no-op when there's only one to choose from, since most students
 * only run one investigation at a time. */
export function SessionPicker({
  sessions,
  selectedId,
  onChange,
}: {
  sessions: SessionListItemDto[];
  selectedId: string | undefined;
  onChange: (id: string) => void;
}) {
  if (sessions.length <= 1) return null;

  return (
    <label className="relative inline-flex h-9 items-center">
      <span className="sr-only">Active investigation</span>
      <select
        value={selectedId}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 appearance-none rounded-md border border-border bg-card py-0 pl-3 pr-8 text-[12px] text-foreground focus:outline-none"
      >
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.scenarioTitle}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 size-3.5 text-muted-foreground" />
    </label>
  );
}
