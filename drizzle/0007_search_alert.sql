CREATE TABLE "search_alert" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"locale" text DEFAULT 'sv' NOT NULL,
	"label" text NOT NULL,
	"municipality_id" text,
	"area_id" text,
	"query" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"token_hash" text NOT NULL,
	"confirmed_at" timestamp with time zone,
	"seen_through" timestamp with time zone DEFAULT now() NOT NULL,
	"last_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "search_alert_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "search_alert" ADD CONSTRAINT "search_alert_municipality_id_municipality_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipality"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_alert" ADD CONSTRAINT "search_alert_area_id_area_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."area"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "search_alert_email_idx" ON "search_alert" USING btree ("email");--> statement-breakpoint
CREATE INDEX "search_alert_confirmed_idx" ON "search_alert" USING btree ("confirmed_at");