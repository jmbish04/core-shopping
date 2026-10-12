CREATE TABLE "health_probes" (
	"id" text PRIMARY KEY NOT NULL,
	"nonce" text NOT NULL,
	"written_at" timestamp with time zone DEFAULT now() NOT NULL
);
