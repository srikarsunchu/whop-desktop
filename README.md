# Whop Desktop

A native macOS command center for running a Whop business, built on the
[Whop CLI](https://whop.sh). Revenue, balance, members, memberships, products,
visitors and apps in one window, with a ⌘K palette that runs any `whop`
command. Every panel shows the exact command that produced it.

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS%2011%2B-151515" alt="Platform: macOS 11+" />
  <img src="https://img.shields.io/badge/built%20with-Tauri%202-24C8DB?logo=tauri&logoColor=white" alt="Built with Tauri 2" />
  <img src="https://img.shields.io/badge/UI-Frosted%20UI-fa4616" alt="Frosted UI" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License: MIT" />
</p>

> **Unofficial, personal-use project.** Not affiliated with, endorsed by, or
> distributed by Whop. It drives the public Whop CLI and, optionally, loads
> whop.com in a separate window. "Whop" and the Whop logo are trademarks of
> their owner. Started as a fork of
> [siyabendoezdemir/whop-desktop](https://github.com/siyabendoezdemir/whop-desktop) (MIT).

---

## What it does

Every screen is a `whop …` command with a face.

| View | Commands behind it |
|---|---|
| **Overview** | `stats get net_revenue --interval day` (30d + prior 30d delta), `memberships list --status active`, `members list`, `ledgers report --report_type balance_summary`, `ledgers list`, `recommended-actions list` |
| **Money** | balance summary with a stacked bar (available / pending / reserve / dispute hold), `ledgers report --report_type income_statement`, ledger activity, `payouts list`, `disputes list` |
| **Members** | `memberships list` with status filters and row actions (pause, resume, cancel, all confirmed first), `members list` |
| **Products** | `products list` with default plan price, member count, visibility; publish / unpublish / delete, open store page, list plans |
| **People** | `people list`: location, device, events, purchases, LTV, last seen |
| **Apps** | `apps list`, open the hosted domain, `apps logs`, deploy preview |
| **Terminal** | a real shell to the CLI with history (↑), ⌘L clear, and a warning tint on write commands |
| **Account** | `auth status`, `auth list` (switch profiles), `accounts get`, `team-members list`, CLI binary and version |

Plus:

- **⌘K palette.** Jump to a view, switch business, run one of the common
  commands, or type any `whop …` line and hit ↵.
- **Command strip** on every panel: copy it, run it in the Terminal, refresh,
  and see when it last ran.
- **Business switcher** fed by `whop auth status` and `whop accounts list`,
  plus a labeled demo business (Northwind Picks) so every panel can be seen
  populated.
- **whop.com window** (⌘⇧O) for the parts of Whop that have no CLI (chat,
  storefront editing), with persistent login, download handling and the
  Google passkey workaround.
- **Menu-bar icon**, **⌘⇧W** global show/hide, close-hides-the-window.

## Design

The UI is Whop's own: [Frosted UI](https://github.com/whopio/frosted-ui)
components inside `<Theme appearance="dark">`, Inter for text and Geist Mono
for commands, and only Frosted tokens for color, spacing, radius and motion.
Side by side with whop.com's dark chrome it reads as the same product: the
same greys (`#111` ground, `#191919` panels, `#eee` text), the same 12 / 14 px
Inter, the same radii.

## Requirements

- macOS 11+ (developed on macOS 26, Apple Silicon)
- **Whop CLI**, installed and signed in:

```bash
curl -fsSL https://whop.com/install.sh | sh
whop login
whop quickstart   # pick the business the CLI should use
```

The app looks for `whop` in `$WHOP_BIN`, `PATH`, `~/.local/bin`,
`/opt/homebrew/bin` and `/usr/local/bin`.

## Install (unsigned build)

There is no signed release. Build it yourself (below), then:

```bash
cp -R "src-tauri/target/release/bundle/macos/Whop Desktop.app" /Applications/
```

If you got the `.app` from somewhere other than your own build, macOS will say
it is damaged. Clear the quarantine flag, or right-click > Open:

```bash
xattr -dr com.apple.quarantine "/Applications/Whop Desktop.app"
```

## Build

Node 18+, pnpm 9+, Rust stable, Xcode Command Line Tools.

```bash
pnpm install
pnpm tauri dev                  # debug build, Web Inspector under View
pnpm tauri build --bundles app  # -> src-tauri/target/release/bundle/macos/Whop Desktop.app
```

Launch hints for screenshots and testing:

```bash
WHOP_DESKTOP_ACCOUNT=biz_demoNorthwind WHOP_DESKTOP_VIEW=overview \
  "/Applications/Whop Desktop.app/Contents/MacOS/Whop Desktop"
```

## How it works, and what it never does

- The main window is a local React app. Its only native capability is a
  handful of Tauri commands in `src-tauri/src/lib.rs` that run the `whop`
  binary (never a shell) with `--format json` and return the output.
- **No API key or token ever touches the app.** Authentication, account
  selection and pagination stay in the CLI. Switching profiles is
  `whop auth switch`.
- Every write (cancel a membership, publish a product, switch profile) shows
  the exact command and asks first. The CLI has no sandbox or dry-run.
- The optional whop.com window loads the site as a top-level external URL and
  is never granted Tauri IPC (`capabilities/main-capability.json` has no
  `remote` allowlist). The only thing injected there is `src-tauri/js/init.js`,
  an app-authored script for CSS tweaks and the Google passkey fix.
- Debug logs record command names only, never arguments or output.

## Known limitations

- **Scopes.** An OAuth login lacks some scopes: `notifications *` needs
  `user:notifications:read`, `webhooks *` needs an API-key login
  (`whop login --api-key`). The app shows the exact fix instead of failing
  silently. Recommended actions are not enabled on every business yet.
- **Ledger and stats shapes** are read defensively; if Whop changes the JSON,
  the Terminal still shows the raw output.
- **Google sign-in in the web window.** WKWebView only supports cross-device
  passkeys, so the injected script removes WebAuthn on `accounts.google.com`
  to force the password flow. If Google still offers a passkey, click "Try
  another way".
- Unsigned builds only.

## Files

| Path | Purpose |
|---|---|
| `src/` | React app: `App.tsx`, `lib/whop.ts` (CLI bridge + cache), `lib/demo.ts` (demo business), `views/`, `components/` |
| `src-tauri/src/lib.rs` | Tauri commands, windows, tray, hotkey, menu |
| `src-tauri/js/init.js` | Script injected into the whop.com window only |
| `src-tauri/capabilities/main-capability.json` | Local-frontend capability, no remote access |
| `scripts/` | Icon generation and the signed-build script |

## Clearing app data

```bash
rm -rf ~/Library/WebKit/com.srikarsunchu.whopdesktop
rm -rf ~/Library/Application\ Support/com.srikarsunchu.whopdesktop
rm -rf ~/Library/Caches/com.srikarsunchu.whopdesktop
```

## License & trademarks

MIT, see [LICENSE](./LICENSE). Original wrapper © siyabendoezdemir, this
project © srikarsunchu. "Whop" and the Whop logo are trademarks of their
respective owner; this license covers this project's own source code only.
