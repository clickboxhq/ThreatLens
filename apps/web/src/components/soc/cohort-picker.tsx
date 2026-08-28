import type { OwnedCohortDto } from "@/types/socverse-instructor";
import { ChevronDown } from "lucide-react";

/** Same pattern as SessionPicker — a no-op when there's only one cohort to choose from. */
export function CohortPicker({
  cohorts,
  selectedId,
  onChange,
}: {
  cohorts: OwnedCohortDto[];
  selectedId: string | undefined;
  onChange: (id: string) => void;
}) {
  if (cohorts.length <= 1) return null;

  return (
    <label className="relative inline-flex h-9 items-center">
      <span className="sr-only">Cohort</span>
      <select
        value={selectedId}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 appearance-none rounded-md border border-border bg-card py-0 pl-3 pr-8 text-[12px] text-foreground focus:outline-none"
      >
        {cohorts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 size-3.5 text-muted-foreground" />
    </label>
  );
}
