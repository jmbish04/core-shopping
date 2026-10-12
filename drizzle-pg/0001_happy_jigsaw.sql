CREATE TYPE "public"."alert_delivery" AS ENUM('printed', 'listed', 'declined');--> statement-breakpoint
CREATE TYPE "public"."alert_severity" AS ENUM('critical', 'high', 'normal');--> statement-breakpoint
CREATE TYPE "public"."alert_status" AS ENUM('unread', 'read', 'acted', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."alert_trigger" AS ENUM('deal_ending', 'price_in_budget', 'break_rules', 'liked_cheaper');--> statement-breakpoint
CREATE TYPE "public"."flight_cabin" AS ENUM('economy', 'premium_economy', 'business', 'first');--> statement-breakpoint
CREATE TYPE "public"."itinerary_item_kind" AS ENUM('meal', 'activity', 'transit', 'rest', 'shopping', 'checkin', 'flight', 'free');--> statement-breakpoint
CREATE TYPE "public"."lesson_scope" AS ENUM('global', 'category', 'goal');--> statement-breakpoint
CREATE TYPE "public"."lesson_status" AS ENUM('proposed', 'active', 'retired');--> statement-breakpoint
CREATE TYPE "public"."proposal_kind" AS ENUM('item', 'trip');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('queued', 'reviewed_positive', 'reviewed_negative', 'snoozed', 'booked', 'superseded', 'silent_update');--> statement-breakpoint
CREATE TYPE "public"."reason_polarity" AS ENUM('positive', 'negative', 'neutral');--> statement-breakpoint
CREATE TYPE "public"."transit_mode" AS ENUM('walk', 'metro', 'train', 'bus', 'taxi', 'rideshare', 'car', 'ferry', 'flight');--> statement-breakpoint
CREATE TYPE "public"."verdict" AS ENUM('strong_no', 'no', 'somewhat', 'strong_yes');--> statement-breakpoint
CREATE TABLE "proposal_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"entity_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"price_cents" integer,
	"msrp_cents" integer,
	"currency" text,
	"prior_price_cents" integer,
	"note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid,
	"run_id" uuid,
	"kind" "proposal_kind" DEFAULT 'item' NOT NULL,
	"status" "proposal_status" DEFAULT 'queued' NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"why_now" text DEFAULT '' NOT NULL,
	"criteria_met" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"match_score" real,
	"roi_score" real,
	"roi_note" text DEFAULT '' NOT NULL,
	"prior_proposal_id" uuid,
	"silent_reason" text DEFAULT '' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"snooze_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "calendar_checks" (
	"proposal_id" uuid PRIMARY KEY NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"window_start" date NOT NULL,
	"window_end" date NOT NULL,
	"conflicts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"days_since_last_trip" integer,
	"workdays_off_needed" integer,
	"window_stance" text DEFAULT 'unknown' NOT NULL,
	"verdict" text DEFAULT 'unknown' NOT NULL,
	"note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flight_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"carrier" text DEFAULT '' NOT NULL,
	"origin" text NOT NULL,
	"destination" text NOT NULL,
	"depart_at" timestamp with time zone,
	"arrive_at" timestamp with time zone,
	"cabin" "flight_cabin",
	"nonstop" boolean,
	"duration_minutes" integer,
	"seat_product" text DEFAULT '' NOT NULL,
	"cash_cents" integer,
	"currency" text,
	"points_amount" integer,
	"points_program" text,
	"transfer_path" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hotel_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"leg_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"brand" text DEFAULT '' NOT NULL,
	"property_name" text NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"nightly_cents" integer,
	"total_cents" integer,
	"currency" text,
	"points_amount" integer,
	"points_program" text,
	"why" text DEFAULT '' NOT NULL,
	"transit_note" text DEFAULT '' NOT NULL,
	"violates_rule" text,
	"booking_url" text
);
--> statement-breakpoint
CREATE TABLE "itinerary_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"leg_id" uuid NOT NULL,
	"date" date NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"wake_at" time,
	"sleep_in" boolean DEFAULT false NOT NULL,
	"headline" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "itinerary_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"kind" "itinerary_item_kind" DEFAULT 'activity' NOT NULL,
	"title" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"starts_at" time,
	"ends_at" time,
	"depart_by" time,
	"transit_mode" "transit_mode",
	"transit_note" text DEFAULT '' NOT NULL,
	"cost_cents" integer,
	"currency" text,
	"tips" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"booking_url" text,
	"fork_group_id" text,
	"selected" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_legs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"city" text NOT NULL,
	"country" text DEFAULT '' NOT NULL,
	"arrive_on" date,
	"depart_on" date,
	"nights" integer DEFAULT 0 NOT NULL,
	"special" text DEFAULT '' NOT NULL,
	"shopping_note" text DEFAULT '' NOT NULL,
	"scenery_note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_packages" (
	"proposal_id" uuid PRIMARY KEY NOT NULL,
	"origin_airport" text DEFAULT '' NOT NULL,
	"start_on" date,
	"end_on" date,
	"total_nights" integer,
	"est_cash_cents" integer,
	"currency" text DEFAULT 'USD' NOT NULL,
	"est_points" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_evidence" (
	"lesson_id" uuid NOT NULL,
	"review_id" uuid NOT NULL,
	"weight" real DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" "lesson_scope" DEFAULT 'global' NOT NULL,
	"category" "goal_category",
	"goal_id" uuid,
	"statement" text NOT NULL,
	"polarity" "reason_polarity" NOT NULL,
	"confidence" real DEFAULT 0 NOT NULL,
	"status" "lesson_status" DEFAULT 'proposed' NOT NULL,
	"embedding" vector(384),
	"supersedes_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_reason_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"polarity" "reason_polarity" NOT NULL,
	"category" "goal_category",
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"goal_id" uuid,
	"verdict" "verdict" NOT NULL,
	"reason_codes" text[] DEFAULT '{}'::text[] NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"decided_in_ms" integer,
	"embedding" vector(384),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"undone_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trigger" "alert_trigger" NOT NULL,
	"severity" "alert_severity" DEFAULT 'normal' NOT NULL,
	"status" "alert_status" DEFAULT 'unread' NOT NULL,
	"delivery" "alert_delivery" DEFAULT 'listed' NOT NULL,
	"title" text NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"why_now" text DEFAULT '' NOT NULL,
	"goal_id" uuid,
	"proposal_id" uuid,
	"entity_id" uuid,
	"action_url" text,
	"price_cents" integer,
	"msrp_cents" integer,
	"budget_max_cents" integer,
	"currency" text,
	"expires_at" timestamp with time zone,
	"dopamine_notification_id" text,
	"printed_at" timestamp with time zone,
	"suppressed_reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	"acted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "proposal_items" ADD CONSTRAINT "proposal_items_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_items" ADD CONSTRAINT "proposal_items_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_prior_proposal_id_proposals_id_fk" FOREIGN KEY ("prior_proposal_id") REFERENCES "public"."proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_checks" ADD CONSTRAINT "calendar_checks_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flight_options" ADD CONSTRAINT "flight_options_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotel_options" ADD CONSTRAINT "hotel_options_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotel_options" ADD CONSTRAINT "hotel_options_leg_id_trip_legs_id_fk" FOREIGN KEY ("leg_id") REFERENCES "public"."trip_legs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_days" ADD CONSTRAINT "itinerary_days_leg_id_trip_legs_id_fk" FOREIGN KEY ("leg_id") REFERENCES "public"."trip_legs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD CONSTRAINT "itinerary_items_day_id_itinerary_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."itinerary_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_legs" ADD CONSTRAINT "trip_legs_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_packages" ADD CONSTRAINT "trip_packages_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_evidence" ADD CONSTRAINT "lesson_evidence_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_evidence" ADD CONSTRAINT "lesson_evidence_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_supersedes_id_lessons_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "proposal_items_proposal_idx" ON "proposal_items" USING btree ("proposal_id","position");--> statement-breakpoint
CREATE INDEX "proposal_items_entity_idx" ON "proposal_items" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "proposals_status_created_idx" ON "proposals" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "proposals_goal_idx" ON "proposals" USING btree ("goal_id","created_at");--> statement-breakpoint
CREATE INDEX "proposals_prior_idx" ON "proposals" USING btree ("prior_proposal_id");--> statement-breakpoint
CREATE INDEX "proposals_expires_idx" ON "proposals" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "flight_options_proposal_idx" ON "flight_options" USING btree ("proposal_id","position");--> statement-breakpoint
CREATE INDEX "hotel_options_proposal_idx" ON "hotel_options" USING btree ("proposal_id","position");--> statement-breakpoint
CREATE INDEX "itinerary_days_leg_idx" ON "itinerary_days" USING btree ("leg_id","position");--> statement-breakpoint
CREATE INDEX "itinerary_items_day_idx" ON "itinerary_items" USING btree ("day_id","position");--> statement-breakpoint
CREATE INDEX "itinerary_items_fork_idx" ON "itinerary_items" USING btree ("fork_group_id");--> statement-breakpoint
CREATE INDEX "trip_legs_proposal_idx" ON "trip_legs" USING btree ("proposal_id","position");--> statement-breakpoint
CREATE INDEX "lesson_evidence_lesson_idx" ON "lesson_evidence" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "lesson_evidence_review_idx" ON "lesson_evidence" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "lessons_status_scope_idx" ON "lessons" USING btree ("status","scope","confidence");--> statement-breakpoint
CREATE INDEX "lessons_goal_idx" ON "lessons" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "lessons_embedding_hnsw" ON "lessons" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "reason_codes_category_idx" ON "review_reason_codes" USING btree ("category","sort_order");--> statement-breakpoint
CREATE INDEX "reviews_proposal_idx" ON "reviews" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "reviews_goal_created_idx" ON "reviews" USING btree ("goal_id","created_at");--> statement-breakpoint
CREATE INDEX "reviews_embedding_hnsw" ON "reviews" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "alerts_status_created_idx" ON "alerts" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "alerts_printed_idx" ON "alerts" USING btree ("printed_at");--> statement-breakpoint
CREATE INDEX "alerts_entity_trigger_idx" ON "alerts" USING btree ("entity_id","trigger","printed_at");--> statement-breakpoint
CREATE INDEX "alerts_goal_idx" ON "alerts" USING btree ("goal_id","created_at");