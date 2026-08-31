import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import { IconTile } from "@/components/soc/ui/icon-tile";
import {
  useScenarioBuilderTemplates,
  useMitreTechniqueOptions,
  useValidateScenarioDraft,
  usePublishScenarioDraft,
  useScenarioDraftState,
  nextRef,
} from "@/hooks/use-scenario-builder";
import { ApiError } from "@/lib/api-client";
import {
  SCENARIO_CATEGORIES,
  SCENARIO_DIFFICULTIES,
  NARRATIVE_HOME_COUNTRIES,
  NARRATIVE_OS_PLATFORMS,
  REQUIRED_VERDICTS,
} from "@/types/threatlens-scenario-builder";
import type {
  EventTemplateDto,
  NarrativeIdentityDraft,
  NarrativeDeviceDraft,
  KillChainStepDraft,
  FalsePositiveBaitDraft,
  HintDraft,
} from "@/types/threatlens-scenario-builder";
import type { MitreTechniqueDto } from "@/types/threatlens-investigation";
import { AlertTriangle, CheckCircle2, Plus, Save, Trash2, ArrowUp, ArrowDown } from "lucide-react";

export const Route = createFileRoute("/app/scenario-builder")({
  component: ScenarioBuilder,
  head: () => ({
    meta: [
      { title: "ThreatLens · Scenario Builder" },
      {
        name: "description",
        content:
          "Compose a new investigation scenario from real telemetry-generation templates, population, ground truth, and automated grading.",
      },
    ],
  }),
});

const inputCls =
  "h-9 rounded-md border border-border bg-background px-3 text-[13px] focus:outline-none";
const labelCls = "text-[11px] uppercase tracking-wider text-muted-foreground";
const smallBtnCls =
  "inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2 text-[11px] text-secondary hover:text-foreground";

function ScenarioBuilder() {
  const { draft, setDraft, setTitle, setSlug } = useScenarioDraftState();
  const { data: templates, isPending: templatesPending } = useScenarioBuilderTemplates();
  const { data: techniques, isPending: techniquesPending } = useMitreTechniqueOptions();
  const validateMutation = useValidateScenarioDraft();
  const publishMutation = usePublishScenarioDraft();
  const [publishError, setPublishError] = useState<string | null>(null);
  const [published, setPublished] = useState<{ slug: string; title: string } | null>(null);

  const usedTechniques = [
    ...new Set(draft.killChain.map((s) => s.mitreTechniqueId).filter(Boolean)),
  ];

  const isLoading = templatesPending || techniquesPending;

  const runValidate = () => validateMutation.mutate(draft);

  const publish = () => {
    setPublishError(null);
    publishMutation.mutate(draft, {
      onSuccess: (created) => setPublished({ slug: created.slug, title: created.title }),
      onError: (err) => {
        setPublishError(
          err instanceof ApiError ? err.message : "Couldn't publish that scenario — try again.",
        );
      },
    });
  };

  if (published) {
    return (
      <div className="px-4 py-6 md:px-8 md:py-8">
        <SectionHeader title="Scenario Builder" />
        <Panel className="max-w-lg">
          <div className="flex items-start gap-3">
            <IconTile tone="success" size="lg">
              <CheckCircle2 className="size-5" />
            </IconTile>
            <div>
              <div className="text-[14px] font-medium">"{published.title}" is published</div>
              <div className="mt-1 text-[12.5px] text-muted-foreground">
                It's live in the scenario library — students can launch it now.
              </div>
              <div className="mt-3 flex gap-2">
                <Link
                  to="/app/scenarios"
                  className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover"
                >
                  View scenario library
                </Link>
                <button
                  onClick={() => window.location.reload()}
                  className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-[12px] text-secondary hover:text-foreground"
                >
                  Build another
                </button>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Scenario Builder"
        description="Compose a new scenario from the Telemetry Generator's real event templates — population, kill chain, noise, and automated grading."
        actions={
          <>
            <button onClick={runValidate} className={smallBtnCls.replace("h-7", "h-9 px-3")}>
              {validateMutation.isPending ? "Checking…" : "Check validation"}
            </button>
            <button
              onClick={publish}
              disabled={publishMutation.isPending}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
            >
              <Save className="size-3.5" />{" "}
              {publishMutation.isPending ? "Publishing…" : "Publish scenario"}
            </button>
          </>
        }
      />

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="flex flex-col gap-4 xl:col-span-2">
            <MetadataPanel
              draft={draft}
              setDraft={setDraft}
              setTitle={setTitle}
              setSlug={setSlug}
            />
            <PopulationPanel draft={draft} setDraft={setDraft} />
            <KillChainPanel
              draft={draft}
              setDraft={setDraft}
              templates={templates ?? []}
              techniques={techniques ?? []}
            />
            <NoisePanel draft={draft} setDraft={setDraft} templates={templates ?? []} />
          </div>

          <div className="flex flex-col gap-4">
            <RubricPanel draft={draft} setDraft={setDraft} usedTechniques={usedTechniques} />
            <HintsPanel draft={draft} setDraft={setDraft} />
            <ValidationPanel
              result={validateMutation.data}
              isPending={validateMutation.isPending}
              publishError={publishError}
            />
          </div>
        </div>
      )}
    </div>
  );
}

