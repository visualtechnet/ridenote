#!/bin/sh
# Claude Code PostToolUse hook: format and lint-fix the file that was just written.
# Prettier problems are fixed silently; ESLint errors that can't be auto-fixed are
# reported back (exit 2) so they get fixed immediately instead of piling up.
f=$(jq -r '.tool_response.filePath // .tool_input.file_path // empty')
[ -n "$f" ] && [ -f "$f" ] || exit 0

case "$f" in
  */node_modules/*|*/.next/*|*/.claude/*|*/.agents/*) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

case "$f" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.mts|*.json|*.css|*.md) npx --no-install prettier --write "$f" >/dev/null 2>&1 ;;
esac

case "$f" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.mts)
    out=$(npx --no-install eslint --fix "$f" 2>&1) || { echo "$out" >&2; exit 2; }
    ;;
esac
exit 0
