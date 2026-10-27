#!/usr/bin/env bash
# Manages the Anthropic API key saved in the macOS Keychain. The key is never printed.
#   npm run key:status   is a key saved?
#   npm run key:set      save a new key, replacing the old one (for example after it expires)
#   npm run key:remove   delete the saved key
set -euo pipefail

# shellcheck source=scripts/keychain-lib.sh
. "$(dirname "$0")/keychain-lib.sh"

usage() {
  cat <<TEXT
Manage the Anthropic API key saved in your Mac's Keychain (entry: $service).

  npm run key:status   Is a key saved?
  npm run key:set      Save a new key, replacing the old one
  npm run key:remove   Delete the saved key

Start the app with the saved key:  npm run dev:key
(The first run of dev:key asks for a key if none is saved yet.)
TEXT
}

case "${1:-help}" in
  status)
    require_mac
    if read_key >/dev/null; then
      echo "A key is saved in the Keychain (entry: $service)."
    else
      echo "No key is saved yet (entry: $service). Run: npm run key:set"
      exit 1
    fi
    ;;
  set)
    require_mac
    prompt_and_save
    echo "Saved. Start the app with: npm run dev:key"
    ;;
  remove)
    require_mac
    if security delete-generic-password -a "$USER" -s "$service" >/dev/null 2>&1; then
      echo "Removed the saved key (entry: $service)."
    else
      echo "No key was saved (entry: $service), so nothing was removed."
    fi
    ;;
  help | -h | --help)
    usage
    ;;
  *)
    echo "Unknown command: $1" >&2
    usage >&2
    exit 1
    ;;
esac
