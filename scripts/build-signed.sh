#!/usr/bin/env bash
#
# Build a SIGNED + NOTARIZED universal (Intel + Apple Silicon) release of Whop Desktop.
#
# This produces a .dmg that opens cleanly on any Mac with no Gatekeeper warning
# and no Terminal workaround — because it's signed with your Developer ID and
# notarized + stapled by Apple.
#
# Setup once:
#   1. cp .env.signing.example .env.signing   (then fill it in — it's gitignored)
#   2. Install your "Developer ID Application" certificate in Keychain.
#   3. Add notarization credentials to .env.signing (API key or Apple ID).
#
# Then just run:  ./scripts/build-signed.sh
set -euo pipefail
cd "$(dirname "$0")/.."

# Load signing/notarization env. This file is gitignored and must never be
# committed — it contains your Apple credentials.
if [ -f .env.signing ]; then
  set -a
  . ./.env.signing
  set +a
else
  echo "error: .env.signing not found. Run: cp .env.signing.example .env.signing" >&2
  exit 1
fi

if [ -z "${APPLE_SIGNING_IDENTITY:-}" ]; then
  echo "error: APPLE_SIGNING_IDENTITY is not set (see .env.signing.example)" >&2
  exit 1
fi

if [ -z "${APPLE_API_KEY_PATH:-}" ] && [ -z "${APPLE_ID:-}" ]; then
  echo "error: no notarization credentials set. Provide either the App Store" >&2
  echo "       Connect API key vars or the Apple ID vars (see .env.signing.example)." >&2
  exit 1
fi

echo "==> Signing identity: $APPLE_SIGNING_IDENTITY"
echo "==> Ensuring Rust targets for a universal binary..."
rustup target add aarch64-apple-darwin x86_64-apple-darwin >/dev/null

echo "==> Building (sign + notarize + staple). Notarization can take a few minutes..."
pnpm tauri build --target universal-apple-darwin

TARGET_ROOT="${CARGO_TARGET_DIR:-src-tauri/target}"
BUNDLE_DIR="$TARGET_ROOT/universal-apple-darwin/release/bundle"
APP="$BUNDLE_DIR/macos/Whop Desktop.app"
DMG="$(ls -t "$BUNDLE_DIR"/dmg/*.dmg 2>/dev/null | head -1 || true)"

if [ -z "$DMG" ]; then
  echo "error: no .dmg produced under $BUNDLE_DIR/dmg/" >&2
  exit 1
fi

# Tauri notarizes + staples the .app, but NOT the .dmg wrapper itself. Without
# this the disk image is "Unnotarized Developer ID" and Gatekeeper warns when
# mounting it. So notarize + staple the dmg too for a fully clean download.
echo "==> Notarizing the dmg itself (waits for Apple)..."
if [ -n "${APPLE_API_KEY_PATH:-}" ]; then
  xcrun notarytool submit "$DMG" \
    --key "$APPLE_API_KEY_PATH" --key-id "$APPLE_API_KEY" --issuer "$APPLE_API_ISSUER" --wait
else
  xcrun notarytool submit "$DMG" \
    --apple-id "$APPLE_ID" --password "$APPLE_PASSWORD" --team-id "$APPLE_TEAM_ID" --wait
fi
xcrun stapler staple "$DMG"

echo "==> Verifying signature and notarization staple..."
codesign --verify --deep --strict --verbose=2 "$APP" || true
spctl -a -vvv -t open --context context:primary-signature "$DMG" || true
xcrun stapler validate "$DMG" || echo "(could not validate staple — review notarization output above)"

echo
echo "Done."
echo "  Signed app: $APP"
echo "  Signed dmg: $DMG"
