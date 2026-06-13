#!/usr/bin/env bash
set -euo pipefail

PLUGIN_NAME="extreme-compress"
PLUGIN_DIR="${HOME}/.config/opencode/plugins/${PLUGIN_NAME}"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Installing ${PLUGIN_NAME} from ${SOURCE_DIR} to ${PLUGIN_DIR}..."

mkdir -p "${PLUGIN_DIR}/dist"

cp "${SOURCE_DIR}/dist/index.js" "${PLUGIN_DIR}/dist/"
cp "${SOURCE_DIR}/package.json" "${PLUGIN_DIR}/"

if [ ! -f "${HOME}/.config/opencode/compress.jsonc" ]; then
  cp "${SOURCE_DIR}/compress.default.jsonc" "${HOME}/.config/opencode/compress.jsonc"
  echo "Default config copied to ~/.config/opencode/compress.jsonc"
fi

echo ""
echo "Next steps:"
echo "  1. Edit ~/.config/opencode/opencode.json to add: \"./plugins/extreme-compress\""
echo "  2. Restart opencode"
echo ""
echo "Done."
