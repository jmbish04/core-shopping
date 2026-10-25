CREATE TYPE "public"."route_status" AS ENUM('announced', 'scheduled', 'flying', 'discontinued');--> statement-breakpoint
ALTER TYPE "public"."entity_kind" ADD VALUE 'route' BEFORE 'hotel';--> statement-breakpoint
CREATE TABLE "routes" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"origin" text NOT NULL,
	"destination" text NOT NULL,
	"carrier" text DEFAULT '' NOT NULL,
	"nonstop" boolean,
	"status" "route_status" DEFAULT 'announced' NOT NULL,
	"service_starts_on" date,
	"seat_product" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "routes_pair_idx" ON "routes" USING btree ("origin","destination");--> statement-breakpoint
CREATE INDEX "routes_origin_status_idx" ON "routes" USING btree ("origin","status");