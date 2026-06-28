-- AlterEnum: add 'archived' to ClientStatus
-- Uses the safe "recreate type" approach so the migration stays transactional.

CREATE TYPE "ClientStatus_new" AS ENUM ('lead', 'prospect', 'client', 'inactive', 'archived');
ALTER TABLE "Client" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Client" ALTER COLUMN "status" TYPE "ClientStatus_new" USING ("status"::text::"ClientStatus_new");
ALTER TABLE "Client" ALTER COLUMN "status" SET DEFAULT 'lead'::"ClientStatus_new";
DROP TYPE "ClientStatus";
ALTER TYPE "ClientStatus_new" RENAME TO "ClientStatus";
