export type Cohort = {
  id: string;
  name: string;
  learners: number;
  track: string;
  progress: number;
  avg: number;
  instructor: string;
};

export type CohortStats = {
  activeCohorts: number;
  enrolledAnalysts: number;
  averageScore: number;
  atRiskLearners: number;
};

export type TrackCompletion = { label: string; value: string; meter: number };
