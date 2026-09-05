CREATE TYPE "public"."application_status" AS ENUM('pending', 'needs_info', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."apply_route" AS ENUM('url', 'contact');--> statement-breakpoint
CREATE TYPE "public"."source_consent" AS ENUM('unknown', 'consented', 'objected', 'silent');--> statement-breakpoint
CREATE TYPE "public"."contract_type" AS ENUM('first_hand', 'sublet');--> statement-breakpoint
CREATE TYPE "public"."duplicate_decision" AS ENUM('pending', 'merged', 'not_duplicate', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."landlord_role" AS ENUM('owner', 'editor');--> statement-breakpoint
CREATE TYPE "public"."landlord_type" AS ENUM('municipal', 'private', 'agency', 'foundation');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('draft', 'active', 'unpublished', 'expired', 'removed', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."publishing_route" AS ENUM('source', 'manual');--> statement-breakpoint
CREATE TYPE "public"."queue_requirement" AS ENUM('none', 'queue', 'points', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."segment" AS ENUM('none', 'student', 'youth', 'senior', 'accessible');--> statement-breakpoint
CREATE TYPE "public"."source_kind" AS ENUM('feed', 'api', 'html', 'manual');--> statement-breakpoint
CREATE TYPE "public"."source_status" AS ENUM('pending', 'active', 'degraded', 'failed', 'disabled', 'needs_review');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('support', 'lead', 'engineer');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"issuer" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "area" (
	"id" text PRIMARY KEY NOT NULL,
	"municipality_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"centroid" geometry(point),
	"geom" geometry(MultiPolygon, 4326),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "duplicate_candidate" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_a_id" text NOT NULL,
	"listing_b_id" text NOT NULL,
	"score" numeric(4, 3) NOT NULL,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"decision" "duplicate_decision" DEFAULT 'pending' NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "landlord" (
	"id" text PRIMARY KEY NOT NULL,
	"org_number" text,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"website" text,
	"type" "landlord_type" DEFAULT 'private' NOT NULL,
	"queue_type" "queue_requirement" DEFAULT 'unknown' NOT NULL,
	"queue_info_url" text,
	"description_sv" text,
	"description_en" text,
	"logo_url" text,
	"approved_at" timestamp with time zone,
	"is_known" boolean DEFAULT true NOT NULL,
	"is_monitored" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "landlord_org_number_unique" UNIQUE("org_number"),
	CONSTRAINT "landlord_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "landlord_application" (
	"id" text PRIMARY KEY NOT NULL,
	"org_number" text NOT NULL,
	"company_name" text NOT NULL,
	"website" text,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text,
	"publishing_route" "publishing_route" NOT NULL,
	"source_url" text,
	"automated_checks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "application_status" DEFAULT 'pending' NOT NULL,
	"user_id" text,
	"landlord_id" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"decision_note" text,
	"locale" text DEFAULT 'sv' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "landlord_application_event" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"kind" text NOT NULL,
	"message" text,
	"actor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "landlord_invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"landlord_id" text NOT NULL,
	"email" text NOT NULL,
	"role" "landlord_role" DEFAULT 'editor' NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "landlord_invitation_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "landlord_member" (
	"user_id" text NOT NULL,
	"landlord_id" text NOT NULL,
	"role" "landlord_role" DEFAULT 'editor' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "landlord_member_user_id_landlord_id_pk" PRIMARY KEY("user_id","landlord_id")
);
--> statement-breakpoint
CREATE TABLE "landlord_municipality" (
	"landlord_id" text NOT NULL,
	"municipality_id" text NOT NULL,
	CONSTRAINT "landlord_municipality_landlord_id_municipality_id_pk" PRIMARY KEY("landlord_id","municipality_id")
);
--> statement-breakpoint
CREATE TABLE "listing" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"landlord_id" text NOT NULL,
	"municipality_id" text NOT NULL,
	"area_id" text,
	"address" text NOT NULL,
	"postcode" text,
	"area_name" text,
	"location" geometry(point),
	"rent_monthly" integer,
	"rooms" real,
	"size_sqm" real,
	"floor" integer,
	"floors_total" integer,
	"contract_type" "contract_type" DEFAULT 'first_hand' NOT NULL,
	"move_in_date" date,
	"application_deadline" date,
	"queue_requirement" "queue_requirement" DEFAULT 'unknown' NOT NULL,
	"segment" "segment" DEFAULT 'none' NOT NULL,
	"apply_route" "apply_route" DEFAULT 'url' NOT NULL,
	"application_url" text,
	"application_contact" text,
	"description" text,
	"image_url" text,
	"external_id" text,
	"status" "listing_status" DEFAULT 'active' NOT NULL,
	"published_directly" boolean DEFAULT false NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"unpublished_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" text,
	"merged_into_id" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "listing_image" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"storage_key" text NOT NULL,
	"width" integer,
	"height" integer,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_metric_daily" (
	"listing_id" text NOT NULL,
	"day" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"outbound_clicks" integer DEFAULT 0 NOT NULL,
	"saves" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "listing_metric_daily_listing_id_day_pk" PRIMARY KEY("listing_id","day")
);
--> statement-breakpoint
CREATE TABLE "listing_revision" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"field" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"changed_by" text,
	"origin" text DEFAULT 'crawl' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_source" (
	"listing_id" text NOT NULL,
	"source_id" text NOT NULL,
	"external_id" text NOT NULL,
	"source_url" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"present_at_last_check" boolean DEFAULT true NOT NULL,
	"raw_payload" jsonb,
	"raw_payload_at" timestamp with time zone,
	CONSTRAINT "listing_source_listing_id_source_id_pk" PRIMARY KEY("listing_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "municipality" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name_sv" text NOT NULL,
	"name_en" text NOT NULL,
	"slug_sv" text NOT NULL,
	"slug_en" text NOT NULL,
	"county" text NOT NULL,
	"county_sv" text NOT NULL,
	"county_en" text NOT NULL,
	"centroid" geometry(point),
	"geom" geometry(MultiPolygon, 4326),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "municipality_code_unique" UNIQUE("code"),
	CONSTRAINT "municipality_slug_sv_unique" UNIQUE("slug_sv"),
	CONSTRAINT "municipality_slug_en_unique" UNIQUE("slug_en")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "source" (
	"id" text PRIMARY KEY NOT NULL,
	"landlord_id" text NOT NULL,
	"kind" "source_kind" NOT NULL,
	"adapter" text DEFAULT 'generic-xml' NOT NULL,
	"url" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"fetch_interval_minutes" integer DEFAULT 60 NOT NULL,
	"status" "source_status" DEFAULT 'pending' NOT NULL,
	"consent" "source_consent" DEFAULT 'unknown' NOT NULL,
	"queue_default" "queue_requirement",
	"tech_contact_email" text,
	"last_run_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_run" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"ok" boolean,
	"listings_found" integer,
	"listings_new" integer,
	"listings_updated" integer,
	"listings_gone" integer,
	"error_class" text,
	"error_detail" text,
	"anomaly" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_user" (
	"user_id" text PRIMARY KEY NOT NULL,
	"role" "staff_role" DEFAULT 'support' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"locale" text DEFAULT 'sv' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "area" ADD CONSTRAINT "area_municipality_id_municipality_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipality"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_candidate" ADD CONSTRAINT "duplicate_candidate_listing_a_id_listing_id_fk" FOREIGN KEY ("listing_a_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_candidate" ADD CONSTRAINT "duplicate_candidate_listing_b_id_listing_id_fk" FOREIGN KEY ("listing_b_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landlord_application" ADD CONSTRAINT "landlord_application_landlord_id_landlord_id_fk" FOREIGN KEY ("landlord_id") REFERENCES "public"."landlord"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landlord_application_event" ADD CONSTRAINT "landlord_application_event_application_id_landlord_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."landlord_application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landlord_invitation" ADD CONSTRAINT "landlord_invitation_landlord_id_landlord_id_fk" FOREIGN KEY ("landlord_id") REFERENCES "public"."landlord"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landlord_member" ADD CONSTRAINT "landlord_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landlord_member" ADD CONSTRAINT "landlord_member_landlord_id_landlord_id_fk" FOREIGN KEY ("landlord_id") REFERENCES "public"."landlord"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landlord_municipality" ADD CONSTRAINT "landlord_municipality_landlord_id_landlord_id_fk" FOREIGN KEY ("landlord_id") REFERENCES "public"."landlord"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landlord_municipality" ADD CONSTRAINT "landlord_municipality_municipality_id_municipality_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipality"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing" ADD CONSTRAINT "listing_landlord_id_landlord_id_fk" FOREIGN KEY ("landlord_id") REFERENCES "public"."landlord"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing" ADD CONSTRAINT "listing_municipality_id_municipality_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipality"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing" ADD CONSTRAINT "listing_area_id_area_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."area"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_image" ADD CONSTRAINT "listing_image_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_metric_daily" ADD CONSTRAINT "listing_metric_daily_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_revision" ADD CONSTRAINT "listing_revision_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_source" ADD CONSTRAINT "listing_source_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_source" ADD CONSTRAINT "listing_source_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source" ADD CONSTRAINT "source_landlord_id_landlord_id_fk" FOREIGN KEY ("landlord_id") REFERENCES "public"."landlord"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_run" ADD CONSTRAINT "source_run_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_user" ADD CONSTRAINT "staff_user_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_account_uq" ON "account" USING btree ("issuer","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "area_muni_slug_uq" ON "area" USING btree ("municipality_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "duplicate_pair_uq" ON "duplicate_candidate" USING btree ("listing_a_id","listing_b_id");--> statement-breakpoint
CREATE INDEX "duplicate_decision_idx" ON "duplicate_candidate" USING btree ("decision");--> statement-breakpoint
CREATE INDEX "landlord_monitored_idx" ON "landlord" USING btree ("is_monitored");--> statement-breakpoint
CREATE INDEX "landlord_application_status_idx" ON "landlord_application" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "landlord_invitation_landlord_idx" ON "landlord_invitation" USING btree ("landlord_id");--> statement-breakpoint
CREATE INDEX "listing_muni_status_rent_idx" ON "listing" USING btree ("municipality_id","status","rent_monthly");--> statement-breakpoint
CREATE INDEX "listing_status_last_seen_idx" ON "listing" USING btree ("status","last_seen_at");--> statement-breakpoint
CREATE INDEX "listing_status_first_seen_idx" ON "listing" USING btree ("status","first_seen_at");--> statement-breakpoint
CREATE INDEX "listing_landlord_idx" ON "listing" USING btree ("landlord_id");--> statement-breakpoint
CREATE INDEX "listing_location_gix" ON "listing" USING gist ("location");--> statement-breakpoint
CREATE INDEX "listing_image_listing_idx" ON "listing_image" USING btree ("listing_id","position");--> statement-breakpoint
CREATE INDEX "listing_revision_listing_idx" ON "listing_revision" USING btree ("listing_id","changed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_source_external_uq" ON "listing_source" USING btree ("source_id","external_id");--> statement-breakpoint
CREATE INDEX "municipality_centroid_gix" ON "municipality" USING gist ("centroid");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "source_landlord_idx" ON "source" USING btree ("landlord_id");--> statement-breakpoint
CREATE INDEX "source_status_idx" ON "source" USING btree ("status");--> statement-breakpoint
CREATE INDEX "source_run_source_started_idx" ON "source_run" USING btree ("source_id","started_at");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");