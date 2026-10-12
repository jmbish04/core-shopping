-- core_shopping database bootstrap (run once as the postgres superuser on LXC 109).
-- Applied 2026-10-07. Passwords are NOT here: they live in the tokens CLI as
-- CORE_SHOPPING_PG_OWNER_PASSWORD and CORE_SHOPPING_PG_APP_PASSWORD (local only;
-- Hyperdrive core-shopping-postgres-hyperdrive holds the app one).
--
--   psql "host=192.168.1.50 user=postgres sslmode=require" -v owner_pw=... -v app_pw=... -f scripts/pg-bootstrap.sql

CREATE ROLE core_shopping_owner LOGIN PASSWORD :'owner_pw';   -- DDL + migrations
CREATE ROLE core_shopping_app   LOGIN PASSWORD :'app_pw';     -- the Worker (via Hyperdrive): DML only
CREATE DATABASE core_shopping OWNER core_shopping_owner;
REVOKE ALL ON DATABASE core_shopping FROM PUBLIC;
GRANT CONNECT ON DATABASE core_shopping TO core_shopping_app;

\connect core_shopping
CREATE EXTENSION IF NOT EXISTS vector;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO core_shopping_owner;
GRANT USAGE ON SCHEMA public TO core_shopping_app;
ALTER DEFAULT PRIVILEGES FOR ROLE core_shopping_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO core_shopping_app;
ALTER DEFAULT PRIVILEGES FOR ROLE core_shopping_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO core_shopping_app;

-- After the first `pnpm run migrate:pg` creates the drizzle ledger schema
-- (run as core_shopping_owner): /api/health reads it to detect an unmigrated DB.
-- GRANT USAGE ON SCHEMA drizzle TO core_shopping_app;
-- GRANT SELECT ON ALL TABLES IN SCHEMA drizzle TO core_shopping_app;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA drizzle GRANT SELECT ON TABLES TO core_shopping_app;
