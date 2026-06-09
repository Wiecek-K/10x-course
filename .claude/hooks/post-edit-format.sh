#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '(.tool_input.file_path // .tool_input.path) // empty')

case "$FILE_PATH" in
  *.ts|*.tsx|*.astro|*.json|*.css) ;;
  *) exit 0 ;;
esac

[ -f "$FILE_PATH" ] || exit 0

# Auto-format the edited file. Respects .prettierignore (generated files like
# worker-configuration.d.ts are skipped). Non-blocking — formatting never fails the edit.
(cd "${CLAUDE_PROJECT_DIR}" && bunx prettier --write --ignore-unknown "$FILE_PATH" >/dev/null 2>&1) || true

exit 0
