ALTER TABLE "components" RENAME COLUMN "translated_digest" TO "analyzed_digest";--> statement-breakpoint
ALTER TABLE "components" RENAME COLUMN "translation_claimed_at" TO "analysis_claimed_at";--> statement-breakpoint
ALTER TABLE "components" RENAME COLUMN "translation_attempts" TO "analysis_attempts";--> statement-breakpoint
ALTER TABLE "components" RENAME COLUMN "translation_attempt_digest" TO "analysis_attempt_digest";--> statement-breakpoint
ALTER TABLE "projects" RENAME COLUMN "translated_digest" TO "analyzed_digest";--> statement-breakpoint
ALTER TABLE "projects" RENAME COLUMN "translation_claimed_at" TO "analysis_claimed_at";--> statement-breakpoint
ALTER TABLE "projects" RENAME COLUMN "translation_attempts" TO "analysis_attempts";--> statement-breakpoint
ALTER TABLE "projects" RENAME COLUMN "translation_attempt_digest" TO "analysis_attempt_digest";--> statement-breakpoint
-- The partial indexes' predicates follow the renamed columns on their own.
ALTER INDEX "components_translation_pending_idx" RENAME TO "components_analysis_pending_idx";--> statement-breakpoint
ALTER INDEX "projects_translation_pending_idx" RENAME TO "projects_analysis_pending_idx";
