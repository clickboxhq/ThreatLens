-- CreateEnum
CREATE TYPE "CareerTrack" AS ENUM ('soc_analyst', 'blue_team');

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "career_track" "CareerTrack" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_paths" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "pass_threshold_percent" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_path_scenarios" (
    "learning_path_id" UUID NOT NULL,
    "scenario_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "learning_path_scenarios_pkey" PRIMARY KEY ("learning_path_id","scenario_id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "learning_path_id" UUID NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score_snapshot" JSONB NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "certificates_user_id_learning_path_id_key" ON "certificates"("user_id", "learning_path_id");

-- AddForeignKey
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_path_scenarios" ADD CONSTRAINT "learning_path_scenarios_learning_path_id_fkey" FOREIGN KEY ("learning_path_id") REFERENCES "learning_paths"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_path_scenarios" ADD CONSTRAINT "learning_path_scenarios_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "attack_scenarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_learning_path_id_fkey" FOREIGN KEY ("learning_path_id") REFERENCES "learning_paths"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
