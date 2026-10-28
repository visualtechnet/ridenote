-- History table and its two database roles.
--
-- Run once, as the database owner, in the Neon console SQL editor (there is no migration tool).
-- The two roles must be created by this script, not in the console: a role made in the console
-- joins neon_superuser and keeps write privileges this script cannot take away. The console is used
-- only to set their passwords afterwards (Roles), from which you build the two connection strings:
--   history_app    -> HISTORY_DATABASE_URL        (pooled; the parse route and the History page)
--   history_purge  -> HISTORY_PURGE_DATABASE_URL  (read only by the daily clean-up route)
-- No password belongs in this file or anywhere in the repository.
-- The last block checks what each role can really do and fails the script if it holds more than
-- its grants below.

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

-- Roles are created with LOGIN but no password; the console sets the password afterwards.
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

-- Self-check: has_table_privilege counts every source of privilege (role membership, PUBLIC,
-- predefined roles, default privileges), so this fails if a role can do more than it is granted.
DO $$
BEGIN
  IF has_table_privilege('history_app', 'history', 'UPDATE')
    OR has_table_privilege('history_app', 'history', 'DELETE')
    OR has_table_privilege('history_app', 'history', 'TRUNCATE')
    OR has_table_privilege('history_purge', 'history', 'INSERT')
    OR has_table_privilege('history_purge', 'history', 'UPDATE')
    OR has_table_privilege('history_purge', 'history', 'TRUNCATE')
  THEN
    RAISE EXCEPTION 'history roles have more than their grants';
  END IF;
END
$$;
