ALTER TABLE "components" ADD COLUMN "document_bytes" integer GENERATED ALWAYS AS (octet_length("document"::text)) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "preview_bytes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "document_bytes" integer GENERATED ALWAYS AS (octet_length("document"::text)) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "preview_bytes" integer DEFAULT 0 NOT NULL;