#!/usr/bin/env bash
# Builds the Hugo front end into frontend/public (served by wrangler as assets).
# Works locally (hugo on PATH) and on Cloudflare's Linux build runner.
set -euo pipefail
GO_VERSION=1.23.4
HUGO_VERSION=0.163.3
if ! command -v go >/dev/null 2>&1; then
  tmp=$(mktemp -d); curl -sLJo "$tmp/go.tgz" "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz"
  mkdir -p "$HOME/.local"; tar -C "$HOME/.local" -xf "$tmp/go.tgz"; export PATH="$HOME/.local/go/bin:$PATH"
fi
if ! command -v hugo >/dev/null 2>&1; then
  tmp=$(mktemp -d); curl -sLJo "$tmp/hugo.tgz" "https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_linux-amd64.tar.gz"
  mkdir -p "$HOME/.local/hugo"; tar -C "$HOME/.local/hugo" -xf "$tmp/hugo.tgz"; export PATH="$HOME/.local/hugo:$PATH"
fi
cd "$(dirname "$0")/frontend"
hugo mod get -u github.com/isolatedcommand/Publisher@latest
hugo mod tidy
hugo --gc --minify
