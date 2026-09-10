# 0.4.0 preview release

- Website: https://srikar-desktop.whop.site/
- Website source: website/ (TanStack Start, Whop hosting).
- Release: https://github.com/srikarsunchu/whop-desktop/releases/tag/v0.4.0-preview.1
- Binary source commit: 819d1e4e2852a4be611407e9f8e29c1ee98ad468.
- Asset: Whop-Desktop-0.4.0-Apple-Silicon.dmg, with SHA-256 checksum asset.
- Apple Silicon, macOS 11+, version 0.4.0.
- Developer ID Application certificate issued through the Apple Developer portal for team 7JMHN6T2PQ. Xcode certificate creation was disabled, but portal creation worked.
- App signed with hardened runtime and repository entitlements.
- Notarization submitted using xcodebuild -exportArchive, method developer-id, destination upload, and the existing Xcode account. Exported with -exportNotarizedApp.
- The app has a valid stapled notarization ticket. Gatekeeper accepts the packaged app as Notarized Developer ID.
- DMG wrapper is signed; notarization ticket is attached to the app inside it, not separately to the DMG.
- Read-only mount verification passed: strict code signature, staple validation, Gatekeeper assessment, and DMG integrity.
- Signing private key and local release workspace are outside the repository. Never commit signing credentials.
