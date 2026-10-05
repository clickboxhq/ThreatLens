import { apiClient } from "@/lib/api-client";
import { leaderboardService } from "@/services/leaderboard";
import type { ProfileService } from "./profile-service";
import type { ProfileSummary } from "@/types/profile";
import type { ProfilePerformance } from "@/types/profile-performance";
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

  getPerformance: () => apiClient.get<ProfilePerformance>("/profile/performance"),
};
