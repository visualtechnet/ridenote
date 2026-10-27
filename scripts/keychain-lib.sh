# Shared helpers for the macOS Keychain scripts. Sourced by with-keychain.sh and keychain.sh; not run directly.
# The Keychain entry is called "ridenote-demo-local" unless RIDENOTE_KEYCHAIN_SERVICE says otherwise.

service="${RIDENOTE_KEYCHAIN_SERVICE:-ridenote-demo-local}"

require_mac() {
  if [ "$(uname)" != "Darwin" ]; then
    echo "This uses the macOS Keychain, so it only works on a Mac." >&2
    echo "Put ANTHROPIC_API_KEY=... in a file called .env.local and run: npm run dev" >&2
    exit 1
  fi
}

# Prints the saved key, or fails if there is none.
read_key() { security find-generic-password -a "$USER" -s "$service" -w 2>/dev/null; }

# Asks for a key (hidden), checks it looks right, saves it (replacing any old one) and sets $key.
# Needs a real terminal, because it reads what you type.
prompt_and_save() {
  if [ ! -t 0 ]; then
    echo "No API key is saved yet. Run this command in the Terminal app and it will ask for one." >&2
    exit 1
  fi
  echo "Paste your Anthropic API key below (nothing is shown as you paste)."
  echo "It is saved in your Mac's Keychain, not in a file."
  printf "API key: "
  IFS= read -rs key
  echo
  key="${key//[[:space:]]/}"
  if ! [[ "$key" =~ ^sk-ant-[A-Za-z0-9_-]+$ ]]; then
    echo "That does not look like an Anthropic key (it should start with sk-ant-). Nothing was saved." >&2
    exit 1
  fi
  # `security -i` reads the command from stdin, so the key never appears in the process list.
  printf 'add-generic-password -a "%s" -s "%s" -U -w "%s"\n' "$USER" "$service" "$key" \
    | security -i >/dev/null 2>&1 || true
  if ! key=$(read_key); then
    echo "Could not save the key to the Keychain. Nothing was changed." >&2
    exit 1
  fi
}
