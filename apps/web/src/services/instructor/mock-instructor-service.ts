import type { InstructorService } from "./instructor-service";

const cohorts = [
  { name: "TU Berlin — SOC 501", learners: 42, avg: 84, active: 6 },
  { name: "Contoso Academy — Cohort 12", learners: 28, avg: 79, active: 3 },
  { name: "NATO CCDCOE — Blue Team", learners: 18, avg: 91, active: 2 },
  { name: "SANS Alumni Lab", learners: 65, avg: 88, active: 11 },
];

export const mockInstructorService: InstructorService = {
  listCohorts: () => Promise.resolve(cohorts),
};
