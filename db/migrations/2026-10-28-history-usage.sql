-- Adds per-call usage to the history table. Run ONCE, as the database owner, in the Neon console
-- SQL editor, BEFORE deploying the code that writes these columns (the app role cannot alter tables).
-- Safe to run twice. Existing rows keep null usage. No grants change: history_app and history_purge
-- already hold table-level privileges, which cover new columns.

ALTER TABLE history
  ADD COLUMN IF NOT EXISTS input_tokens integer,
  ADD COLUMN IF NOT EXISTS output_tokens integer,
  ADD COLUMN IF NOT EXISTS latency_ms integer;
