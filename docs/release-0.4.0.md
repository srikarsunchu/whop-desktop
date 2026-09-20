# 0.4.0 preview

First signed build. Apple Silicon, macOS 11+.

- Release: https://github.com/srikarsunchu/whop-desktop/releases/tag/v0.4.0-preview.1
- Asset: `Whop-Desktop-0.4.0-Apple-Silicon.dmg`, plus a SHA-256 checksum file.
- Built from commit `819d1e4e`.
- Site: https://srikar-desktop.whop.site/ (source in `website/`).

## How it was signed

The Developer ID Application certificate was issued from the Apple Developer portal for team 7JMHN6T2PQ. Xcode refused to create one, the portal did not.

The app is signed with the hardened runtime and the entitlements checked into the repo. Notarization went through `xcodebuild -exportArchive` with the developer-id method and upload destination, using the Xcode account already on the machine, then `-exportNotarizedApp` to pull the stapled app back out.

The ticket is stapled to the app, not the DMG. The DMG itself is signed. Gatekeeper reports the app as Notarized Developer ID.

Checked on a read-only mount: strict codesign verify, stapler validate, spctl assess, and DMG integrity. All passed.

The signing key and the release working directory are outside this repo. Do not commit signing material.
