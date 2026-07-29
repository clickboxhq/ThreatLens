# 13. Learning Platform

## 13.1 Courses and Labs

A `courses` (§6.21) row is a thematic grouping of content (e.g., "Identity Threat Investigation Fundamentals") tagged to a `career_track`. Each course contains one or more `learning_paths`, and each learning path is an ordered sequence of `attack_scenarios` (via `learning_path_scenarios`, §6.21) — "labs" in the product brief's terminology map directly onto individual scenario attempts (§6.9's `investigation_sessions`) taken in the context of a learning path, not a separate content type; this avoids maintaining two parallel content models (standalone labs vs. scenarios) for what is pedagogically the same underlying unit of work.

## 13.2 Progress Tracking

Per-user, per-learning-path progress is a derived view (not a separately stored table at MVP) over `investigation_sessions` + `scores`, computed as: which `learning_path_scenarios` have at least one session meeting `pass_threshold_percent` (§6.21), in what order they were completed, and best/most-recent score per scenario. This view backs both the Student-facing progress bar on a learning path's landing page and the Analytics dashboards (§2.17). Computing it on read (with the short-TTL Redis caching pattern from §5.4) rather than maintaining a separate progress-state table is the correct MVP trade-off because the source data (`investigation_sessions`, `scores`) is already the single source of truth — a separate progress table would require careful invalidation logic for no accuracy benefit at this data volume.

## 13.3 Achievements

`achievements` (§6.21) are awarded by a background job (`reporting` queue, §5.9, or a dedicated lightweight `achievements` job triggered on session submission) evaluating each active achievement's `criteria` JSONB against the submitting user's updated history — e.g., `{"type": "category_mastery", "category": "ransomware", "min_sessions": 5, "min_avg_score": 90}`. Achievement criteria are evaluated only on submission events, not via a continuous polling scan, so this stays cheap at scale (§3.3). Earned achievements are recorded in `user_achievements` and surfaced on the Student's profile and, optionally, on the leaderboard (§13.5) as a visible badge.

## 13.4 Certificates

Covered structurally in §6.18/§2.18. Issuance flow: on learning-path completion meeting `pass_threshold_percent`, a `reporting` queue job renders a PDF (server-side HTML-to-PDF rendering, using the same rendering approach as incident report export, §2.19, for one consistent PDF pipeline rather than two) embedding the learner's name, path title, completion date, and a QR code/URL to the public verification page (`/verify/{certificate_uuid}`, §2.18), stores it in the `certificates` object storage bucket (§5.11), and inserts the `certificates` row with a `score_snapshot` so the certificate's displayed data remains stable and renderable even after the underlying session telemetry is archived per the 90-day retention policy (§6.23).

## 13.5 Leaderboards

`leaderboard_entries` (§6.21) are recomputed by the scheduled rollup job (§5.12) per `period` (`weekly`/`monthly`/`all_time`), ranking users by a points formula combining scenario completions, average score, and a difficulty multiplier (an `expert`-tier completion is worth more points than a `beginner`-tier completion at the same score, so the leaderboard rewards tackling harder content rather than farming easy scenarios). Leaderboards are scoped three ways in the UI: global, within-org (institutional/enterprise customers, §2.16), and within-cohort (Instructor Mode, §2.15) — all three read from the same underlying `leaderboard_entries` table filtered by `org_id`/cohort membership, not three separate tables. Participation is opt-in at the account level (a `users` preference, not modeled as a separate column in §6.3's table but implied as part of the account-settings surface, §17) since some institutional buyers' learners may be uncomfortable with public ranking.

## 13.6 Learning Paths and Career Tracks

At MVP launch, two `career_track` values are seeded: **SOC Analyst Career Track** (breadth-first: one learning path touching each category in §1.8 at `beginner` difficulty, then a second pass at `intermediate`) and **Blue Team Career Track** (depth-first: multiple learning paths per category — e.g., three consecutive ransomware-focused paths at increasing difficulty — aimed at learners specializing rather than surveying). Both tracks are simply curated `courses`/`learning_paths` content, not distinct code paths — the "career track" concept is a content-organization and marketing construct (used in course-catalog browsing/filtering, §17) layered on top of the same scenario/learning-path data model, keeping the platform capable of adding new tracks purely through content authoring (§12.1) with no engineering work required.

## 13.7 Instructor-Facing Learning Platform Features

Cohort scenario assignment (§2.15, `cohort_scenario_assignments`, §6.6) can target either an individual `attack_scenarios` row or an entire `learning_paths` row (assigning the whole path assigns every scenario in it with the same due date, recorded as one assignment row referencing the path, resolved to individual scenario obligations by the gradebook view rather than expanded into N rows at assignment time — keeping the assignment model simple and the due-date edit a single-row update).
