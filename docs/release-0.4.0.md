# 0.4.0 preview release preparation

- Landing page: https://whop-desktop.sunchusrikar.chatgpt.site
- Public page source: sibling checkout `../whop-desktop-site`.
- Intended GitHub tag: `v0.4.0-preview.1`.
- Intended asset name: `Whop-Desktop-0.4.0-Apple-Silicon.dmg`.
- App version: 0.4.0; Apple Silicon, minimum macOS 11.
- Native build and media/workflow checks pass. First-launch welcome was inspected in the native app.
- No GitHub release or DMG has been published. No Developer ID identity is installed locally. Xcode has been initialized and its Apple Accounts settings opened; the paid member must sign in there before certificate setup can continue.

## Remaining release steps

1. Add the paid Apple Developer account to Xcode, create/install a Developer ID Application identity, and configure notarization using Xcode or a keychain-backed notarytool profile. Do not commit credentials.
2. Sign the app with hardened runtime and the repository's entitlements, notarize it and staple the ticket. Verify signature and Gatekeeper assessment.
3. Package the signed app into a DMG with an Applications shortcut; notarize/staple and verify the DMG. Record SHA-256.
4. Publish a GitHub preview release from the matching source commit with the DMG and checksum. Verify an anonymous download succeeds.
5. Set `releaseReady` to true in the landing page, replace pending signing text with verified release wording, rebuild and deploy the same Sites project.

The site currently leads with the demo and reports that the Mac download is coming soon. It does not expose a broken download button.
