# Whop Desktop

An unofficial, open-source **macOS** desktop app for [whop.com](https://whop.com),
built with [Tauri 2](https://tauri.app). It loads whop.com in a native window and
adds the things a real Mac app should have: a hidden title bar, a menu-bar icon,
a global hotkey, and user CSS tweaks.

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS%2011%2B-151515" alt="Platform: macOS 11+" />
  <img src="https://img.shields.io/badge/built%20with-Tauri%202-24C8DB?logo=tauri&logoColor=white" alt="Built with Tauri 2" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License: MIT" />
</p>

> **Unofficial, personal-use project.** Not affiliated with, endorsed by, or
> distributed by Whop. It simply loads the public website `https://whop.com` in
> a native macOS window; it does not bundle or modify any Whop code. The icon is
> Whop's brandmark (a trademark of Whop, see [License & trademarks](#license--trademarks));
> swap it via `scripts/generate-icons.sh`.
>
> Fork of [siyabendoezdemir/whop-desktop](https://github.com/siyabendoezdemir/whop-desktop) (MIT).

---

## What's different in this fork

- **Hidden title bar.** The traffic lights float over the page and the window
  reads as a real app, not a browser. The top strip is a native drag region
  (double-click zooms), handled in AppKit, so the web page never gets any native
  access.
- **Menu-bar icon.** A monochrome Whop mark in the menu bar. Left click shows
  or hides the window, right click gives Show/Hide and Quit.
- **Global hotkey.** `⌘⇧W` toggles the window from anywhere in macOS.
- **Tweaks in the View menu.** Compact Density, Hide Promos & Banners, Dark
  Scrollbars. Checkmarks persist across launches.
- **Custom CSS.** View > Edit Custom CSS… opens
  `~/Library/Application Support/com.srikarsunchu.whopdesktop/custom.css` in
  your editor; View > Reload Custom CSS (`⌘⌥R`) applies it live, no page reload.
- Everything the original had: persistent login, OAuth/checkout popups that
  stay in-app, downloads to `~/Downloads` with a notification and Reveal in
  Finder, camera/mic through the normal macOS prompts, native Back/Forward/
  Reload/Zoom menu, close-hides-the-window.

---

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

---

## Requirements

- macOS 11+ (developed on macOS 26, Apple Silicon)
- [Node.js](https://nodejs.org) 18+ and [pnpm](https://pnpm.io) 9+
- [Rust](https://rustup.rs) (stable) + Cargo
- Xcode Command Line Tools: `xcode-select --install`

## Develop

```bash
pnpm install
pnpm tauri dev      # debug build with Web Inspector (View > Open Web Inspector)
```

## Build

```bash
pnpm tauri build
# -> src-tauri/target/release/bundle/macos/Whop Desktop.app
# -> src-tauri/target/release/bundle/dmg/Whop Desktop_0.2.0_aarch64.dmg
```

`scripts/build-signed.sh` still works if you have a Developer ID certificate;
copy `.env.signing.example` to `.env.signing` and fill it in.

## Icons

```bash
./scripts/generate-icons.sh /path/to/icon-1024.png   # app icon set
python3 scripts/make-tray-icon.py                    # menu-bar template icon
```

---

## How it works

- The window is created in Rust (`src-tauri/src/lib.rs`) and points at
  `https://whop.com` as a top-level external URL in WKWebView, not an iframe.
  The site owns its cookies, localStorage, popups and downloads like a normal
  browser, with a fixed persistent data store so logins survive relaunch.
- The remote page is **never** granted Tauri IPC. `capabilities/main-capability.json`
  has no `remote` allowlist, so whop.com cannot call any native command or
  plugin. Downloads, notifications, the tray, the hotkey and the menu are all
  driven from Rust.
- The one thing pushed into the page is `src-tauri/js/init.js`, a script
  written by this app. It adds stylesheets (title-bar padding, the tweaks,
  your `custom.css`) and a small `window.__whopDesktop` object that Rust calls
  through `eval`. It exposes nothing native.
- Window dragging under the hidden title bar is done with an AppKit event
  monitor (`performWindowDragWithEvent`), because Tauri's own drag region
  needs IPC that the page deliberately doesn't have.
- Downloads are saved to `~/Downloads` with a sanitised, de-duplicated
  filename. Debug logs never contain full URLs, only scheme and host.

## Files

| Path | Purpose |
|---|---|
| `src-tauri/src/lib.rs` | All app logic |
| `src-tauri/js/init.js` | Injected page script (tweaks, custom CSS) |
| `src-tauri/tauri.conf.json` | App name, bundle id, bundling |
| `src-tauri/capabilities/main-capability.json` | Minimal capability, no remote access |
| `scripts/` | Icon generation and signed-build script |

## Known limitations

- **Google sign-in and passkeys.** WKWebView only supports the cross-device
  (Bluetooth) passkey flow, so Google's "use your passkey" step fails with
  "Something went wrong". The injected script hides WebAuthn from
  `accounts.google.com` so Google falls back to a password prompt. If you still
  hit it, click "Try another way" in the Google popup.
- **Web Push from Whop** depends on WKWebView and Whop's service worker; the
  app neither guarantees nor fakes it. Download notifications are native and
  unaffected.
- **Force Reload** is a normal reload; WKWebView has no cache-bypass reload.

## Clearing session data

Quit the app, then:

```bash
rm -rf ~/Library/WebKit/com.srikarsunchu.whopdesktop
rm -rf ~/Library/Application\ Support/com.srikarsunchu.whopdesktop
rm -rf ~/Library/Caches/com.srikarsunchu.whopdesktop
```

## License & trademarks

MIT, see [LICENSE](./LICENSE). Original work © siyabendoezdemir, fork
© srikarsunchu. "Whop" and the Whop logo are trademarks of their respective
owner; this project's license covers its own source code only.
