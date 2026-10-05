-- New column on an existing table: inherits the table's existing grant to socverse_app, no
-- explicit GRANT needed here.
ALTER TABLE "users" ADD COLUMN "timezone" TEXT;

-- New tables: socverse_app needs an explicit grant (migrations run as a different role).
CREATE TABLE "streak_activity" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "activity_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "streak_activity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "streak_activity_user_id_activity_date_key" ON "streak_activity"("user_id", "activity_date");

ALTER TABLE "streak_activity" ADD CONSTRAINT "streak_activity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "user_streaks" (
    "user_id" UUID NOT NULL,
    "current_streak" INTEGER NOT NULL DEFAULT 0,
    "longest_streak" INTEGER NOT NULL DEFAULT 0,
    "last_activity_date" DATE,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_streaks_pkey" PRIMARY KEY ("user_id")
);

ALTER TABLE "user_streaks" ADD CONSTRAINT "user_streaks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "streak_activity" TO "socverse_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON "user_streaks" TO "socverse_app";
