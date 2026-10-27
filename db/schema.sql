-- History table and its two database roles.
--
-- Run once, as the database owner, in the Neon console SQL editor (there is no migration tool).
-- Then set each role's password by hand in the Neon console (Roles) and build the two connection
-- strings from them:
--   history_app    -> HISTORY_DATABASE_URL        (pooled; the parse route and the History page)
--   history_purge  -> HISTORY_PURGE_DATABASE_URL  (read only by the daily clean-up route)
-- No password belongs in this file or anywhere in the repository.

CREATE TABLE IF NOT EXISTS history (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at       timestamptz NOT NULL DEFAULT now(),
  passenger_name   text,
  pickup_location  text,
  dropoff_location text,
  pickup_time      text,
  mobility         text[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS history_created_at_idx ON history (created_at);

-- Roles are created without LOGIN credentials; the console adds the password.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'history_app') THEN
    CREATE ROLE history_app LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'history_purge') THEN
    CREATE ROLE history_purge LOGIN;
  END IF;
END
$$;

REVOKE ALL ON history FROM history_app, history_purge;

-- App role: add and read rows, nothing else (no UPDATE, DELETE or TRUNCATE).
-- An identity column fills id from its own sequence with the owner's rights, so INSERT needs no
-- sequence privilege.
GRANT INSERT, SELECT ON history TO history_app;

-- Clean-up role: read and delete rows, nothing else.
GRANT SELECT, DELETE ON history TO history_purge;
