-- Agent Approve: each saved agent trip records where it came from and its draft id.
--
-- Run once, as the database owner, in the Neon console SQL editor, before deploying the agent.
-- Existing rows get source 'parse' and no draft id. The unique index lets a replayed Approve
-- insert nothing: NULLs are not equal, so parse rows (no draft id) never clash with each other.
-- history_app keeps its grants (INSERT, SELECT); no new privilege is needed.

ALTER TABLE history ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'parse';
ALTER TABLE history DROP CONSTRAINT IF EXISTS history_source_check;
ALTER TABLE history ADD CONSTRAINT history_source_check CHECK (source IN ('parse', 'agent'));
ALTER TABLE history ADD COLUMN IF NOT EXISTS draft_id text;
CREATE UNIQUE INDEX IF NOT EXISTS history_draft_id_idx ON history (draft_id);
