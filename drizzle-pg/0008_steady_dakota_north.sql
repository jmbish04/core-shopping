CREATE TABLE "config_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hash" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"table_counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "config_snapshots_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "config_snapshot_id" uuid;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "config_snapshot_id" uuid;--> statement-breakpoint
CREATE INDEX "config_snapshots_captured_idx" ON "config_snapshots" USING btree ("captured_at");--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_config_snapshot_id_config_snapshots_id_fk" FOREIGN KEY ("config_snapshot_id") REFERENCES "public"."config_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_config_snapshot_id_config_snapshots_id_fk" FOREIGN KEY ("config_snapshot_id") REFERENCES "public"."config_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_runs_config_snapshot_idx" ON "agent_runs" USING btree ("config_snapshot_id");--> statement-breakpoint
CREATE INDEX "proposals_config_snapshot_idx" ON "proposals" USING btree ("config_snapshot_id");