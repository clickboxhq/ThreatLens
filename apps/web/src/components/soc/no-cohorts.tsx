import { Link } from "@tanstack/react-router";
import { Users } from "lucide-react";

/** Every instructor page below the cohort list (roster, assignments, review queue) needs at
 * least one cohort to scope itself to. */
export function NoCohorts({ title }: { title: string }) {
  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <div className="glass-card flex flex-col items-center gap-3 px-6 py-16 text-center">
        <Users className="size-8 text-muted-foreground" />
        <h2 className="text-lg font-semibold">No cohorts yet</h2>
        <p className="max-w-sm text-sm text-secondary">
          {title} is scoped to one of your cohorts. Create one to start assigning scenarios and
          tracking analysts.
        </p>
        <Link
          to="/app/cohorts"
          className="mt-2 inline-flex h-9 items-center rounded-md bg-primary px-4 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover"
        >
          Create a cohort
        </Link>
      </div>
    </div>
  );
}
