CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."installed_app_status" AS ENUM('installed', 'running', 'stopped', 'error');--> statement-breakpoint
CREATE TABLE "app_store" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"icon_url" text,
	"icon_lucide" text,
	"short_description" text,
	"description" text,
	"screenshots" text[],
	"video_url" text,
	"banner_url" text,
	"author_name" text,
	"author_url" text,
	"author_verified" boolean DEFAULT false,
	"repo_url" text NOT NULL,
	"version" text,
	"license" text,
	"category" text,
	"tags" text[],
	"is_official" boolean DEFAULT false,
	"is_experimental" boolean DEFAULT false,
	"download_count" integer DEFAULT 0,
	"approval_status" "approval_status" DEFAULT 'pending' NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"submitted_by" text,
	"submitted_at" timestamp with time zone,
	"rejection_reason" text,
	"runtime_tier" text,
	"min_role" text,
	"permission" text,
	"nats_prefix" text,
	"default_width" integer,
	"default_height" integer,
	"full_size_content" boolean DEFAULT false,
	"permissions_required" text[],
	"manifest_json" jsonb,
	"current_version" text,
	"git_branch" text,
	"git_commit" text,
	"changelog" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_store_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "app_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"version" text NOT NULL,
	"git_branch" text,
	"git_commit" text,
	"changelog" text,
	"manifest_json" jsonb,
	"published_by" text,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "installed_apps" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text,
	"slug" text NOT NULL,
	"path" text NOT NULL,
	"status" "installed_app_status" DEFAULT 'installed' NOT NULL,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"installed_by" text,
	"config" jsonb,
	CONSTRAINT "installed_apps_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "app_versions" ADD CONSTRAINT "app_versions_app_id_app_store_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app_store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installed_apps" ADD CONSTRAINT "installed_apps_app_id_app_store_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app_store"("id") ON DELETE no action ON UPDATE no action;