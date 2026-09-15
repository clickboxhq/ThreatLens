import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import { ConfirmDialog } from "@/components/soc/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useOrganizationScenarios,
  useAddOrganizationScenarios,
  useUpdateOrganizationScenarioDueDate,
  useRemoveOrganizationScenario,
} from "@/hooks/use-organization-scenarios";
import { listRealScenarios } from "@/services/scenario-catalog/scenario-catalog-service";
import { ApiError } from "@/lib/api-client";
import { CalendarClock, Loader2, Plus, Search, Trash2, Users } from "lucide-react";
import type { OrganizationScenarioDto } from "@/types/threatlens-organization-scenarios";

export const Route = createFileRoute("/app/organization-scenarios")({
  component: OrganizationScenariosPage,
  head: () => ({ meta: [{ title: "ThreatLens · Organization Scenarios" }] }),
});

function OrganizationScenariosPage() {
  const { scenarios, isPending, isError } = useOrganizationScenarios(true);
  const removeScenario = useRemoveOrganizationScenario();
  const [addOpen, setAddOpen] = useState(false);
  const [toRemove, setToRemove] = useState<OrganizationScenarioDto | null>(null);
  const [toEditDueDate, setToEditDueDate] = useState<OrganizationScenarioDto | null>(null);

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Organization Scenarios"
        description="Scenarios your organization runs, and who they're assigned to."
        actions={
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover"
          >
            <Plus className="size-3.5" /> Add Scenario
          </button>
        }
      />

      <Panel padded={false}>
        {isPending ? (
          <div className="flex flex-col gap-px p-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            title="Couldn't load organization scenarios"
            description="Try reloading the page."
          />
        ) : scenarios.length === 0 ? (
          <EmptyState
            title="No scenarios added yet"
            description="Add scenarios from the library above to assign them to your organization's members."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-background/50 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left">Scenario</th>
                  <th className="px-4 py-2.5 text-left">Difficulty</th>
                  <th className="px-4 py-2.5 text-left">Assigned</th>
                  <th className="px-4 py-2.5 text-left">Due Date</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {scenarios.map((s) => (
                  <tr key={s.id} className="hover:bg-background/40">
                    <td className="px-4 py-3">
                      <div className="font-medium">{s.title}</div>
                      <div className="text-[10.5px] capitalize text-muted-foreground">
                        {s.category} · ~{s.estimatedMinutes} min
                      </div>
                    </td>
                    <td className="px-4 py-3 capitalize text-secondary">{s.difficulty}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-secondary">
                        <Users className="size-3" /> {s.assignedCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-secondary">
                      {s.dueAt ? new Date(s.dueAt).toLocaleDateString() : "No due date"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setToEditDueDate(s)}
                          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] text-secondary hover:text-foreground"
                        >
                          <CalendarClock className="size-3" /> Edit Due Date
                        </button>
                        <button
                          type="button"
                          onClick={() => setToRemove(s)}
                          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] text-muted-foreground hover:text-[color:var(--critical)]"
                        >
                          <Trash2 className="size-3" /> Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <AddScenariosDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        existingScenarioIds={new Set(scenarios.map((s) => s.scenarioId))}
      />

      <ConfirmDialog
        open={toRemove !== null}
        onOpenChange={(open) => {
          if (!open) setToRemove(null);
        }}
        title="Remove scenario?"
        description="This will remove this scenario from your organization's scenario list. It will not delete the scenario from ThreatLens."
        target={toRemove?.title}
        confirmLabel="Remove Scenario"
        onConfirm={async () => {
          if (!toRemove) return;
          await removeScenario.mutateAsync(toRemove.id);
          toast.success(`${toRemove.title} was removed from your organization's scenarios.`);
        }}
      />

      <EditDueDateDialog
        scenario={toEditDueDate}
        onOpenChange={(open) => {
          if (!open) setToEditDueDate(null);
        }}
      />
    </div>
  );
}

function EditDueDateDialog({
  scenario,
  onOpenChange,
}: {
  scenario: OrganizationScenarioDto | null;
  onOpenChange: (open: boolean) => void;
}) {
  const updateDueDate = useUpdateOrganizationScenarioDueDate();
  const [date, setDate] = useState("");

  // Re-seed the draft whenever a different scenario is opened.
  const seededFor = scenario?.id;
  const [seeded, setSeeded] = useState<string | undefined>(undefined);
  if (scenario && seededFor !== seeded) {
    setDate(scenario.dueAt ? scenario.dueAt.slice(0, 10) : "");
    setSeeded(seededFor);
  }

  const save = async () => {
    if (!scenario) return;
    try {
      await updateDueDate.mutateAsync({
        id: scenario.id,
        dueAt: date ? new Date(date).toISOString() : null,
      });
      toast.success("Due date updated.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't update the due date.");
    }
  };

  return (
    <Dialog open={scenario !== null} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border bg-card sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-foreground">Edit due date</DialogTitle>
          <DialogDescription>{scenario?.title}</DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-1">
          <span className="t-label text-muted-foreground">Due date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-[13px] focus:outline-none"
          />
        </label>
        <p className="text-[11px] text-muted-foreground">
          Leave blank to clear the due date. Affected members are notified of the change.
        </p>
        <DialogFooter>
          <button type="button" className="btn-app-ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-app-primary"
            disabled={updateDueDate.isPending}
            onClick={save}
          >
            {updateDueDate.isPending ? "Saving…" : "Save"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddScenariosDialog({
  open,
  onOpenChange,
  existingScenarioIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingScenarioIds: Set<string>;
}) {
  const { data: catalog, isPending } = useQuery({
    queryKey: ["scenarios"],
    queryFn: listRealScenarios,
    enabled: open,
  });
  const addScenarios = useAddOrganizationScenarios();
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const list = catalog ?? [];
    const q = search.trim().toLowerCase();
    return list.filter((s) => {
      if (difficulty && s.difficulty !== difficulty) return false;
      if (!q) return true;
      return s.title.toLowerCase().includes(q) || s.summary.toLowerCase().includes(q);
    });
  }, [catalog, search, difficulty]);

  const selectableIds = filtered.filter((s) => !existingScenarioIds.has(s.id)).map((s) => s.id);
  const allVisibleSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const close = () => {
    onOpenChange(false);
    setSearch("");
    setDifficulty("");
    setSelected(new Set());
  };

  const submit = async () => {
    if (selected.size === 0) return;
    try {
      await addScenarios.mutateAsync([...selected]);
      toast.success(
        `${selected.size} ${selected.size === 1 ? "scenario" : "scenarios"} added to your organization.`,
      );
      close();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't add those scenarios.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="glass-card flex max-h-[85vh] flex-col border-border bg-card sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">Select scenarios</DialogTitle>
          <DialogDescription>
            Choose scenarios to add to your organization. They'll be assigned to every active
            member.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search scenarios…"
              className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-[13px] focus:outline-none"
            />
          </div>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2.5 text-[13px] focus:outline-none"
          >
            <option value="">All difficulties</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
            <option value="expert">Expert</option>
          </select>
        </div>

        <div className="flex items-center justify-between text-[11.5px]">
          <button
            type="button"
            onClick={() =>
              setSelected((prev) => {
                if (allVisibleSelected) {
                  const next = new Set(prev);
                  for (const id of selectableIds) next.delete(id);
                  return next;
                }
                return new Set([...prev, ...selectableIds]);
              })
            }
            disabled={selectableIds.length === 0}
            className="text-[color:var(--info)] hover:underline disabled:opacity-40"
          >
            {allVisibleSelected ? "Clear visible" : "Select all visible"}
          </button>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-muted-foreground hover:text-foreground"
            >
              Clear selection
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border">
          {isPending ? (
            <div className="flex flex-col gap-2 p-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-center text-[12px] text-muted-foreground">
              No scenarios match your search.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((s) => {
                const alreadyAdded = existingScenarioIds.has(s.id);
                const checked = selected.has(s.id);
                return (
                  <li key={s.id}>
                    <label
                      className={`flex items-center gap-3 px-3 py-2.5 text-[12.5px] ${
                        alreadyAdded ? "opacity-50" : "cursor-pointer hover:bg-background/40"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={alreadyAdded}
                        onChange={() => toggle(s.id)}
                        className="size-3.5 accent-[color:var(--info)]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{s.title}</div>
                        <div className="text-[10.5px] capitalize text-muted-foreground">
                          {s.difficulty} · {s.category} · ~{s.estimatedMinutes} min
                        </div>
                      </div>
                      {alreadyAdded && (
                        <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          Already added
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <span className="text-[12px] text-secondary">
            {selected.size} {selected.size === 1 ? "scenario" : "scenarios"} selected
          </span>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-app-ghost" onClick={close}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-app-primary"
              disabled={selected.size === 0 || addScenarios.isPending}
              onClick={submit}
            >
              {addScenarios.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Adding…
                </>
              ) : (
                "Add Selected Scenarios"
              )}
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
