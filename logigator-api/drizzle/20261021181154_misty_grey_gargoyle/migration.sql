CREATE TYPE "document_text_origin" AS ENUM('human', 'machine');--> statement-breakpoint
CREATE TABLE "component_texts" (
	"document_id" uuid,
	"language" varchar(8),
	"origin" "document_text_origin",
	"name" varchar(20),
	"description" varchar(2048),
	"source_digest" char(32) NOT NULL,
	"model" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "component_texts_pkey" PRIMARY KEY("document_id","language","origin")
);
--> statement-breakpoint
CREATE TABLE "project_texts" (
	"document_id" uuid,
	"language" varchar(8),
	"origin" "document_text_origin",
	"name" varchar(20),
	"description" varchar(2048),
	"source_digest" char(32) NOT NULL,
	"model" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_texts_pkey" PRIMARY KEY("document_id","language","origin")
);
--> statement-breakpoint
-- `NOT NULL` on the two digests is hand-written: drizzle-kit records it in the
-- snapshot but leaves it out of a generated column's DDL. Every existing row
-- comes out with a null `translated_digest`, so all of them start pending.
ALTER TABLE "components" ADD COLUMN "text_digest" char(32) GENERATED ALWAYS AS (md5("name" || chr(31) || "description")) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "text_language_hint" varchar(8);--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "name_language" varchar(8);--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "description_language" varchar(8);--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "translated_digest" char(32);--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "translation_claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "translation_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "translation_attempt_digest" char(32);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "text_digest" char(32) GENERATED ALWAYS AS (md5("name" || chr(31) || "description")) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "text_language_hint" varchar(8);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "name_language" varchar(8);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "description_language" varchar(8);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "translated_digest" char(32);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "translation_claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "translation_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "translation_attempt_digest" char(32);--> statement-breakpoint
CREATE INDEX "components_translation_pending_idx" ON "components" ("last_edited_at") WHERE "translated_digest" IS DISTINCT FROM "text_digest" AND "visibility" <> 'private';--> statement-breakpoint
CREATE INDEX "projects_translation_pending_idx" ON "projects" ("last_edited_at") WHERE "translated_digest" IS DISTINCT FROM "text_digest" AND "visibility" <> 'private';--> statement-breakpoint
ALTER TABLE "component_texts" ADD CONSTRAINT "component_texts_document_id_components_id_fkey" FOREIGN KEY ("document_id") REFERENCES "components"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_texts" ADD CONSTRAINT "project_texts_document_id_projects_id_fkey" FOREIGN KEY ("document_id") REFERENCES "projects"("id") ON DELETE CASCADE;