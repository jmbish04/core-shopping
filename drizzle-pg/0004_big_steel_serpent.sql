CREATE TYPE "public"."brand_stance" AS ENUM('prefer', 'neutral', 'avoid');--> statement-breakpoint
CREATE TYPE "public"."loyalty_program_kind" AS ENUM('airline', 'hotel', 'card', 'rail', 'other');--> statement-breakpoint
CREATE TYPE "public"."person_relationship" AS ENUM('self', 'spouse', 'partner', 'family', 'friend', 'other');--> statement-breakpoint
CREATE TYPE "public"."place_kind" AS ENUM('venue', 'city', 'destination', 'country', 'region');--> statement-breakpoint
CREATE TYPE "public"."place_stance" AS ENUM('love', 'fine', 'avoid', 'played_out');--> statement-breakpoint
CREATE TYPE "public"."taste_affinity" AS ENUM('would_travel', 'love', 'like', 'curious', 'avoid');--> statement-breakpoint
CREATE TYPE "public"."taste_source" AS ENUM('manual', 'spotify', 'agent');--> statement-breakpoint
CREATE TYPE "public"."taste_tier" AS ENUM('big_name', 'rising', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."travel_window_stance" AS ENUM('ideal', 'neutral', 'frowned');--> statement-breakpoint
CREATE TYPE "public"."trip_kind" AS ENUM('vacation', 'work', 'family', 'other');--> statement-breakpoint
CREATE TYPE "public"."trip_source" AS ENUM('manual', 'calendar', 'proposal');--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"relationship" "person_relationship" DEFAULT 'other' NOT NULL,
	"home_country" text DEFAULT '' NOT NULL,
	"shopping_interests" text[] DEFAULT '{}'::text[] NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "people_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text DEFAULT 'household' NOT NULL,
	"min_trip_nights" integer DEFAULT 10 NOT NULL,
	"max_trip_nights" integer DEFAULT 21 NOT NULL,
	"leg_days_min" integer DEFAULT 2 NOT NULL,
	"leg_days_max" integer DEFAULT 3 NOT NULL,
	"home_leg_days_min" integer DEFAULT 4 NOT NULL,
	"home_leg_days_max" integer DEFAULT 5 NOT NULL,
	"max_legs_per_trip" integer DEFAULT 3 NOT NULL,
	"min_days_since_last_trip" integer DEFAULT 120 NOT NULL,
	"time_off_notice_days" integer DEFAULT 60 NOT NULL,
	"max_workdays_off" integer DEFAULT 15 NOT NULL,
	"acceptable_cabins" "cabin_class"[] DEFAULT '{business,premium_economy}'::cabin_class[] NOT NULL,
	"min_premium_legs" integer DEFAULT 1 NOT NULL,
	"points_preferred" boolean DEFAULT true NOT NULL,
	"hotel_bar" text DEFAULT 'Clean, safe, near public transport. Not the Ritz; nothing that adds stress.' NOT NULL,
	"hotel_max_nightly_cents" integer,
	"currency" text DEFAULT 'USD' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"account_label" text DEFAULT '' NOT NULL,
	"points_balance" integer,
	"balance_as_of" timestamp with time zone,
	"elite_tier" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"kind" "loyalty_program_kind" NOT NULL,
	"alliance" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_programs_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "transfer_partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_program_id" uuid NOT NULL,
	"to_program_id" uuid NOT NULL,
	"ratio_from" integer DEFAULT 1 NOT NULL,
	"ratio_to" integer DEFAULT 1 NOT NULL,
	"transfer_days_min" integer,
	"transfer_days_max" integer,
	"bonus_note" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_verified_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "home_airports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"rank" integer DEFAULT 1 NOT NULL,
	"drive_minutes" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "home_airports_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "hotel_brand_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand" text NOT NULL,
	"stance" "brand_stance" DEFAULT 'neutral' NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"since" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "travel_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"stance" "travel_window_stance" NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"recurs_yearly" boolean DEFAULT false NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"person_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"destination" text DEFAULT '' NOT NULL,
	"started_on" date NOT NULL,
	"ended_on" date NOT NULL,
	"kind" "trip_kind" DEFAULT 'vacation' NOT NULL,
	"person_id" uuid,
	"legs" integer DEFAULT 0 NOT NULL,
	"workdays_off" integer,
	"source" "trip_source" DEFAULT 'manual' NOT NULL,
	"source_proposal_id" uuid,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taste_artists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"performer_type" "performer_type" DEFAULT 'artist' NOT NULL,
	"tier" "taste_tier" DEFAULT 'unknown' NOT NULL,
	"affinity" "taste_affinity" DEFAULT 'like' NOT NULL,
	"for_person_id" uuid,
	"source" "taste_source" DEFAULT 'manual' NOT NULL,
	"spotify_artist_id" text DEFAULT '' NOT NULL,
	"entity_id" uuid,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "taste_artists_name_person_key" UNIQUE NULLS NOT DISTINCT("name","performer_type","for_person_id")
);
--> statement-breakpoint
CREATE TABLE "taste_genres" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"affinity" "taste_affinity" DEFAULT 'like' NOT NULL,
	"for_person_id" uuid,
	"source" "taste_source" DEFAULT 'manual' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "taste_genres_name_person_key" UNIQUE NULLS NOT DISTINCT("name","for_person_id")
);
--> statement-breakpoint
CREATE TABLE "venue_stances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_name" text NOT NULL,
	"place_kind" "place_kind" DEFAULT 'destination' NOT NULL,
	"stance" "place_stance" NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"until" date,
	"for_person_id" uuid,
	"entity_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venue_stances_place_person_key" UNIQUE NULLS NOT DISTINCT("place_name","place_kind","for_person_id")
);
--> statement-breakpoint
ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_program_id_loyalty_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."loyalty_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_partners" ADD CONSTRAINT "transfer_partners_from_program_id_loyalty_programs_id_fk" FOREIGN KEY ("from_program_id") REFERENCES "public"."loyalty_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_partners" ADD CONSTRAINT "transfer_partners_to_program_id_loyalty_programs_id_fk" FOREIGN KEY ("to_program_id") REFERENCES "public"."loyalty_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel_windows" ADD CONSTRAINT "travel_windows_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_history" ADD CONSTRAINT "trip_history_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_history" ADD CONSTRAINT "trip_history_source_proposal_id_proposals_id_fk" FOREIGN KEY ("source_proposal_id") REFERENCES "public"."proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taste_artists" ADD CONSTRAINT "taste_artists_for_person_id_people_id_fk" FOREIGN KEY ("for_person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taste_artists" ADD CONSTRAINT "taste_artists_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taste_genres" ADD CONSTRAINT "taste_genres_for_person_id_people_id_fk" FOREIGN KEY ("for_person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_stances" ADD CONSTRAINT "venue_stances_for_person_id_people_id_fk" FOREIGN KEY ("for_person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_stances" ADD CONSTRAINT "venue_stances_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "people_active_idx" ON "people" USING btree ("is_active","display_name");--> statement-breakpoint
CREATE UNIQUE INDEX "preferences_scope_key" ON "preferences" USING btree ("scope");--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_accounts_person_program_key" ON "loyalty_accounts" USING btree ("person_id","program_id");--> statement-breakpoint
CREATE INDEX "loyalty_accounts_program_idx" ON "loyalty_accounts" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "loyalty_programs_kind_idx" ON "loyalty_programs" USING btree ("kind","name");--> statement-breakpoint
CREATE UNIQUE INDEX "transfer_partners_pair_key" ON "transfer_partners" USING btree ("from_program_id","to_program_id");--> statement-breakpoint
CREATE INDEX "transfer_partners_to_idx" ON "transfer_partners" USING btree ("to_program_id","is_active");--> statement-breakpoint
CREATE INDEX "home_airports_rank_idx" ON "home_airports" USING btree ("is_active","rank");--> statement-breakpoint
CREATE UNIQUE INDEX "hotel_brand_rules_brand_key" ON "hotel_brand_rules" USING btree (lower("brand"));--> statement-breakpoint
CREATE INDEX "hotel_brand_rules_stance_idx" ON "hotel_brand_rules" USING btree ("stance");--> statement-breakpoint
CREATE INDEX "travel_windows_range_idx" ON "travel_windows" USING btree ("starts_on","ends_on");--> statement-breakpoint
CREATE INDEX "travel_windows_stance_idx" ON "travel_windows" USING btree ("stance","recurs_yearly");--> statement-breakpoint
CREATE INDEX "travel_windows_person_idx" ON "travel_windows" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "trip_history_ended_idx" ON "trip_history" USING btree ("ended_on");--> statement-breakpoint
CREATE INDEX "trip_history_person_ended_idx" ON "trip_history" USING btree ("person_id","ended_on");--> statement-breakpoint
CREATE INDEX "trip_history_kind_idx" ON "trip_history" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "taste_artists_affinity_idx" ON "taste_artists" USING btree ("affinity","tier");--> statement-breakpoint
CREATE INDEX "taste_artists_source_idx" ON "taste_artists" USING btree ("source");--> statement-breakpoint
CREATE INDEX "taste_artists_entity_idx" ON "taste_artists" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "taste_genres_affinity_idx" ON "taste_genres" USING btree ("affinity");--> statement-breakpoint
CREATE INDEX "venue_stances_stance_idx" ON "venue_stances" USING btree ("stance","place_kind");--> statement-breakpoint
CREATE INDEX "venue_stances_until_idx" ON "venue_stances" USING btree ("until");--> statement-breakpoint
CREATE INDEX "venue_stances_entity_idx" ON "venue_stances" USING btree ("entity_id");