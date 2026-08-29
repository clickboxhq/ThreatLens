import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { scenarioBuilderService } from "@/services/scenario-builder";
import { investigationsService } from "@/services/investigations";
import { queryKeys } from "./query-keys";
import type { ScenarioDraft } from "@/types/socverse-scenario-builder";

let refCounter = 0;
function nextRef(prefix: string): string {
  refCounter += 1;
  return `${prefix}_${refCounter}`;
}

export function emptyScenarioDraft(): ScenarioDraft {
  return {
    slug: "",
    title: "",
    summary: "",
    category: "identity",
    difficulty: "beginner",
    estimatedMinutes: 20,
    narrativeSummary: "",
    identities: [{ ref: nextRef("identity"), department: "", jobTitle: "", homeCountry: "US" }],
    devices: [],
    decoyIdentities: 10,
    decoyDevices: 6,
    worldTimeWindowHours: 24,
    killChain: [],
    signalToNoiseRatio: 0.1,
    falsePositiveBait: [],
    requiredTechniqueIds: [],
    requiredVerdict: "true_positive",
    minEvidenceItems: 1,
    hints: [],
  };
}

export { nextRef };

export function useScenarioBuilderTemplates() {
  return useQuery({
    queryKey: queryKeys.scenarioBuilder,
    queryFn: () => scenarioBuilderService.listTemplates(),
    staleTime: Infinity, // a fixed catalog tied to the deployed generator code, not live data
  });
}

export function useMitreTechniqueOptions() {
  return useQuery({
    queryKey: ["mitre-techniques"],
    queryFn: () => investigationsService.listMitreTechniques(),
    staleTime: Infinity,
  });
}

export function useValidateScenarioDraft() {
  return useMutation({
    mutationFn: (draft: ScenarioDraft) => scenarioBuilderService.validateDraft(draft),
  });
}

export function usePublishScenarioDraft() {
  return useMutation({
    mutationFn: (draft: ScenarioDraft) => scenarioBuilderService.publishDraft(draft),
  });
}

/** Slug auto-derived from the title unless the author has already hand-edited it. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function useScenarioDraftState() {
  const [draft, setDraft] = useState<ScenarioDraft>(emptyScenarioDraft);
  const [slugTouched, setSlugTouched] = useState(false);

  const setTitle = (title: string) =>
    setDraft((d) => ({ ...d, title, slug: slugTouched ? d.slug : slugify(title) }));
  const setSlug = (slug: string) => {
    setSlugTouched(true);
    setDraft((d) => ({ ...d, slug }));
  };

  return { draft, setDraft, setTitle, setSlug };
}
