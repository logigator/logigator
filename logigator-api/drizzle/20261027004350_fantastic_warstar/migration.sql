ALTER TABLE "components" ADD COLUMN "checked_digest" char(32);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "checked_digest" char(32);--> statement-breakpoint
-- A text analyzed before checks were recorded counts as checked: its call was
-- made, and an edit moves it past this. Every other text waits for the worker.
UPDATE "components" SET "checked_digest" = "text_digest" WHERE "translated_digest" = "text_digest";--> statement-breakpoint
UPDATE "projects" SET "checked_digest" = "text_digest" WHERE "translated_digest" = "text_digest";
