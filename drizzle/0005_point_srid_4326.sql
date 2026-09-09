-- Coordinates were written without an SRID under columns that claimed 4326, so
-- every point sat at SRID 0. The USING clause is what drizzle-kit omits: a bare
-- SET DATA TYPE is rejected because the existing rows do not match the new
-- constraint. The data is already WGS 84; only the label was missing.
ALTER TABLE "area" ALTER COLUMN "centroid" SET DATA TYPE geometry(Point,4326) USING ST_SetSRID("centroid", 4326);--> statement-breakpoint
ALTER TABLE "listing" ALTER COLUMN "location" SET DATA TYPE geometry(Point,4326) USING ST_SetSRID("location", 4326);--> statement-breakpoint
ALTER TABLE "municipality" ALTER COLUMN "centroid" SET DATA TYPE geometry(Point,4326) USING ST_SetSRID("centroid", 4326);
