-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfa_recovery_codes_hash" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "mfa_secret" TEXT;
