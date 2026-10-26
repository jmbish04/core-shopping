CREATE TYPE "public"."idea_status" AS ENUM('candidate', 'promoted', 'dropped');--> statement-breakpoint
CREATE TABLE "idea_entities" (
	"idea_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"role" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ideas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"category" "goal_category" DEFAULT 'travel' NOT NULL,
	"rationale" text DEFAULT '' NOT NULL,
	"target_month_start" integer,
	"target_month_end" integer,
	"confidence" real DEFAULT 0 NOT NULL,
	"status" "idea_status" DEFAULT 'candidate' NOT NULL,
	"source_proposal_id" uuid,
	"source_review_id" uuid,
	"revisit_after" date,
	"promoted_goal_id" uuid,
	"supersedes_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "idea_entities" ADD CONSTRAINT "idea_entities_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_entities" ADD CONSTRAINT "idea_entities_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_source_proposal_id_proposals_id_fk" FOREIGN KEY ("source_proposal_id") REFERENCES "public"."proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_source_review_id_reviews_id_fk" FOREIGN KEY ("source_review_id") REFERENCES "public"."reviews"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_promoted_goal_id_goals_id_fk" FOREIGN KEY ("promoted_goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_supersedes_id_ideas_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."ideas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idea_entities_pk" ON "idea_entities" USING btree ("idea_id","entity_id");--> statement-breakpoint
CREATE INDEX "idea_entities_entity_idx" ON "idea_entities" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "ideas_status_category_idx" ON "ideas" USING btree ("status","category","confidence");--> statement-breakpoint
CREATE INDEX "ideas_revisit_idx" ON "ideas" USING btree ("revisit_after");--> statement-breakpoint
CREATE INDEX "ideas_source_proposal_idx" ON "ideas" USING btree ("source_proposal_id");--> statement-breakpoint
CREATE INDEX "ideas_season_idx" ON "ideas" USING btree ("target_month_start","target_month_end");