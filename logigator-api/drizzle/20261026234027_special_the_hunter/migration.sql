CREATE TYPE "hidden_by" AS ENUM('moderator', 'machine');--> statement-breakpoint
CREATE TYPE "report_source" AS ENUM('reader', 'machine');--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "hidden_by" "hidden_by";--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "hidden_category" "report_reason";--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "moderated_digest" char(32);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "hidden_by" "hidden_by";--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "hidden_category" "report_reason";--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "moderated_digest" char(32);--> statement-breakpoint
ALTER TABLE "document_reports" ADD COLUMN "source" "report_source" DEFAULT 'reader'::"report_source" NOT NULL;--> statement-breakpoint
ALTER TABLE "document_reports" ADD COLUMN "text_digest" char(32);--> statement-breakpoint
UPDATE "components" SET "hidden_by" = 'moderator' WHERE "hidden_at" IS NOT NULL;--> statement-breakpoint
UPDATE "projects" SET "hidden_by" = 'moderator' WHERE "hidden_at" IS NOT NULL;