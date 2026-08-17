CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"username" varchar(32) NOT NULL,
	"email" varchar(254) NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"password_hash" varchar(72),
	"google_user_id" varchar(64) UNIQUE,
	"avatar_file" varchar(64),
	"member_since" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(20) NOT NULL,
	"description" varchar(2048) DEFAULT '' NOT NULL,
	"document" jsonb NOT NULL,
	"format_version" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"component_count" integer DEFAULT 0 NOT NULL,
	"wire_count" integer DEFAULT 0 NOT NULL,
	"link" uuid DEFAULT gen_random_uuid() NOT NULL UNIQUE,
	"public" boolean DEFAULT false NOT NULL,
	"preview_light_file" varchar(64),
	"preview_dark_file" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_edited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"forked_from_id" uuid,
	"symbol" varchar(5) NOT NULL,
	"num_inputs" integer DEFAULT 0 NOT NULL,
	"num_outputs" integer DEFAULT 0 NOT NULL,
	"labels" text[] DEFAULT '{}'::text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(20) NOT NULL,
	"description" varchar(2048) DEFAULT '' NOT NULL,
	"document" jsonb NOT NULL,
	"format_version" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"component_count" integer DEFAULT 0 NOT NULL,
	"wire_count" integer DEFAULT 0 NOT NULL,
	"link" uuid DEFAULT gen_random_uuid() NOT NULL UNIQUE,
	"public" boolean DEFAULT false NOT NULL,
	"preview_light_file" varchar(64),
	"preview_dark_file" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_edited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"forked_from_id" uuid
);
--> statement-breakpoint
CREATE TABLE "component_dependencies" (
	"dependent_id" uuid,
	"dependency_id" uuid,
	"model_id" integer NOT NULL,
	CONSTRAINT "component_dependencies_pkey" PRIMARY KEY("dependent_id","dependency_id")
);
--> statement-breakpoint
CREATE TABLE "project_dependencies" (
	"dependent_id" uuid,
	"dependency_id" uuid,
	"model_id" integer NOT NULL,
	CONSTRAINT "project_dependencies_pkey" PRIMARY KEY("dependent_id","dependency_id")
);
--> statement-breakpoint
CREATE TABLE "component_stars" (
	"user_id" uuid,
	"component_id" uuid,
	"starred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "component_stars_pkey" PRIMARY KEY("user_id","component_id")
);
--> statement-breakpoint
CREATE TABLE "project_stars" (
	"user_id" uuid,
	"project_id" uuid,
	"starred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_stars_pkey" PRIMARY KEY("user_id","project_id")
);
--> statement-breakpoint
CREATE INDEX "users_username_idx" ON "users" ("username");--> statement-breakpoint
CREATE INDEX "components_user_idx" ON "components" ("user_id");--> statement-breakpoint
CREATE INDEX "components_format_version_idx" ON "components" ("format_version");--> statement-breakpoint
CREATE INDEX "components_public_idx" ON "components" ("public","last_edited_at");--> statement-breakpoint
CREATE INDEX "components_forked_from_idx" ON "components" ("forked_from_id");--> statement-breakpoint
CREATE INDEX "projects_user_idx" ON "projects" ("user_id");--> statement-breakpoint
CREATE INDEX "projects_format_version_idx" ON "projects" ("format_version");--> statement-breakpoint
CREATE INDEX "projects_public_idx" ON "projects" ("public","last_edited_at");--> statement-breakpoint
CREATE INDEX "projects_forked_from_idx" ON "projects" ("forked_from_id");--> statement-breakpoint
CREATE INDEX "component_dependencies_dependency_idx" ON "component_dependencies" ("dependency_id");--> statement-breakpoint
CREATE INDEX "project_dependencies_dependency_idx" ON "project_dependencies" ("dependency_id");--> statement-breakpoint
CREATE INDEX "component_stars_component_idx" ON "component_stars" ("component_id");--> statement-breakpoint
CREATE INDEX "project_stars_project_idx" ON "project_stars" ("project_id");--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_forked_from_id_components_id_fkey" FOREIGN KEY ("forked_from_id") REFERENCES "components"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_forked_from_id_projects_id_fkey" FOREIGN KEY ("forked_from_id") REFERENCES "projects"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "component_dependencies" ADD CONSTRAINT "component_dependencies_dependent_id_components_id_fkey" FOREIGN KEY ("dependent_id") REFERENCES "components"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "component_dependencies" ADD CONSTRAINT "component_dependencies_dependency_id_components_id_fkey" FOREIGN KEY ("dependency_id") REFERENCES "components"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_dependencies" ADD CONSTRAINT "project_dependencies_dependent_id_projects_id_fkey" FOREIGN KEY ("dependent_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_dependencies" ADD CONSTRAINT "project_dependencies_dependency_id_components_id_fkey" FOREIGN KEY ("dependency_id") REFERENCES "components"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "component_stars" ADD CONSTRAINT "component_stars_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "component_stars" ADD CONSTRAINT "component_stars_component_id_components_id_fkey" FOREIGN KEY ("component_id") REFERENCES "components"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_stars" ADD CONSTRAINT "project_stars_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_stars" ADD CONSTRAINT "project_stars_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;