CREATE TYPE "public"."golden_image_status" AS ENUM('building', 'ready', 'expired');--> statement-breakpoint
CREATE TYPE "public"."instance_status" AS ENUM('creating', 'running', 'stopped', 'suspended', 'error');--> statement-breakpoint
CREATE TYPE "public"."warm_pool_status" AS ENUM('available', 'claimed', 'expired');--> statement-breakpoint
CREATE TABLE "golden_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"runtime_type" text NOT NULL,
	"version" text NOT NULL,
	"image_ref" text NOT NULL,
	"size_bytes" bigint,
	"status" "golden_image_status" DEFAULT 'building' NOT NULL,
	"built_at" timestamp with time zone,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"runtime_type" text NOT NULL,
	"runtime_config" jsonb,
	"status" "instance_status" DEFAULT 'creating' NOT NULL,
	"url" text,
	"snapshot_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "os_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warm_pool" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"runtime_type" text NOT NULL,
	"image_id" text,
	"runtime_ref" text NOT NULL,
	"status" "warm_pool_status" DEFAULT 'available' NOT NULL,
	"claimed_by" text,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
