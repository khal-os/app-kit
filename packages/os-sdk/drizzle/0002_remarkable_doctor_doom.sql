CREATE TYPE "public"."item_type" AS ENUM('app', 'workflow', 'skill', 'template', 'stack', 'agent', 'board', 'hook');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('running', 'success', 'failure', 'error', 'timeout');--> statement-breakpoint
CREATE TYPE "public"."run_trigger" AS ENUM('manual', 'scheduled', 'agent', 'automation');--> statement-breakpoint
CREATE TABLE "app_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"app_version" text,
	"user_id" text,
	"agent_id" text,
	"automation_id" text,
	"trigger" "run_trigger" DEFAULT 'manual' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_ms" integer,
	"status" "run_status" DEFAULT 'running' NOT NULL,
	"cost_tokens" integer,
	"cost_compute_ms" integer,
	"cost_api_calls" integer,
	"output_summary" text,
	"agent_trace" jsonb,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "app_votes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"app_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_votes_user_app_unique" UNIQUE("user_id","app_id")
);
--> statement-breakpoint
ALTER TABLE "app_store" ADD COLUMN "item_type" "item_type" DEFAULT 'app' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_store" ADD COLUMN "contents" jsonb;--> statement-breakpoint
ALTER TABLE "app_store" ADD COLUMN "agent_config" jsonb;--> statement-breakpoint
ALTER TABLE "app_store" ADD COLUMN "idea_id" text;--> statement-breakpoint
ALTER TABLE "app_runs" ADD CONSTRAINT "app_runs_app_id_app_store_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app_store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_votes" ADD CONSTRAINT "app_votes_app_id_app_store_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app_store"("id") ON DELETE no action ON UPDATE no action;