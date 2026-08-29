// Backed by SOCVerse's real GET /auth/me (email/displayName/role) plus the Student's own
// all-time leaderboard entry (score/solved/rank) — there is no single "profile" endpoint, so
// this is a view-model type for api-profile-service.ts's composition, not a wire contract.
export type ProfileSummary = {
  name: string;
  initials: string;
  title: string;
  email: string;
  score: string;
  solved: string;
  rank: string;
};

export type SkillMastery = { label: string; value: number };
