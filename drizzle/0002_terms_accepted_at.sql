ALTER TABLE "landlord" ADD COLUMN "terms_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "landlord_application" ADD COLUMN "terms_accepted_at" timestamp with time zone;