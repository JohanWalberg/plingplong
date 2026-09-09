CREATE TYPE "public"."location_precision" AS ENUM('exact', 'area', 'municipality');--> statement-breakpoint
ALTER TABLE "listing" ADD COLUMN "location_precision" "location_precision";