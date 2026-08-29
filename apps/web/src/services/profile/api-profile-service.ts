import { apiClient } from "@/lib/api-client";
import { sessionsService } from "@/services/sessions";
import { leaderboardService } from "@/services/leaderboard";
import type { ProfileService } from "./profile-service";
import type { ProfileSummary, SkillMastery } from "@/types/profile";
import type { AuthRole } from "@/lib/auth-store";

interface MeResponse {
  id: string;
  email: string;
  displayName: string;
  role: AuthRole;
  emailVerified: boolean;
  createdAt: string;
}

const ROLE_LABELS: Record<AuthRole, string> = {
  student: "Student",
  instructor: "Instructor",
  org_admin: "Organization Admin",
  platform_admin: "Platform Admin",
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

function humanizeCategory(category: string): string {
  return category
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

export const apiProfileService: ProfileService = {
  getSummary: async () => {
    const [me, leaderboard] = await Promise.all([
      apiClient.get<MeResponse>("/auth/me"),
      leaderboardService.get("all_time", "global"),
    ]);
    const myEntry = leaderboard.myEntry;

    const summary: ProfileSummary = {
      name: me.displayName,
      initials: initialsOf(me.displayName),
      title: ROLE_LABELS[me.role] ?? me.role,
      email: me.email,
      score: myEntry ? myEntry.points.toLocaleString() : "—",
      solved: myEntry ? String(myEntry.completions) : "0",
      rank: myEntry ? `#${myEntry.rank}` : "Unranked",
    };
    return summary;
  },

  listSkillMastery: async () => {
    const sessions = await sessionsService.listMine();
    const scoredByCategory = new Map<string, number[]>();
    for (const s of sessions) {
      if (s.overallPercent === null) continue;
      const list = scoredByCategory.get(s.scenarioCategory) ?? [];
      list.push(s.overallPercent);
      scoredByCategory.set(s.scenarioCategory, list);
    }

    const mastery: SkillMastery[] = [...scoredByCategory.entries()]
      .map(([category, percents]) => ({
        label: humanizeCategory(category),
        value: Math.round(percents.reduce((sum, p) => sum + p, 0) / percents.length),
      }))
      .sort((a, b) => b.value - a.value);

    return mastery;
  },
};
