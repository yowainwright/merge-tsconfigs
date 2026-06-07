#!/usr/bin/env sh
set -eu

SCRIPT_NAME="scripts/commit-msg.sh"

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

if [ "${1:-}" = "--" ]; then
  shift
fi

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  printf 'Usage: %s <commit-message-file>\n' "$SCRIPT_NAME"
  exit 0
fi

message_file="${1:-}"

if [ -z "$message_file" ]; then
  fail "commit message file is required"
fi

if [ ! -f "$message_file" ]; then
  fail "commit message file does not exist: $message_file"
fi

subject="$(sed -n '1p' "$message_file")"

case "$subject" in
  Merge\ * | Revert\ * | fixup!\ * | squash!\ *)
    exit 0
    ;;
esac

pattern='^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([[:alnum:]_.-]+\))?!?: .{1,}$'

if ! printf '%s\n' "$subject" | grep -Eq "$pattern"; then
  cat >&2 <<'MESSAGE'
error: invalid commit message

Expected:
  <type>(<scope>): <message>

Allowed types:
  feat fix docs style refactor perf test build ci chore revert

Examples:
  feat: add config merger
  fix(cli): parse boolean options
  chore!: drop legacy dependency
MESSAGE
  exit 1
fi
