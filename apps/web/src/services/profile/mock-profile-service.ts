import type { ProfileService } from "./profile-service";

const skillMastery = [
  { label: "Identity investigations", value: 92 },
  { label: "Endpoint forensics", value: 84 },
  { label: "Email threat analysis", value: 88 },
  { label: "Cloud attack investigation", value: 71 },
  { label: "Threat hunting", value: 76 },
];

export const mockProfileService: ProfileService = {
  getSummary: () =>
    Promise.resolve({
      name: "John Doe",
      initials: "JD",
      title: "Tier 3 · SOC Manager",
      email: "john.doe@contoso.com",
      score: "9,820",
      solved: "148",
      rank: "#1",
    }),
  listSkillMastery: () => Promise.resolve(skillMastery),
};
