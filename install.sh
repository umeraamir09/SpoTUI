#!/usr/bin/env bash
set -euo pipefail

REPO="umroo/umroofm"
VERSION="${1:-latest}"
INSTALL_DIR="${UMROOFM_INSTALL:-/usr/local/bin}"

detect_platform() {
  local os arch
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="$(uname -m)"

  case "$os" in
    linux) os="linux" ;;
    darwin) os="darwin" ;;
    *) echo "Unsupported OS: $os"; exit 1 ;;
  esac

  case "$arch" in
    x86_64|amd64) arch="x64" ;;
    aarch64|arm64) arch="arm64" ;;
    *) echo "Unsupported arch: $arch"; exit 1 ;;
  esac

  echo "${os}-${arch}"
}

fetch() {
  local platform="$1" url
  if [ "$VERSION" = "latest" ]; then
    url="https://github.com/${REPO}/releases/latest/download/umroofm-${platform}"
  else
    url="https://github.com/${REPO}/releases/download/${VERSION}/umroofm-${platform}"
  fi

  echo "Downloading umroofm for ${platform}..."
  curl -fsSL "$url" -o umroofm
  chmod +x umroofm
}

platform="$(detect_platform)"
fetch "$platform"

echo "Installing to ${INSTALL_DIR}/umroofm..."
mv umroofm "$INSTALL_DIR/umroofm"

echo "Installed! Run 'umroofm' to start."
