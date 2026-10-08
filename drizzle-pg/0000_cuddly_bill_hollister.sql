CREATE TYPE "public"."agent_client" AS ENUM('claude', 'gpt', 'gemini', 'browser', 'other');--> statement-breakpoint
CREATE TYPE "public"."author_kind" AS ENUM('user', 'agent', 'system');--> statement-breakpoint
CREATE TYPE "public"."cabin_class" AS ENUM('economy', 'premium_economy', 'business', 'first');--> statement-breakpoint
CREATE TYPE "public"."criterion_kind" AS ENUM('hard', 'soft');--> statement-breakpoint
CREATE TYPE "public"."entity_kind" AS ENUM('event', 'performer', 'venue', 'product', 'flight', 'hotel', 'experience', 'destination', 'review_snippet');--> statement-breakpoint
CREATE TYPE "public"."goal_category" AS ENUM('experience', 'travel', 'product', 'gift', 'deal', 'research');--> statement-breakpoint
CREATE TYPE "public"."goal_status" AS ENUM('active', 'paused', 'retired');--> statement-breakpoint
CREATE TYPE "public"."performer_type" AS ENUM('artist', 'comedian', 'band', 'other');--> statement-breakpoint
CREATE TYPE "public"."run_event_level" AS ENUM('debug', 'info', 'warn', 'error');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('running', 'succeeded', 'failed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."source_kind" AS ENUM('web', 'email', 'api', 'reddit', 'review_site', 'other');--> statement-breakpoint
CREATE TYPE "public"."tool_call_status" AS ENUM('ok', 'error');--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"category" "goal_category" NOT NULL,
	"status" "goal_status" DEFAULT 'active' NOT NULL,
	"system_prompt" text DEFAULT '' NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"budget_min_cents" integer,
	"budget_max_cents" integer,
	"currency" text DEFAULT 'USD' NOT NULL,
	"window_start" date,
	"window_end" date,
	"time_notes" text DEFAULT '' NOT NULL,
	"break_rules" text[] DEFAULT '{}'::text[] NOT NULL,
	"schedule_hint" text DEFAULT '' NOT NULL,
	"expected_cadence_hours" integer,
	"agent_clients" "agent_client"[] DEFAULT '{}'::agent_client[] NOT NULL,
	"current_revision" integer DEFAULT 1 NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goals_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "goal_criteria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"label" text NOT NULL,
	"kind" "criterion_kind" NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	"attribute" text,
	"operator" text,
	"value" jsonb,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"author_kind" "author_kind" NOT NULL,
	"author" text DEFAULT '' NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"changed_fields" text[] DEFAULT '{}'::text[] NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goal_revisions_goal_revision_uq" UNIQUE("goal_id","revision")
);
--> statement-breakpoint
CREATE TABLE "tag_mappings" (
	"tag_id" uuid NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	CONSTRAINT "tag_mappings_tag_id_subject_type_subject_id_pk" PRIMARY KEY("tag_id","subject_type","subject_id")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client" "agent_client" NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"status" "run_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"summary" text DEFAULT '' NOT NULL,
	"quality_score" real,
	"uniqueness_score" real,
	"sightings_count" integer DEFAULT 0 NOT NULL,
	"new_entities_count" integer DEFAULT 0 NOT NULL,
	"proposals_count" integer DEFAULT 0 NOT NULL,
	"session_url" text,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "mcp_tool_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid,
	"tool" text NOT NULL,
	"operation" text DEFAULT '' NOT NULL,
	"args_digest" text DEFAULT '' NOT NULL,
	"status" "tool_call_status" NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"error" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"level" "run_event_level" DEFAULT 'info' NOT NULL,
	"kind" text DEFAULT 'note' NOT NULL,
	"message" text NOT NULL,
	"data" jsonb
);
--> statement-breakpoint
CREATE TABLE "run_goals" (
	"run_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	CONSTRAINT "run_goals_run_id_goal_id_pk" PRIMARY KEY("run_id","goal_id")
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "entity_kind" NOT NULL,
	"fingerprint" text NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"attrs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"content_hash" text,
	"embedding" vector(384),
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sighting_count" integer DEFAULT 0 NOT NULL,
	"merged_into_id" uuid,
	CONSTRAINT "entities_fingerprint_unique" UNIQUE("fingerprint")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"performer_entity_id" uuid,
	"venue_entity_id" uuid,
	"starts_at" timestamp with time zone,
	"city" text DEFAULT '' NOT NULL,
	"sales_end_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "flights" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"origin" text NOT NULL,
	"destination" text NOT NULL,
	"carrier" text DEFAULT '' NOT NULL,
	"cabin" "cabin_class",
	"depart_on" date,
	"return_on" date,
	"nonstop" boolean,
	"seat_product" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hotels" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"brand" text DEFAULT '' NOT NULL,
	"property_name" text NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"country" text DEFAULT '' NOT NULL,
	"star_rating" real,
	"transit_note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performers" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"performer_type" "performer_type" DEFAULT 'artist' NOT NULL,
	"spotify_id" text,
	"genres" text[] DEFAULT '{}'::text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"brand" text DEFAULT '' NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"variant" text DEFAULT '' NOT NULL,
	"msrp_cents" integer,
	"currency" text DEFAULT 'USD' NOT NULL,
	"specs" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "source_kind" NOT NULL,
	"domain" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"reputation" real,
	CONSTRAINT "sources_kind_domain_uq" UNIQUE("kind","domain")
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"region" text DEFAULT '' NOT NULL,
	"country" text DEFAULT '' NOT NULL,
	"lat" real,
	"lng" real
);
--> statement-breakpoint
CREATE TABLE "images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid,
	"sighting_id" uuid,
	"source_url" text NOT NULL,
	"source_url_hash" text NOT NULL,
	"cf_image_id" text,
	"variants" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"alt" text DEFAULT '' NOT NULL,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "images_source_url_hash_unique" UNIQUE("source_url_hash")
);
--> statement-breakpoint
CREATE TABLE "price_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"sighting_id" uuid,
	"seller" text DEFAULT '' NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sightings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"run_id" uuid,
	"goal_id" uuid,
	"source_id" uuid,
	"url" text,
	"url_canonical" text,
	"url_hash" text,
	"email_message_id" text,
	"title" text NOT NULL,
	"excerpt" text DEFAULT '' NOT NULL,
	"price_cents" integer,
	"msrp_cents" integer,
	"currency" text,
	"on_sale" boolean,
	"availability" text,
	"points_price" integer,
	"points_program" text,
	"agent_score" real,
	"agent_rationale" text DEFAULT '' NOT NULL,
	"criteria_match" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_resighting" boolean DEFAULT false NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goal_criteria" ADD CONSTRAINT "goal_criteria_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_revisions" ADD CONSTRAINT "goal_revisions_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_mappings" ADD CONSTRAINT "tag_mappings_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_tool_calls" ADD CONSTRAINT "mcp_tool_calls_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_events" ADD CONSTRAINT "run_events_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_goals" ADD CONSTRAINT "run_goals_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_goals" ADD CONSTRAINT "run_goals_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_merged_into_id_entities_id_fk" FOREIGN KEY ("merged_into_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_performer_entity_id_entities_id_fk" FOREIGN KEY ("performer_entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_venue_entity_id_entities_id_fk" FOREIGN KEY ("venue_entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flights" ADD CONSTRAINT "flights_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotels" ADD CONSTRAINT "hotels_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performers" ADD CONSTRAINT "performers_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_sighting_id_sightings_id_fk" FOREIGN KEY ("sighting_id") REFERENCES "public"."sightings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_sighting_id_sightings_id_fk" FOREIGN KEY ("sighting_id") REFERENCES "public"."sightings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sightings" ADD CONSTRAINT "sightings_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sightings" ADD CONSTRAINT "sightings_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sightings" ADD CONSTRAINT "sightings_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sightings" ADD CONSTRAINT "sightings_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goals_status_category_idx" ON "goals" USING btree ("status","category");--> statement-breakpoint
CREATE INDEX "goals_last_run_idx" ON "goals" USING btree ("last_run_at");--> statement-breakpoint
CREATE INDEX "goal_criteria_goal_idx" ON "goal_criteria" USING btree ("goal_id","position");--> statement-breakpoint
CREATE INDEX "tag_mappings_subject_idx" ON "tag_mappings" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "agent_runs_status_started_idx" ON "agent_runs" USING btree ("status","started_at");--> statement-breakpoint
CREATE INDEX "agent_runs_started_idx" ON "agent_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "mcp_tool_calls_run_idx" ON "mcp_tool_calls" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "mcp_tool_calls_at_idx" ON "mcp_tool_calls" USING btree ("at");--> statement-breakpoint
CREATE INDEX "run_events_run_at_idx" ON "run_events" USING btree ("run_id","at");--> statement-breakpoint
CREATE INDEX "run_events_at_idx" ON "run_events" USING btree ("at");--> statement-breakpoint
CREATE INDEX "run_goals_goal_idx" ON "run_goals" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "entities_kind_last_seen_idx" ON "entities" USING btree ("kind","last_seen_at");--> statement-breakpoint
CREATE INDEX "entities_embedding_hnsw" ON "entities" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "events_starts_idx" ON "events" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "events_performer_idx" ON "events" USING btree ("performer_entity_id");--> statement-breakpoint
CREATE INDEX "flights_route_idx" ON "flights" USING btree ("origin","destination","depart_on");--> statement-breakpoint
CREATE INDEX "images_entity_idx" ON "images" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "price_obs_entity_at_idx" ON "price_observations" USING btree ("entity_id","observed_at");--> statement-breakpoint
CREATE INDEX "sightings_entity_seen_idx" ON "sightings" USING btree ("entity_id","seen_at");--> statement-breakpoint
CREATE INDEX "sightings_goal_seen_idx" ON "sightings" USING btree ("goal_id","seen_at");--> statement-breakpoint
CREATE INDEX "sightings_run_idx" ON "sightings" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "sightings_url_hash_idx" ON "sightings" USING btree ("url_hash");--> statement-breakpoint
CREATE INDEX "sightings_email_idx" ON "sightings" USING btree ("email_message_id");