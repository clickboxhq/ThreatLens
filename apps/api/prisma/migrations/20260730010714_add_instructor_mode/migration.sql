-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('active', 'dropped');

-- AlterTable
ALTER TABLE "investigation_sessions" ADD COLUMN     "cohort_assignment_id" UUID;

-- CreateTable
CREATE TABLE "cohorts" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "join_code" TEXT,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cohorts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cohort_enrollments" (
    "id" UUID NOT NULL,
    "cohort_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "cohort_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cohort_scenario_assignments" (
    "id" UUID NOT NULL,
    "cohort_id" UUID NOT NULL,
    "scenario_id" UUID NOT NULL,
    "due_at" TIMESTAMP(3),
    "attempt_limit" INTEGER,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cohort_scenario_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instructor_feedback" (
    "id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "instructor_id" UUID NOT NULL,
    "rubric_overrides" JSONB,
    "comment" TEXT,
    "reopened_session" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instructor_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cohorts_join_code_key" ON "cohorts"("join_code");

-- CreateIndex
CREATE UNIQUE INDEX "cohort_enrollments_cohort_id_user_id_key" ON "cohort_enrollments"("cohort_id", "user_id");

-- CreateIndex
CREATE INDEX "cohort_scenario_assignments_cohort_id_idx" ON "cohort_scenario_assignments"("cohort_id");

-- CreateIndex
CREATE INDEX "instructor_feedback_incident_id_idx" ON "instructor_feedback"("incident_id");

-- AddForeignKey
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_enrollments" ADD CONSTRAINT "cohort_enrollments_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_enrollments" ADD CONSTRAINT "cohort_enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_scenario_assignments" ADD CONSTRAINT "cohort_scenario_assignments_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_scenario_assignments" ADD CONSTRAINT "cohort_scenario_assignments_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "attack_scenarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_scenario_assignments" ADD CONSTRAINT "cohort_scenario_assignments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_feedback" ADD CONSTRAINT "instructor_feedback_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_feedback" ADD CONSTRAINT "instructor_feedback_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_sessions" ADD CONSTRAINT "investigation_sessions_cohort_assignment_id_fkey" FOREIGN KEY ("cohort_assignment_id") REFERENCES "cohort_scenario_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
