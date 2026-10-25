ALTER TABLE "users" ADD COLUMN "avatar_id" uuid;--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "preview_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "preview_id" uuid;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "avatar_file";--> statement-breakpoint
ALTER TABLE "components" DROP COLUMN "preview_light_file";--> statement-breakpoint
ALTER TABLE "components" DROP COLUMN "preview_dark_file";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "preview_light_file";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "preview_dark_file";