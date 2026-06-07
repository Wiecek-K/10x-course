#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '(.tool_input.file_path // .tool_input.path) // empty')

case "$FILE_PATH" in
  *.ts|*.tsx|*.astro) ;;
  *) exit 0 ;;
esac

[ -f "$FILE_PATH" ] || exit 0

# Ensure Astro types exist (required for projectService type-checked ESLint rules)
if [ ! -f "${CLAUDE_PROJECT_DIR}/.astro/types.d.ts" ]; then
  bunx astro sync --silent 2>/dev/null || true
fi

RESULT=$(cd "${CLAUDE_PROJECT_DIR}" && bunx eslint "$FILE_PATH" 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo "$RESULT" >&2
  exit 2
fi

exit 0