type DraftProps = {
  draft: ReturnType<typeof useScenarioDraftState>["draft"];
  setDraft: ReturnType<typeof useScenarioDraftState>["setDraft"];
};

function MetadataPanel({
  draft,
  setDraft,
  setTitle,
  setSlug,
}: DraftProps & {
  setTitle: (t: string) => void;
  setSlug: (s: string) => void;
}) {
  return (
    <Panel title="Scenario metadata">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={labelCls}>Title</span>
          <input
            value={draft.title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Rogue OAuth App Grants Itself Mail Access"
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={labelCls}>Slug</span>
          <input
            value={draft.slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="rogue-oauth-app-mail-access"
            className={`${inputCls} font-mono`}
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={labelCls}>Summary (shown in the scenario library)</span>
          <textarea
            value={draft.summary}
            onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
            rows={2}
            className="rounded-md border border-border bg-background px-3 py-2 text-[13px] focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Category</span>
          <select
            value={draft.category}
            onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
            className={inputCls}
          >
            {SCENARIO_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Difficulty</span>
          <select
            value={draft.difficulty}
            onChange={(e) => setDraft((d) => ({ ...d, difficulty: e.target.value }))}
            className={inputCls}
          >
            {SCENARIO_DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Estimated minutes</span>
          <input
            type="number"
            min={1}
            value={draft.estimatedMinutes}
            onChange={(e) => setDraft((d) => ({ ...d, estimatedMinutes: Number(e.target.value) }))}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>World time window (hours)</span>
          <input
            type="number"
            min={1}
            max={168}
            value={draft.worldTimeWindowHours}
            onChange={(e) =>
              setDraft((d) => ({ ...d, worldTimeWindowHours: Number(e.target.value) }))
            }
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={labelCls}>Narrative summary (documentation only)</span>
          <textarea
            value={draft.narrativeSummary}
            onChange={(e) => setDraft((d) => ({ ...d, narrativeSummary: e.target.value }))}
            rows={2}
            className="rounded-md border border-border bg-background px-3 py-2 text-[13px] focus:outline-none"
          />
        </label>
      </div>
    </Panel>
  );
}

function PopulationPanel({ draft, setDraft }: DraftProps) {
  const updateIdentity = (i: number, patch: Partial<NarrativeIdentityDraft>) =>
    setDraft((d) => ({
      ...d,
      identities: d.identities.map((x, idx) => (idx === i ? { ...x, ...patch } : x)),
    }));
  const removeIdentity = (i: number) =>
    setDraft((d) => ({ ...d, identities: d.identities.filter((_, idx) => idx !== i) }));
  const addIdentity = () =>
    setDraft((d) => ({
      ...d,
      identities: [
        ...d.identities,
        { ref: nextRef("identity"), department: "", jobTitle: "", homeCountry: "US" },
      ],
    }));

  const updateDevice = (i: number, patch: Partial<NarrativeDeviceDraft>) =>
    setDraft((d) => ({
      ...d,
      devices: d.devices.map((x, idx) => (idx === i ? { ...x, ...patch } : x)),
    }));
  const removeDevice = (i: number) =>
    setDraft((d) => ({ ...d, devices: d.devices.filter((_, idx) => idx !== i) }));
  const addDevice = () =>
    setDraft((d) => ({
      ...d,
      devices: [...d.devices, { ref: nextRef("device"), hostname: "", osPlatform: "windows" }],
    }));

  return (
    <Panel
      title="Population"
      actions={
        <div className="flex gap-2">
          <button onClick={addIdentity} className={smallBtnCls}>
            <Plus className="size-3" /> Identity
          </button>
          <button onClick={addDevice} className={smallBtnCls}>
            <Plus className="size-3" /> Device
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {draft.identities.map((identity, i) => (
          <div
            key={identity.ref}
            className="grid grid-cols-[1fr_1fr_1fr_100px_28px] items-end gap-2 border-b border-border pb-2 last:border-0"
          >
            <label className="flex flex-col gap-1">
              <span className={labelCls}>Ref</span>
              <input
                value={identity.ref}
                onChange={(e) => updateIdentity(i, { ref: e.target.value })}
                className={`${inputCls} font-mono`}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelCls}>Department</span>
              <input
                value={identity.department}
                onChange={(e) => updateIdentity(i, { department: e.target.value })}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelCls}>Job title</span>
              <input
                value={identity.jobTitle}
                onChange={(e) => updateIdentity(i, { jobTitle: e.target.value })}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelCls}>Home</span>
              <select
                value={identity.homeCountry}
                onChange={(e) => updateIdentity(i, { homeCountry: e.target.value })}
                className={inputCls}
              >
                {NARRATIVE_HOME_COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => removeIdentity(i)}
              className="flex h-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-[color:var(--critical)]"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}

        {draft.devices.length > 0 && (
          <div className="mt-1 text-[10.5px] uppercase tracking-wider text-muted-foreground">
            Devices
          </div>
        )}
        {draft.devices.map((device, i) => (
          <div
            key={device.ref}
            className="grid grid-cols-[1fr_1fr_100px_28px] items-end gap-2 border-b border-border pb-2 last:border-0"
          >
            <label className="flex flex-col gap-1">
              <span className={labelCls}>Ref</span>
              <input
                value={device.ref}
                onChange={(e) => updateDevice(i, { ref: e.target.value })}
                className={`${inputCls} font-mono`}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelCls}>Hostname</span>
              <input
                value={device.hostname}
                onChange={(e) => updateDevice(i, { hostname: e.target.value })}
                className={`${inputCls} font-mono`}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelCls}>OS</span>
              <select
                value={device.osPlatform}
                onChange={(e) => updateDevice(i, { osPlatform: e.target.value })}
                className={inputCls}
              >
                {NARRATIVE_OS_PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => removeDevice(i)}
              className="flex h-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-[color:var(--critical)]"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}

        <div className="grid grid-cols-2 gap-3 pt-1">
          <label className="flex flex-col gap-1">
            <span className={labelCls}>Decoy identities</span>
            <input
              type="number"
              min={0}
              value={draft.decoyIdentities}
              onChange={(e) => setDraft((d) => ({ ...d, decoyIdentities: Number(e.target.value) }))}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelCls}>Decoy devices</span>
            <input
              type="number"
              min={0}
              value={draft.decoyDevices}
              onChange={(e) => setDraft((d) => ({ ...d, decoyDevices: Number(e.target.value) }))}
              className={inputCls}
            />
          </label>
        </div>
      </div>
    </Panel>
  );
}

function KillChainPanel({
  draft,
  setDraft,
  templates,
  techniques,
}: DraftProps & { templates: EventTemplateDto[]; techniques: MitreTechniqueDto[] }) {
  const addStep = () => {
    const template = templates.find((t) => !t.isNoiseOnly) ?? templates[0];
    setDraft((d) => ({
      ...d,
      killChain: [
        ...d.killChain,
        {
          stepOrder: d.killChain.length + 1,
          mitreTechniqueId: template?.suggestedTechniqueIds[0] ?? "",
          entityRef: d.identities[0]?.ref ?? "",
          deviceRef: "",
          eventTemplateId: template?.id ?? "",
          timestampHours: d.killChain.length + 1,
          timestampMinutes: 0,
          correlationGroup: `chain-${d.killChain.length + 1}`,
          isRequiredForFullCredit: true,
        } satisfies KillChainStepDraft,
      ],
    }));
  };

  const updateStep = (i: number, patch: Partial<KillChainStepDraft>) =>
    setDraft((d) => ({
      ...d,
      killChain: d.killChain.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    }));
  const removeStep = (i: number) =>
    setDraft((d) => ({
      ...d,
      killChain: d.killChain
        .filter((_, idx) => idx !== i)
        .map((s, idx) => ({ ...s, stepOrder: idx + 1 })),
    }));
  const moveStep = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      const arr = [...d.killChain];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return d;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...d, killChain: arr.map((s, idx) => ({ ...s, stepOrder: idx + 1 })) };
    });

  return (
    <Panel
      title="Kill chain"
      actions={
        <button onClick={addStep} className={smallBtnCls}>
          <Plus className="size-3" /> Step
        </button>
      }
    >
      {draft.killChain.length === 0 ? (
        <EmptyState title="No steps yet" description="Add the first kill-chain step above." />
      ) : (
        <div className="flex flex-col gap-3">
          {draft.killChain.map((step, i) => {
            const template = templates.find((t) => t.id === step.eventTemplateId);
            return (
              <div key={i} className="rounded-md border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    Step {step.stepOrder}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => moveStep(i, -1)} className={smallBtnCls}>
                      <ArrowUp className="size-3" />
                    </button>
                    <button onClick={() => moveStep(i, 1)} className={smallBtnCls}>
                      <ArrowDown className="size-3" />
                    </button>
                    <button
                      onClick={() => removeStep(i)}
                      className="flex h-7 items-center justify-center rounded-md border border-border px-2 text-muted-foreground hover:text-[color:var(--critical)]"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <label className="col-span-2 flex flex-col gap-1 sm:col-span-3">
                    <span className={labelCls}>Event template</span>
                    <select
                      value={step.eventTemplateId}
                      onChange={(e) => {
                        const t = templates.find((x) => x.id === e.target.value);
                        updateStep(i, {
                          eventTemplateId: e.target.value,
                          mitreTechniqueId: t?.suggestedTechniqueIds[0] ?? step.mitreTechniqueId,
                          deviceRef: t?.requiresDevice ? step.deviceRef : "",
                        });
                      }}
                      className={inputCls}
                    >
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          [{t.portal}] {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={labelCls}>MITRE technique</span>
                    <select
                      value={step.mitreTechniqueId}
                      onChange={(e) => updateStep(i, { mitreTechniqueId: e.target.value })}
                      className={inputCls}
                    >
                      <option value="">—</option>
                      {techniques.map((t) => (
                        <option key={t.id} value={t.techniqueId}>
                          {t.techniqueId} — {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={labelCls}>Entity</span>
                    <select
                      value={step.entityRef}
                      onChange={(e) => updateStep(i, { entityRef: e.target.value })}
                      className={`${inputCls} font-mono`}
                    >
                      {draft.identities.map((identity) => (
                        <option key={identity.ref} value={identity.ref}>
                          {identity.ref}
                        </option>
                      ))}
                    </select>
                  </label>
                  {template?.requiresDevice && (
                    <label className="flex flex-col gap-1">
                      <span className={labelCls}>Device (required)</span>
                      <select
                        value={step.deviceRef}
                        onChange={(e) => updateStep(i, { deviceRef: e.target.value })}
                        className={`${inputCls} font-mono`}
                      >
                        <option value="">—</option>
                        {draft.devices.map((device) => (
                          <option key={device.ref} value={device.ref}>
                            {device.ref}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="flex flex-col gap-1">
                    <span className={labelCls}>+ Hours</span>
                    <input
                      type="number"
                      min={0}
                      value={step.timestampHours}
                      onChange={(e) => updateStep(i, { timestampHours: Number(e.target.value) })}
                      className={inputCls}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={labelCls}>+ Minutes</span>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={step.timestampMinutes}
                      onChange={(e) => updateStep(i, { timestampMinutes: Number(e.target.value) })}
                      className={inputCls}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={labelCls}>Correlation group</span>
                    <input
                      value={step.correlationGroup}
                      onChange={(e) => updateStep(i, { correlationGroup: e.target.value })}
                      className={inputCls}
                    />
                  </label>
                  <label className="flex items-center gap-2 pt-4">
                    <input
                      type="checkbox"
                      checked={step.isRequiredForFullCredit}
                      onChange={(e) => updateStep(i, { isRequiredForFullCredit: e.target.checked })}
                    />
                    <span className="text-[12px] text-secondary">Required for full credit</span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function NoisePanel({
  draft,
  setDraft,
  templates,
}: DraftProps & { templates: EventTemplateDto[] }) {
  const addBait = () => {
    const template = templates.find((t) => t.isNoiseOnly) ?? templates[0];
    setDraft((d) => ({
      ...d,
      falsePositiveBait: [
        ...d.falsePositiveBait,
        {
          eventTemplateId: template?.id ?? "",
          count: 1,
          deviceRef: "",
        } satisfies FalsePositiveBaitDraft,
      ],
    }));
  };
  const updateBait = (i: number, patch: Partial<FalsePositiveBaitDraft>) =>
    setDraft((d) => ({
      ...d,
      falsePositiveBait: d.falsePositiveBait.map((b, idx) => (idx === i ? { ...b, ...patch } : b)),
    }));
  const removeBait = (i: number) =>
    setDraft((d) => ({
      ...d,
      falsePositiveBait: d.falsePositiveBait.filter((_, idx) => idx !== i),
    }));

  return (
    <Panel
      title="Noise / false-positive bait"
      actions={
        <button onClick={addBait} className={smallBtnCls}>
          <Plus className="size-3" /> Bait
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex max-w-[220px] flex-col gap-1">
          <span className={labelCls}>Signal-to-noise ratio (0–1)</span>
          <input
            type="number"
            min={0.01}
            max={1}
            step={0.01}
            value={draft.signalToNoiseRatio}
            onChange={(e) =>
              setDraft((d) => ({ ...d, signalToNoiseRatio: Number(e.target.value) }))
            }
            className={inputCls}
          />
        </label>
        {draft.falsePositiveBait.map((bait, i) => {
          const template = templates.find((t) => t.id === bait.eventTemplateId);
          return (
            <div
              key={i}
              className="grid grid-cols-[1fr_80px_1fr_28px] items-end gap-2 border-b border-border pb-2 last:border-0"
            >
              <label className="flex flex-col gap-1">
                <span className={labelCls}>Template</span>
                <select
                  value={bait.eventTemplateId}
                  onChange={(e) => updateBait(i, { eventTemplateId: e.target.value })}
                  className={inputCls}
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.isNoiseOnly ? "★ " : ""}[{t.portal}] {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelCls}>Count</span>
                <input
                  type="number"
                  min={1}
                  value={bait.count}
                  onChange={(e) => updateBait(i, { count: Number(e.target.value) })}
                  className={inputCls}
                />
              </label>
              {template?.requiresDevice ? (
                <label className="flex flex-col gap-1">
                  <span className={labelCls}>Device (required)</span>
                  <select
                    value={bait.deviceRef}
                    onChange={(e) => updateBait(i, { deviceRef: e.target.value })}
                    className={`${inputCls} font-mono`}
                  >
                    <option value="">—</option>
                    {draft.devices.map((device) => (
                      <option key={device.ref} value={device.ref}>
                        {device.ref}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div />
              )}
              <button
                onClick={() => removeBait(i)}
                className="flex h-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-[color:var(--critical)]"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function RubricPanel({
  draft,
  setDraft,
  usedTechniques,
}: DraftProps & { usedTechniques: string[] }) {
  const toggleRequired = (techniqueId: string) =>
    setDraft((d) => ({
      ...d,
      requiredTechniqueIds: d.requiredTechniqueIds.includes(techniqueId)
        ? d.requiredTechniqueIds.filter((t) => t !== techniqueId)
        : [...d.requiredTechniqueIds, techniqueId],
    }));

  return (
    <Panel title="Scoring rubric">
      <div className="flex flex-col gap-3">
        <div>
          <div className={labelCls}>Required techniques</div>
          {usedTechniques.length === 0 ? (
            <p className="mt-1 text-[12px] text-muted-foreground">
              Add kill-chain steps first — required techniques must come from what's actually used.
            </p>
          ) : (
            <div className="mt-1 flex flex-wrap gap-2">
              {usedTechniques.map((t) => (
                <label
                  key={t}
                  className="flex items-center gap-1.5 rounded border border-border bg-background px-2 py-1 text-[11.5px]"
                >
                  <input
                    type="checkbox"
                    checked={draft.requiredTechniqueIds.includes(t)}
                    onChange={() => toggleRequired(t)}
                  />
                  <span className="font-mono">{t}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Required verdict</span>
          <select
            value={draft.requiredVerdict}
            onChange={(e) => setDraft((d) => ({ ...d, requiredVerdict: e.target.value }))}
            className={inputCls}
          >
            {REQUIRED_VERDICTS.map((v) => (
              <option key={v} value={v}>
                {v.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Minimum evidence items to close</span>
          <input
            type="number"
            min={1}
            value={draft.minEvidenceItems}
            onChange={(e) => setDraft((d) => ({ ...d, minEvidenceItems: Number(e.target.value) }))}
            className={inputCls}
          />
        </label>
      </div>
    </Panel>
  );
}

function HintsPanel({ draft, setDraft }: DraftProps) {
  const addHint = () =>
    setDraft((d) => ({
      ...d,
      hints: [...d.hints, { unlockCostPercent: 5, text: "" } satisfies HintDraft],
    }));
  const updateHint = (i: number, patch: Partial<HintDraft>) =>
    setDraft((d) => ({
      ...d,
      hints: d.hints.map((h, idx) => (idx === i ? { ...h, ...patch } : h)),
    }));
  const removeHint = (i: number) =>
    setDraft((d) => ({ ...d, hints: d.hints.filter((_, idx) => idx !== i) }));

  return (
    <Panel
      title="Hints"
      actions={
        <button onClick={addHint} className={smallBtnCls}>
          <Plus className="size-3" /> Hint
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        {draft.hints.map((hint, i) => (
          <div key={i} className="grid grid-cols-[70px_1fr_28px] items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className={labelCls}>Cost %</span>
              <input
                type="number"
                min={1}
                max={100}
                value={hint.unlockCostPercent}
                onChange={(e) => updateHint(i, { unlockCostPercent: Number(e.target.value) })}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelCls}>Text</span>
              <input
                value={hint.text}
                onChange={(e) => updateHint(i, { text: e.target.value })}
                className={inputCls}
              />
            </label>
            <button
              onClick={() => removeHint(i)}
              className="flex h-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-[color:var(--critical)]"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ValidationPanel({
  result,
  isPending,
  publishError,
}: {
  result: { valid: boolean; errors: string[] } | undefined;
  isPending: boolean;
  publishError: string | null;
}) {
  return (
    <Panel title="Validation">
      {publishError && (
        <div className="mb-2 flex items-start gap-2 rounded-md border border-[color:var(--critical)]/30 bg-[color:var(--critical)]/10 p-2 text-[12px] text-[color:var(--critical)]">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {publishError}
        </div>
      )}
      {isPending && <p className="text-[12px] text-muted-foreground">Checking…</p>}
      {!isPending && !result && (
        <p className="text-[12px] text-muted-foreground">
          Click "Check validation" to verify this draft against the real templates, techniques, and
          population before publishing.
        </p>
      )}
      {!isPending && result && result.valid && (
        <div className="flex items-center gap-2 text-[12.5px] text-[color:var(--success)]">
          <CheckCircle2 className="size-4" /> No issues found — ready to publish.
        </div>
      )}
      {!isPending && result && !result.valid && (
        <ul className="space-y-2 text-[12px] text-secondary">
          {result.errors.map((e, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 size-3 shrink-0 text-[color:var(--warning)]" />
              <span>{e}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
