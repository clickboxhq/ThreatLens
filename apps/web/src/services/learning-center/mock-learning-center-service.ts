import type { LearningCenterService } from "./learning-center-service";

const tracks = [
  { name: "SOC Analyst Track", modules: 14, hours: 22, progress: 74 },
  { name: "Threat Hunter Track", modules: 12, hours: 28, progress: 42 },
  { name: "Incident Responder Track", modules: 10, hours: 18, progress: 88 },
  { name: "Blue Team Fundamentals", modules: 16, hours: 24, progress: 21 },
];

const achievements = [
  { title: "Threat Detective", description: "Solve 50 investigations at ≥90 score" },
  { title: "Zero-day Hunter", description: "Identify novel behaviors in 3 scenarios" },
  { title: "Chain Breaker", description: "Contain a kill chain within 15 minutes" },
  { title: "Golden Ticket", description: "Detect a Kerberos abuse scenario end-to-end" },
];

const certificates = [
  { name: "ThreatLens Certified Analyst — L2", date: "Jun 24, 2026" },
  { name: "Identity Attack Investigation", date: "Jun 12, 2026" },
  { name: "Endpoint Forensics Fundamentals", date: "May 30, 2026" },
  { name: "Email Threat Investigation", date: "May 18, 2026" },
];

export const mockLearningCenterService: LearningCenterService = {
  listTracks: () => Promise.resolve(tracks),
  listAchievements: () => Promise.resolve(achievements),
  listCertificates: () => Promise.resolve(certificates),
};
