CREATE TYPE "document_kind" AS ENUM('project', 'component');--> statement-breakpoint
CREATE TYPE "report_reason" AS ENUM('illegal', 'copyright', 'personal_data', 'harassment', 'spam', 'other');--> statement-breakpoint
CREATE TABLE "document_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"document_kind" "document_kind" NOT NULL,
	"document_id" uuid NOT NULL,
	"reason" "report_reason" NOT NULL,
	"explanation" varchar(2000) NOT NULL,
	"contact_email" varchar(254),
	"reporter_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolution" varchar(500)
);
--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "hidden_reason" varchar(500);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "hidden_reason" varchar(500);--> statement-breakpoint
DROP INDEX "components_translation_pending_idx";--> statement-breakpoint
CREATE INDEX "components_translation_pending_idx" ON "components" ("last_edited_at") WHERE "translated_digest" IS DISTINCT FROM "text_digest" AND "visibility" <> 'private' AND "hidden_at" IS NULL AND NOT ("translation_attempt_digest" = "text_digest" AND "translation_attempts" >= 3);--> statement-breakpoint
DROP INDEX "projects_translation_pending_idx";--> statement-breakpoint
CREATE INDEX "projects_translation_pending_idx" ON "projects" ("last_edited_at") WHERE "translated_digest" IS DISTINCT FROM "text_digest" AND "visibility" <> 'private' AND "hidden_at" IS NULL AND NOT ("translation_attempt_digest" = "text_digest" AND "translation_attempts" >= 3);--> statement-breakpoint
CREATE INDEX "document_reports_document_idx" ON "document_reports" ("document_kind","document_id");--> statement-breakpoint
ALTER TABLE "document_reports" ADD CONSTRAINT "document_reports_reporter_id_users_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL;