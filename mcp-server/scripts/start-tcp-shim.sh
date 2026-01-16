#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_BIN="${NODE_BIN:-$(command -v node)}"
PORT="${1:-7001}"

cd "$REPO_ROOT"
echo "Starting TCP shim for MCP server on port $PORT"
exec socat "TCP-LISTEN:${PORT},reuseaddr,fork" "EXEC:\"/bin/bash -lc 'cd \"$REPO_ROOT\" && \"$NODE_BIN\" dist/index.js'\"",pty,stderr
