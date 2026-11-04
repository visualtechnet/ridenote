-- Adds the pickup date to the history table. Run ONCE, as the database owner, in the Neon console
-- SQL editor, BEFORE deploying the code that writes it (the app role cannot alter tables).
-- Safe to run twice. Existing rows keep a null date. No grants change: history_app and history_purge
-- already hold table-level privileges, which cover new columns.

ALTER TABLE history
  ADD COLUMN IF NOT EXISTS pickup_date date;
