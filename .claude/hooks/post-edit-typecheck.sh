#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '(.tool_input.file_path // .tool_input.path) // empty')

case "$FILE_PATH" in
  *.ts|*.tsx|*.astro) ;;
  *) exit 0 ;;
esac

[ -f "$FILE_PATH" ] || exit 0

cd "${CLAUDE_PROJECT_DIR}" || exit 0

SYNC_RESULT=$(bunx astro sync 2>&1)
if [ $? -ne 0 ]; then
  echo "astro sync failed: $SYNC_RESULT" >&2
  exit 2
fi

RESULT=$(bunx tsc --noEmit 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo "$RESULT" >&2
  exit 2
fi

exit 0
