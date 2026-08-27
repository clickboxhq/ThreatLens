import { Award, Crosshair, Flame, Radar, ShieldCheck, Timer } from "lucide-react";
import type { AchievementsService } from "./achievements-service";

const badges = [
  {
    icon: ShieldCheck,
    name: "First Conclusion",
    detail: "Close an investigation with a correct verdict",
    got: true,
  },
  {
    icon: Crosshair,
    name: "Evidence Purist",
    detail: "Collect 100% of required artifacts on 5 cases",
    got: true,
  },
  {
    icon: Radar,
    name: "Tactic Breadth",
    detail: "Practice techniques in 10 ATT&CK tactics",
    got: true,
  },
  {
    icon: Timer,
    name: "Under Pressure",
    detail: "Resolve a critical case in under 20 minutes",
    got: false,
  },
  {
    icon: Flame,
    name: "Ransomware Responder",
    detail: "Complete the containment scenario at Expert level",
    got: false,
  },
  {
    icon: Award,
    name: "Cohort Top 5",
    detail: "Finish a month in the top five of your cohort",
    got: true,
  },
];

export const mockAchievementsService: AchievementsService = {
  listAchievements: () => Promise.resolve(badges),
};
