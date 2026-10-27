#!/usr/bin/env bash
# Runs a command with ANTHROPIC_API_KEY read from the macOS Keychain, so the key never sits in a file.
#   bash scripts/with-keychain.sh <command> [args...]
# Used by `npm run dev:key`, `npm run start:key` and `npm run eval:key`.
# The first time, if no key is saved yet, it asks for one (hidden) and saves it for next time.
set -euo pipefail

# shellcheck source=scripts/keychain-lib.sh
. "$(dirname "$0")/keychain-lib.sh"
require_mac

if ! key=$(read_key); then
  echo "First time here: RideNote needs an Anthropic API key."
  prompt_and_save
  echo "Saved. You will not be asked again."
fi

export ANTHROPIC_API_KEY="$key"
exec "$@"
