-- Proves the two History roles hold only their grants, by trying forbidden things as each one.
--
-- Run as the database owner in the Neon console SQL editor, AFTER db/schema.sql and after the roles have
-- passwords. It was run by hand in pieces (each numbered section on its own), not as one script, so
-- read each result before running the next.
--
-- Neon's owner is not a superuser, so SET ROLE fails with "permission denied to set role" until the
-- owner is a member of the role. Section 1 grants that membership; section 5 removes it.
-- Every section leaves no row behind in history.

-- 1. Temporary membership, so the owner can SET ROLE to each login.
DO $$
BEGIN
  EXECUTE format('GRANT history_app TO %I', current_user);
  EXECUTE format('GRANT history_purge TO %I', current_user);
END
$$;

-- 2. history_app: may insert and select, must not delete.
SET ROLE history_app;
INSERT INTO history (passenger_name) VALUES ('verify-sql-row');
SELECT count(*) AS rows_visible_to_app FROM history WHERE passenger_name = 'verify-sql-row';
DO $$
BEGIN
  DELETE FROM history WHERE id = -1;
  RAISE EXCEPTION 'history_app was allowed to DELETE';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'ok: history_app cannot DELETE';
END
$$;
RESET ROLE;

-- 3. history_purge: may select and delete, must not insert.
SET ROLE history_purge;
SELECT count(*) AS rows_visible_to_purge FROM history WHERE passenger_name = 'verify-sql-row';
DO $$
BEGIN
  INSERT INTO history (passenger_name) VALUES ('should-not-exist');
  RAISE EXCEPTION 'history_purge was allowed to INSERT';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'ok: history_purge cannot INSERT';
END
$$;
DELETE FROM history WHERE passenger_name = 'verify-sql-row';
RESET ROLE;

-- 4. The test row is gone (expect 0).
SELECT count(*) AS leftover_rows FROM history WHERE passenger_name IN ('verify-sql-row', 'should-not-exist');

-- 5. Remove the temporary membership.
DO $$
BEGIN
  EXECUTE format('REVOKE history_app FROM %I', current_user);
  EXECUTE format('REVOKE history_purge FROM %I', current_user);
END
$$;
