CREATE TYPE "public"."wishlist_status" AS ENUM('wanted', 'acquired', 'dropped');--> statement-breakpoint
CREATE TABLE "wishlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"for_person_id" uuid,
	"category" "goal_category" DEFAULT 'product' NOT NULL,
	"target_price_cents" integer,
	"msrp_cents" integer,
	"currency" text DEFAULT 'USD' NOT NULL,
	"hard_requirements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"matched_entity_id" uuid,
	"status" "wishlist_status" DEFAULT 'wanted' NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sightings" ADD COLUMN "wishlist_item_id" uuid;--> statement-breakpoint
ALTER TABLE "proposal_items" ADD COLUMN "wishlist_item_id" uuid;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_for_person_id_people_id_fk" FOREIGN KEY ("for_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_matched_entity_id_entities_id_fk" FOREIGN KEY ("matched_entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wishlist_items_status_category_idx" ON "wishlist_items" USING btree ("status","category");--> statement-breakpoint
CREATE INDEX "wishlist_items_added_idx" ON "wishlist_items" USING btree ("added_at");--> statement-breakpoint
CREATE INDEX "wishlist_items_person_idx" ON "wishlist_items" USING btree ("for_person_id");--> statement-breakpoint
CREATE INDEX "wishlist_items_matched_idx" ON "wishlist_items" USING btree ("matched_entity_id");--> statement-breakpoint
ALTER TABLE "sightings" ADD CONSTRAINT "sightings_wishlist_item_id_wishlist_items_id_fk" FOREIGN KEY ("wishlist_item_id") REFERENCES "public"."wishlist_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_items" ADD CONSTRAINT "proposal_items_wishlist_item_id_wishlist_items_id_fk" FOREIGN KEY ("wishlist_item_id") REFERENCES "public"."wishlist_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sightings_wishlist_idx" ON "sightings" USING btree ("wishlist_item_id","seen_at");