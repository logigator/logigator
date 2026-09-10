DROP INDEX "component_stars_component_idx";--> statement-breakpoint
CREATE INDEX "component_stars_component_idx" ON "component_stars" ("component_id","starred_at");--> statement-breakpoint
DROP INDEX "project_stars_project_idx";--> statement-breakpoint
CREATE INDEX "project_stars_project_idx" ON "project_stars" ("project_id","starred_at");