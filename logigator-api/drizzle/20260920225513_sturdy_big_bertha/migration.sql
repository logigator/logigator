ALTER TABLE "users" ADD COLUMN "bio" varchar(500) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "website_url" varchar(2048);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "social_links" jsonb DEFAULT '[]' NOT NULL;