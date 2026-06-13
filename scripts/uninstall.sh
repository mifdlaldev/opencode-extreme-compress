#!/usr/bin/env bash
set -euo pipefail

PLUGIN_NAME="extreme-compress"
PLUGIN_DIR="${HOME}/.config/opencode/plugins/${PLUGIN_NAME}"

if [ -d "${PLUGIN_DIR}" ]; then
  rm -rf "${PLUGIN_DIR}"
  echo "Removed ${PLUGIN_DIR}"
fi

echo ""
echo "Also remove the plugin reference from ~/.config/opencode/opencode.json"
echo "and restart opencode."
