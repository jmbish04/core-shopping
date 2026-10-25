CREATE TYPE "public"."occasion_kind" AS ENUM('sale_event', 'festival', 'personal', 'on_sale_date');--> statement-breakpoint
CREATE TABLE "goal_occasions" (
	"goal_id" uuid NOT NULL,
	"occasion_id" uuid NOT NULL,
	"lead_days_override" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "occasions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"kind" "occasion_kind" NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"recurs_yearly" boolean DEFAULT false NOT NULL,
	"lead_days" integer DEFAULT 14 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"for_person_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goal_occasions" ADD CONSTRAINT "goal_occasions_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_occasions" ADD CONSTRAINT "goal_occasions_occasion_id_occasions_id_fk" FOREIGN KEY ("occasion_id") REFERENCES "public"."occasions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occasions" ADD CONSTRAINT "occasions_for_person_id_people_id_fk" FOREIGN KEY ("for_person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "goal_occasions_pk" ON "goal_occasions" USING btree ("goal_id","occasion_id");--> statement-breakpoint
CREATE INDEX "goal_occasions_occasion_idx" ON "goal_occasions" USING btree ("occasion_id");--> statement-breakpoint
CREATE INDEX "occasions_active_idx" ON "occasions" USING btree ("is_active","starts_on");--> statement-breakpoint
CREATE INDEX "occasions_kind_idx" ON "occasions" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "occasions_person_idx" ON "occasions" USING btree ("for_person_id");