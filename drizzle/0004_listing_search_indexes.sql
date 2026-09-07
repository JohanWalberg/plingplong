CREATE INDEX "listing_status_checked_idx" ON "listing" USING btree ("status","last_checked_at");--> statement-breakpoint
CREATE INDEX "listing_status_deadline_idx" ON "listing" USING btree ("status","application_deadline");--> statement-breakpoint
CREATE INDEX "listing_area_status_idx" ON "listing" USING btree ("area_id","status");--> statement-breakpoint
CREATE INDEX "listing_slug_pattern_idx" ON "listing" USING btree ("slug" text_pattern_ops);