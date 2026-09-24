CREATE TYPE "document_visibility" AS ENUM('private', 'unlisted', 'public');--> statement-breakpoint
DROP INDEX "components_public_idx";--> statement-breakpoint
DROP INDEX "projects_public_idx";--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "visibility" "document_visibility" DEFAULT 'unlisted'::"document_visibility" NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "visibility" "document_visibility" DEFAULT 'unlisted'::"document_visibility" NOT NULL;--> statement-breakpoint
-- Hand-written, between the column arriving and the one it replaces leaving:
-- the states the boolean was carrying. Its `true` was "listed", which is
-- 'public'; its `false` was "the link resolves, nobody is told about it", which
-- is 'unlisted' — the state every row has just been defaulted to, so only the
-- published ones are rewritten. Both states keep their `link`, so every URL
-- already handed out goes on resolving.
UPDATE "components" SET "visibility" = 'public' WHERE "public";--> statement-breakpoint
UPDATE "projects" SET "visibility" = 'public' WHERE "public";--> statement-breakpoint
ALTER TABLE "components" DROP COLUMN "public";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "public";--> statement-breakpoint
CREATE INDEX "components_visibility_idx" ON "components" ("visibility","last_edited_at");--> statement-breakpoint
CREATE INDEX "projects_visibility_idx" ON "projects" ("visibility","last_edited_at");
