#!/usr/bin/env bash
set -euo pipefail

REPO="umeraamir09/SpoTUI"
VERSION="${1:-latest}"
INSTALL_DIR="${SPOTUI_INSTALL:-/usr/local/bin}"

case "$(uname -sm)" in
  "Linux x86_64")  platform="linux-x64"    ;;
  "Linux aarch64") platform="linux-arm64"  ;;
  "Darwin x86_64") platform="darwin-x64"  ;;
  "Darwin arm64")  platform="darwin-arm64" ;;
  *)               echo "Unsupported platform: $(uname -sm)"; exit 1 ;;
esac

if [ "$VERSION" = "latest" ]; then
  url="https://github.com/${REPO}/releases/latest/download/spotui-${platform}"
else
  url="https://github.com/${REPO}/releases/download/${VERSION}/spotui-${platform}"
fi

echo "Downloading spotui for ${platform}..."
curl -fsSL "$url" -o spotui
chmod +x spotui

echo "Installing to ${INSTALL_DIR}/spotui..."
mv spotui "$INSTALL_DIR/spotui"

echo "Installed! Run 'spotui' to start."
