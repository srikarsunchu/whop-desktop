//! Whop Desktop — an unofficial, personal-use macOS desktop wrapper around
//! whop.com. Fork of siyabendoezdemir/whop-desktop with a hidden title bar,
//! a menu-bar tray icon + global hotkey, and user CSS tweaks.
//!
//! Architecture overview (see README.md for the long version):
//!
//! * The main window is created programmatically in Rust and points at
//!   `https://whop.com` as a TOP-LEVEL external URL via
//!   `WebviewUrl::External` — NOT an iframe. This lets WKWebView own cookies,
//!   localStorage, OAuth popups, and downloads exactly like a normal browser.
//! * The remote page is NEVER granted Tauri IPC access (see
//!   `capabilities/main-capability.json`). All native behaviour (downloads,
//!   notifications, menu actions, tray, hotkey, window dragging) is driven from
//!   this Rust code and is invisible to the web page.
//! * The only thing pushed INTO the page is `js/init.js`, an app-authored
//!   script that adds stylesheets (title-bar padding, tweaks, custom.css) and
//!   a tiny `window.__whopDesktop` object that Rust drives via `eval`.
//! * Navigation, popups (`window.open` / `target="_blank"`), downloads, and
//!   non-web schemes are handled by the builder callbacks below.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::menu::{
    AboutMetadataBuilder, CheckMenuItem, CheckMenuItemBuilder, Menu, MenuBuilder, MenuEvent,
    MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder,
};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::utils::config::BackgroundThrottlingPolicy;
use tauri::webview::{DownloadEvent, NewWindowResponse, WebviewWindowBuilder};
use tauri::{
    AppHandle, Manager, RunEvent, TitleBarStyle, Url, WebviewUrl, WebviewWindow, WindowEvent, Wry,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use tauri_plugin_notification::NotificationExt;

/// User-visible application name.
const APP_NAME: &str = "Whop Desktop";
/// The single site this wrapper exists to host.
const WHOP_URL: &str = "https://whop.com";
/// Stable window label used everywhere we look the window up.
const MAIN_LABEL: &str = "main";
/// Tray icon id.
const TRAY_ID: &str = "main-tray";
/// Global (system-wide) shortcut that shows/hides the window.
const TOGGLE_SHORTCUT: &str = "cmd+shift+w";
/// Prefs + custom CSS live in `~/Library/Application Support/<identifier>/`.
const PREFS_FILE: &str = "prefs.json";
const CUSTOM_CSS_FILE: &str = "custom.css";
/// Height (pt) of the strip under the hidden title bar. The injected CSS pads
/// whop.com's layout by this much and the native drag monitor treats clicks in
/// it as window drags.
const TITLEBAR_HEIGHT: f64 = 28.0;
/// Width (pt) reserved for the traffic lights; clicks there are left to AppKit.
const TRAFFIC_LIGHTS_WIDTH: f64 = 80.0;

/// A fixed 16-byte WKWebView data-store identifier. Using a constant value
/// guarantees the SAME persistent cookie / localStorage / session store is
/// reused on every launch, so logins survive quitting and reopening the app.
/// Distinct from the upstream project's id so this fork has its own store.
const DATA_STORE_ID: [u8; 16] = [
    0x77, 0x68, 0x6f, 0x70, 0x64, 0x65, 0x73, 0x6b, // "whopdesk"
    0x73, 0x72, 0x69, 0x6b, 0x61, 0x72, 0x00, 0x02, // "srikar" + version
];

/// Named page tweaks: (id, View-menu label). Ids must match TWEAK_DEFS in
/// `js/init.js`.
const TWEAKS: &[(&str, &str)] = &[
    ("compact", "Compact Density"),
    ("hide_promos", "Hide Promos & Banners"),
    ("dark_scrollbars", "Dark Scrollbars"),
];

/// Injected page script template; placeholders are filled in `build_init_script`.
const INIT_JS_TEMPLATE: &str = include_str!("../js/init.js");

/// Persisted user preferences.
#[derive(Serialize, Deserialize, Default, Clone)]
#[serde(default)]
struct Prefs {
    /// tweak id -> enabled
    tweaks: BTreeMap<String, bool>,
}

/// Process-wide state. Kept tiny on purpose.
struct AppState {
    /// Current zoom factor applied to the main webview (menu-driven zoom).
    zoom: Mutex<f64>,
    /// Path of the most recently completed download, for "Reveal in Finder".
    last_download: Mutex<Option<PathBuf>>,
    /// In-memory copy of prefs.json.
    prefs: Mutex<Prefs>,
    /// View-menu check items by tweak id, so handlers can read/set them.
    tweak_items: Mutex<BTreeMap<String, CheckMenuItem<Wry>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            zoom: Mutex::new(1.0),
            last_download: Mutex::new(None),
            prefs: Mutex::new(Prefs::default()),
            tweak_items: Mutex::new(BTreeMap::new()),
        }
    }
}

/// Debug-only developer log. Compiles to nothing in release builds.
///
/// SECURITY: callers must only pass non-sensitive data. We deliberately log
/// scheme + host only, never full URLs (which can contain signed tokens),
/// cookies, form contents, or personal data.
fn dlog(msg: &str) {
    #[cfg(debug_assertions)]
    eprintln!("[whopdesktop] {msg}");
    #[cfg(not(debug_assertions))]
    let _ = msg;
}

/// Returns `scheme://host` for logging, dropping path/query so we never leak
/// secrets embedded in URLs.
fn host_only(url: &Url) -> String {
    match url.host_str() {
        Some(h) => format!("{}://{}", url.scheme(), h),
        None => format!("{}://", url.scheme()),
    }
}

/// Opens a non-web URL (mailto:/tel:/etc.) with the system default handler.
///
/// SECURITY: only ever called for an allowlist of safe schemes (see callers).
/// We do NOT expose Tauri's opener plugin to the web page; this runs in native
/// Rust only.
fn open_with_system(url: &Url) {
    let _ = std::process::Command::new("open").arg(url.as_str()).spawn();
}

/// Reveals a file in Finder (native, not exposed to the web page).
fn reveal_in_finder(path: &Path) {
    let _ = std::process::Command::new("open")
        .arg("-R")
        .arg(path)
        .spawn();
}

// ---------------------------------------------------------------------------
// Prefs, custom CSS, and the injected script
// ---------------------------------------------------------------------------

/// `~/Library/Application Support/<identifier>`. Computed by hand (not via
/// `app.path()`) because it is needed while the menu is built, before Tauri's
/// path resolver is available.
fn config_dir(app: &AppHandle) -> Option<PathBuf> {
    let home = std::env::var_os("HOME")?;
    Some(
        PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join(&app.config().identifier),
    )
}

fn prefs_path(app: &AppHandle) -> Option<PathBuf> {
    config_dir(app).map(|d| d.join(PREFS_FILE))
}

fn custom_css_path(app: &AppHandle) -> Option<PathBuf> {
    config_dir(app).map(|d| d.join(CUSTOM_CSS_FILE))
}

fn load_prefs(app: &AppHandle) -> Prefs {
    prefs_path(app)
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_prefs(app: &AppHandle, prefs: &Prefs) {
    if let Some(p) = prefs_path(app) {
        if let Some(dir) = p.parent() {
            let _ = fs::create_dir_all(dir);
        }
        if let Ok(json) = serde_json::to_string_pretty(prefs) {
            let _ = fs::write(p, json);
        }
    }
}

/// Reads the user's custom.css (empty string if missing).
fn read_custom_css(app: &AppHandle) -> String {
    custom_css_path(app)
        .and_then(|p| fs::read_to_string(p).ok())
        .unwrap_or_default()
}

/// Creates custom.css with a header comment if missing, then opens it in the
/// default text editor.
fn edit_custom_css(app: &AppHandle) {
    if let Some(p) = custom_css_path(app) {
        if let Some(dir) = p.parent() {
            let _ = fs::create_dir_all(dir);
        }
        if !p.exists() {
            let _ = fs::write(
                &p,
                "/* Whop Desktop custom CSS.\n   Applied at launch and via View > Reload Custom CSS. */\n\n",
            );
        }
        let _ = std::process::Command::new("open").arg("-t").arg(&p).spawn();
    }
}

/// Serialises a value as a JS literal (serde_json output is valid JS).
fn js_literal<T: Serialize>(v: &T, fallback: &str) -> String {
    serde_json::to_string(v).unwrap_or_else(|_| fallback.to_string())
}

/// Fills the init.js template with the current prefs and custom CSS.
fn build_init_script(app: &AppHandle) -> String {
    let prefs = load_prefs(app);
    INIT_JS_TEMPLATE
        .replace("__WD_TITLEBAR_HEIGHT__", &TITLEBAR_HEIGHT.to_string())
        .replace("__WD_CUSTOM_CSS__", &js_literal(&read_custom_css(app), "\"\""))
        .replace("__WD_INITIAL_TWEAKS__", &js_literal(&prefs.tweaks, "{}"))
}

/// Enables/disables a named tweak: persists it, syncs the menu check mark, and
/// pushes the change into the live page.
fn set_tweak(app: &AppHandle, id: &str, enabled: bool) {
    if let Some(state) = app.try_state::<AppState>() {
        if let Ok(mut p) = state.prefs.lock() {
            p.tweaks.insert(id.to_string(), enabled);
            save_prefs(app, &p);
        }
        if let Ok(items) = state.tweak_items.lock() {
            if let Some(item) = items.get(id) {
                let _ = item.set_checked(enabled);
            }
        }
    }
    let js = format!(
        "window.__whopDesktop && window.__whopDesktop.set({}, {})",
        js_literal(&id, "\"\""),
        enabled
    );
    with_main(app, |w| {
        let _ = w.eval(&js);
    });
}

/// Re-reads custom.css and applies it to the live page without a reload.
fn reload_custom_css(app: &AppHandle) {
    let css = js_literal(&read_custom_css(app), "\"\"");
    with_main(app, |w| {
        let _ = w.eval(&format!(
            "window.__whopDesktop && window.__whopDesktop.setCustomCss({css})"
        ));
    });
}

// ---------------------------------------------------------------------------
// Navigation, popups, and scheme handling
// ---------------------------------------------------------------------------

/// Decides whether a top-level navigation inside the main webview may proceed.
/// Returning `false` cancels the navigation.
fn allow_navigation(url: &Url) -> bool {
    match url.scheme() {
        // Normal web traffic stays inside the app: whop.com, its subdomains,
        // and any auth/checkout/payment/media redirect chain it triggers.
        "https" | "http" | "about" | "blob" | "data" => {
            dlog(&format!("nav allow {}", host_only(url)));
            true
        }
        // Hand these off to the OS default handler, then cancel the in-webview
        // navigation so we don't end up on an error page.
        "mailto" | "tel" | "sms" | "facetime" | "facetime-audio" => {
            dlog(&format!("nav external scheme {}", url.scheme()));
            open_with_system(url);
            false
        }
        // Block everything else (file://, custom app schemes, etc.).
        other => {
            dlog(&format!("nav BLOCKED scheme {other}"));
            false
        }
    }
}

/// Decides how to handle a `window.open` / `target="_blank"` request.
fn handle_new_window(url: &Url) -> NewWindowResponse<Wry> {
    match url.scheme() {
        // Allow the popup with WKWebView's default implementation. This is the
        // robust choice for OAuth / email-login / checkout popups because it
        // preserves the `window.opener` relationship so the popup can
        // postMessage results back to the main page and close itself.
        "https" | "http" | "about" | "blob" => {
            dlog(&format!("popup allow {}", host_only(url)));
            NewWindowResponse::Allow
        }
        // Non-web schemes: open externally, deny the popup window.
        "mailto" | "tel" | "sms" | "facetime" | "facetime-audio" => {
            dlog(&format!("popup external scheme {}", url.scheme()));
            open_with_system(url);
            NewWindowResponse::Deny
        }
        other => {
            dlog(&format!("popup BLOCKED scheme {other}"));
            NewWindowResponse::Deny
        }
    }
}

// ---------------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------------

/// Strips path separators and unsafe characters from a server-provided name.
fn sanitize_filename(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| match c {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '.' | '-' | '_' | ' ' | '(' | ')' | '+' => c,
            _ => '_',
        })
        .collect();
    let trimmed = cleaned.trim_matches(|c| c == '.' || c == ' ').to_string();
    // Cap length (all chars are ASCII at this point, so byte slicing is safe).
    let limited = if trimmed.len() > 150 {
        trimmed[..150].to_string()
    } else {
        trimmed
    };
    if limited.is_empty() {
        "download".to_string()
    } else {
        limited
    }
}

/// Derives a safe filename from a download URL's last path segment.
fn filename_from_url(url: &Url) -> String {
    let raw = url
        .path_segments()
        .and_then(|mut s| s.next_back())
        .filter(|s| !s.is_empty())
        .unwrap_or("download");
    sanitize_filename(raw)
}

/// Returns a path in `dir` that does not collide with an existing file by
/// appending " (n)" before the extension if needed.
fn unique_path(dir: &Path, filename: &str) -> PathBuf {
    let candidate = dir.join(filename);
    if !candidate.exists() {
        return candidate;
    }
    let p = Path::new(filename);
    let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("download");
    let ext = p.extension().and_then(|s| s.to_str());
    for i in 1..10_000 {
        let name = match ext {
            Some(e) => format!("{stem} ({i}).{e}"),
            None => format!("{stem} ({i})"),
        };
        let c = dir.join(name);
        if !c.exists() {
            return c;
        }
    }
    candidate
}

/// Computes where a requested download should be saved: the user's Downloads
/// directory, with a sanitized, de-duplicated filename.
fn download_target(app: &AppHandle, url: &Url) -> PathBuf {
    let dir = app.path().download_dir().unwrap_or_else(|_| {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
        PathBuf::from(home).join("Downloads")
    });
    unique_path(&dir, &filename_from_url(url))
}

// ---------------------------------------------------------------------------
// Window creation
// ---------------------------------------------------------------------------

/// Creates the main window if it does not exist, otherwise shows/focuses it.
/// Used at startup and on Dock-icon reopen.
fn show_or_create_main(app: &AppHandle) -> tauri::Result<()> {
    if let Some(win) = app.get_webview_window(MAIN_LABEL) {
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(());
    }

    let url = WHOP_URL
        .parse::<Url>()
        .expect("WHOP_URL is a valid constant URL");

    let win = WebviewWindowBuilder::new(app, MAIN_LABEL, WebviewUrl::External(url))
        .title(APP_NAME)
        .inner_size(1440.0, 900.0)
        .min_inner_size(1000.0, 700.0)
        .center()
        .resizable(true)
        // Hidden title bar: the traffic lights float over the page content and
        // the injected CSS pads the page so nothing sits underneath them.
        .title_bar_style(TitleBarStyle::Overlay)
        .hidden_title(true)
        // Persistent (non-incognito) store keeps cookies + login across launches.
        .incognito(false)
        .data_store_identifier(DATA_STORE_ID)
        // Cmd +/-/0 zoom shortcuts handled natively by the webview.
        .zoom_hotkeys_enabled(true)
        // Keep timers/media alive in the background so calls and any
        // notification logic are not throttled when the window is not focused.
        .background_throttling(BackgroundThrottlingPolicy::Disabled)
        // Web Inspector is only compiled in for debug builds.
        .devtools(cfg!(debug_assertions))
        // App-authored page script (title-bar padding, tweaks, custom.css).
        // Main frame only; popups get WKWebView's plain default.
        .initialization_script(build_init_script(app))
        .on_navigation(allow_navigation)
        .on_new_window(|url, _features| handle_new_window(&url))
        .on_download(|webview, event| {
            let app = webview.app_handle();
            match event {
                DownloadEvent::Requested { url, destination } => {
                    let target = download_target(app, &url);
                    dlog(&format!(
                        "download start {} -> {}",
                        host_only(&url),
                        target
                            .file_name()
                            .and_then(|s| s.to_str())
                            .unwrap_or("download")
                    ));
                    *destination = target;
                    true
                }
                DownloadEvent::Finished { url, path, success } => {
                    let name = path
                        .as_ref()
                        .and_then(|p| p.file_name())
                        .and_then(|s| s.to_str())
                        .unwrap_or("download")
                        .to_string();
                    // Log host + filename + success only — never the signed URL.
                    dlog(&format!(
                        "download finished {} file={name} success={success}",
                        host_only(&url)
                    ));
                    if success {
                        if let Some(p) = path.clone() {
                            if let Some(state) = app.try_state::<AppState>() {
                                if let Ok(mut last) = state.last_download.lock() {
                                    *last = Some(p);
                                }
                            }
                        }
                        // Native completion notification (best-effort; only
                        // shows if the user has granted notification permission).
                        let _ = app
                            .notification()
                            .builder()
                            .title("Download complete")
                            .body(format!("Saved \u{201c}{name}\u{201d} to Downloads"))
                            .show();
                    }
                    true
                }
                // DownloadEvent is #[non_exhaustive].
                _ => true,
            }
        })
        .build()?;

    // Native drag strip under the hidden title bar. Tauri's data-tauri-drag-region
    // needs IPC (which the remote page deliberately lacks), so we handle it in
    // AppKit instead. Must run on the main thread once the NSWindow exists.
    #[cfg(target_os = "macos")]
    if let Ok(ptr) = win.ns_window() {
        let addr = ptr as usize;
        let _ = app.run_on_main_thread(move || {
            // SAFETY: `addr` is the NSWindow of a window that lives for the whole
            // process (close hides it, never destroys it), and we're on the main
            // thread.
            unsafe { drag::install_drag_strip(addr) };
        });
    }

    Ok(())
}

/// AppKit-level "drag the window when the user grabs the top strip" behaviour.
#[cfg(target_os = "macos")]
mod drag {
    use super::{TITLEBAR_HEIGHT, TRAFFIC_LIGHTS_WIDTH};
    use block2::RcBlock;
    use objc2::rc::Retained;
    use objc2_app_kit::{NSEvent, NSEventMask, NSWindow, NSWindowStyleMask};
    use std::ptr::NonNull;

    /// Installs a local NSEvent monitor that turns left-mouse-down events in the
    /// top `TITLEBAR_HEIGHT` points of `ns_window` (right of the traffic
    /// lights) into a native window drag, and double-clicks into zoom.
    pub(super) unsafe fn install_drag_strip(ns_window_ptr: usize) {
        let Some(window) = Retained::retain(ns_window_ptr as *mut NSWindow) else {
            return;
        };
        let window_number = window.windowNumber();

        let block = RcBlock::new(move |event: NonNull<NSEvent>| -> *mut NSEvent {
            let ev = event.as_ref();
            if ev.windowNumber() != window_number {
                return event.as_ptr();
            }
            if window.styleMask().contains(NSWindowStyleMask::FullScreen) {
                return event.as_ptr();
            }
            // Window coordinates: origin bottom-left, y grows upward.
            let loc = ev.locationInWindow();
            let content_h = window
                .contentView()
                .map(|v| v.frame().size.height)
                .unwrap_or(0.0);
            let in_strip = loc.y >= content_h - TITLEBAR_HEIGHT
                && loc.y <= content_h
                && loc.x > TRAFFIC_LIGHTS_WIDTH;
            if !in_strip {
                return event.as_ptr();
            }
            if ev.clickCount() >= 2 {
                window.performZoom(None);
            } else {
                window.performWindowDragWithEvent(ev);
            }
            // Swallow the event: the strip is padding we injected, so the page
            // has nothing interactive there.
            std::ptr::null_mut()
        });

        let monitor =
            NSEvent::addLocalMonitorForEventsMatchingMask_handler(NSEventMask::LeftMouseDown, &block);
        // The window is a process-lifetime singleton; keep the monitor forever.
        std::mem::forget(monitor);
        std::mem::forget(block);
    }
}

/// Shows + focuses the main window, or hides it if it is already frontmost.
fn toggle_main_window(app: &AppHandle) {
    match app.get_webview_window(MAIN_LABEL) {
        Some(w) => {
            let visible = w.is_visible().unwrap_or(false);
            let focused = w.is_focused().unwrap_or(false);
            if visible && focused {
                let _ = w.hide();
            } else {
                let _ = w.unminimize();
                let _ = w.show();
                let _ = w.set_focus();
            }
        }
        None => {
            let _ = show_or_create_main(app);
        }
    }
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

fn build_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    // App menu (becomes the application menu on macOS as the first submenu).
    let about_meta = AboutMetadataBuilder::new()
        .name(Some(APP_NAME))
        .version(Some(env!("CARGO_PKG_VERSION")))
        .comments(Some(
            "Unofficial personal-use desktop wrapper for whop.com. Fork by srikarsunchu of siyabendoezdemir/whop-desktop. Not affiliated with Whop.",
        ))
        .build();

    let app_menu = SubmenuBuilder::new(app, APP_NAME)
        .item(&PredefinedMenuItem::about(
            app,
            Some(&format!("About {APP_NAME}")),
            Some(about_meta),
        )?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, Some(&format!("Hide {APP_NAME}")))?)
        .item(&PredefinedMenuItem::hide_others(app, Some("Hide Others"))?)
        .item(&PredefinedMenuItem::show_all(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, Some(&format!("Quit {APP_NAME}")))?)
        .build()?;

    // File menu — small extra so completed downloads are reachable.
    let reveal = MenuItemBuilder::with_id("reveal_download", "Reveal Last Download in Finder")
        .accelerator("CmdOrCtrl+Shift+J")
        .build(app)?;
    let open_downloads =
        MenuItemBuilder::with_id("open_downloads", "Open Downloads Folder").build(app)?;
    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&reveal)
        .item(&open_downloads)
        .build()?;

    // Edit menu — standard predefined items (handled natively by the OS).
    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .item(&PredefinedMenuItem::undo(app, None)?)
        .item(&PredefinedMenuItem::redo(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, None)?)
        .item(&PredefinedMenuItem::copy(app, None)?)
        .item(&PredefinedMenuItem::paste(app, None)?)
        .item(&PredefinedMenuItem::select_all(app, None)?)
        .build()?;

    // View menu — custom items routed to the current webview (not new windows).
    let back = MenuItemBuilder::with_id("back", "Back")
        .accelerator("CmdOrCtrl+[")
        .build(app)?;
    let forward = MenuItemBuilder::with_id("forward", "Forward")
        .accelerator("CmdOrCtrl+]")
        .build(app)?;
    let reload = MenuItemBuilder::with_id("reload", "Reload")
        .accelerator("CmdOrCtrl+R")
        .build(app)?;
    let force_reload = MenuItemBuilder::with_id("force_reload", "Force Reload")
        .accelerator("CmdOrCtrl+Shift+R")
        .build(app)?;
    let actual_size = MenuItemBuilder::with_id("actual_size", "Actual Size")
        .accelerator("CmdOrCtrl+0")
        .build(app)?;
    let zoom_in = MenuItemBuilder::with_id("zoom_in", "Zoom In")
        .accelerator("CmdOrCtrl+Plus")
        .build(app)?;
    let zoom_out = MenuItemBuilder::with_id("zoom_out", "Zoom Out")
        .accelerator("CmdOrCtrl+-")
        .build(app)?;

    let mut view_builder = SubmenuBuilder::new(app, "View")
        .item(&back)
        .item(&forward)
        .item(&reload)
        .item(&force_reload)
        .separator()
        .item(&actual_size)
        .item(&zoom_in)
        .item(&zoom_out)
        .separator();

    // Tweaks: check items whose state is persisted in prefs.json.
    let prefs = load_prefs(app);
    let mut tweak_items = BTreeMap::new();
    for (id, label) in TWEAKS {
        let item = CheckMenuItemBuilder::with_id(format!("tweak:{id}"), *label)
            .checked(*prefs.tweaks.get(*id).unwrap_or(&false))
            .build(app)?;
        view_builder = view_builder.item(&item);
        tweak_items.insert((*id).to_string(), item);
    }
    if let Some(state) = app.try_state::<AppState>() {
        if let Ok(mut items) = state.tweak_items.lock() {
            *items = tweak_items;
        }
        if let Ok(mut p) = state.prefs.lock() {
            *p = prefs;
        }
    }

    let edit_css = MenuItemBuilder::with_id("edit_custom_css", "Edit Custom CSS\u{2026}").build(app)?;
    let reload_css = MenuItemBuilder::with_id("reload_custom_css", "Reload Custom CSS")
        .accelerator("CmdOrCtrl+Alt+R")
        .build(app)?;
    view_builder = view_builder
        .separator()
        .item(&edit_css)
        .item(&reload_css)
        .separator()
        .item(&PredefinedMenuItem::fullscreen(app, None)?);

    // Web Inspector only exists in debug builds (devtools is disabled in release).
    #[cfg(debug_assertions)]
    {
        let inspector = MenuItemBuilder::with_id("inspector", "Open Web Inspector")
            .accelerator("CmdOrCtrl+Alt+I")
            .build(app)?;
        view_builder = view_builder.separator().item(&inspector);
    }

    let view_menu = view_builder.build()?;

    // Window menu.
    let toggle = MenuItemBuilder::with_id("toggle_window", &format!("Show/Hide {APP_NAME}"))
        .accelerator("CmdOrCtrl+Shift+W")
        .build(app)?;
    let window_menu = SubmenuBuilder::new(app, "Window")
        .item(&PredefinedMenuItem::minimize(app, None)?)
        .item(&PredefinedMenuItem::maximize(app, Some("Zoom"))?)
        .separator()
        .item(&toggle)
        .build()?;

    MenuBuilder::new(app)
        .item(&app_menu)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&view_menu)
        .item(&window_menu)
        .build()
}

/// Menu-bar (tray) icon with a left-click toggle and a right-click menu.
fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let toggle = MenuItemBuilder::with_id("tray_toggle", &format!("Show/Hide {APP_NAME}"))
        .build(app)?;
    let quit = MenuItemBuilder::with_id("tray_quit", &format!("Quit {APP_NAME}")).build(app)?;
    let menu = MenuBuilder::new(app)
        .item(&toggle)
        .separator()
        .item(&quit)
        .build()?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(tauri::include_image!("icons/tray-template.png"))
        .icon_as_template(true)
        .tooltip(APP_NAME)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_main_window(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

/// Registers the system-wide show/hide hotkey. Failure (e.g. another app owns
/// the combo) is logged and otherwise ignored so startup never aborts.
fn register_global_shortcut(app: &AppHandle) {
    let result = app
        .global_shortcut()
        .on_shortcut(TOGGLE_SHORTCUT, |app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                toggle_main_window(app);
            }
        });
    if let Err(e) = result {
        dlog(&format!("global shortcut {TOGGLE_SHORTCUT} not registered: {e}"));
    }
}

/// Runs a closure with the main webview window if it exists.
fn with_main<F: FnOnce(&WebviewWindow)>(app: &AppHandle, f: F) {
    if let Some(win) = app.get_webview_window(MAIN_LABEL) {
        f(&win);
    }
}

/// Applies an absolute zoom factor and records it in state.
fn set_zoom_abs(app: &AppHandle, value: f64) {
    let clamped = value.clamp(0.3, 3.0);
    if let Some(state) = app.try_state::<AppState>() {
        if let Ok(mut z) = state.zoom.lock() {
            *z = clamped;
        }
    }
    with_main(app, |w| {
        let _ = w.set_zoom(clamped);
    });
}

/// Adjusts zoom by a delta relative to the current factor.
fn adjust_zoom(app: &AppHandle, delta: f64) {
    let current = app
        .try_state::<AppState>()
        .and_then(|s| s.zoom.lock().ok().map(|z| *z))
        .unwrap_or(1.0);
    set_zoom_abs(app, current + delta);
}

fn handle_menu_event(app: &AppHandle, event: MenuEvent) {
    let id = event.id().as_ref();
    if let Some(tweak) = id.strip_prefix("tweak:") {
        // muda flips the check state before emitting the event, so the item
        // already reflects the new value.
        let enabled = app
            .try_state::<AppState>()
            .and_then(|s| {
                s.tweak_items
                    .lock()
                    .ok()
                    .and_then(|items| items.get(tweak).and_then(|i| i.is_checked().ok()))
            })
            .unwrap_or(false);
        set_tweak(app, tweak, enabled);
        return;
    }
    match id {
        "back" => with_main(app, |w| {
            let _ = w.eval("window.history.back()");
        }),
        "forward" => with_main(app, |w| {
            let _ = w.eval("window.history.forward()");
        }),
        "reload" => with_main(app, |w| {
            let _ = w.reload();
        }),
        // WKWebView has no public hard-bypass-cache reload; a normal reload is
        // the safe equivalent here.
        "force_reload" => with_main(app, |w| {
            let _ = w.eval("window.location.reload()");
        }),
        "actual_size" => set_zoom_abs(app, 1.0),
        "zoom_in" => adjust_zoom(app, 0.1),
        "zoom_out" => adjust_zoom(app, -0.1),
        "edit_custom_css" => edit_custom_css(app),
        "reload_custom_css" => reload_custom_css(app),
        "toggle_window" | "tray_toggle" => toggle_main_window(app),
        "tray_quit" => app.exit(0),
        "reveal_download" => {
            if let Some(state) = app.try_state::<AppState>() {
                if let Ok(guard) = state.last_download.lock() {
                    if let Some(p) = guard.as_ref() {
                        reveal_in_finder(p);
                    }
                }
            }
        }
        "open_downloads" => {
            if let Ok(dir) = app.path().download_dir() {
                let _ = std::process::Command::new("open").arg(dir).spawn();
            }
        }
        #[cfg(debug_assertions)]
        "inspector" => with_main(app, |w| w.open_devtools()),
        _ => {}
    }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Native notification plugin — used ONLY by this wrapper for download
        // completion. It is never exposed to the remote whop.com page.
        .plugin(tauri_plugin_notification::init())
        // Global shortcut plugin — registered and handled purely from Rust.
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(AppState::default())
        .menu(build_menu)
        .on_menu_event(handle_menu_event)
        .setup(|app| {
            show_or_create_main(app.handle())?;
            build_tray(app.handle())?;
            register_global_shortcut(app.handle());
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != MAIN_LABEL {
                return;
            }
            match event {
                // Standard macOS behaviour: closing the window with the red
                // button hides it (keeping the app and the in-memory session
                // alive) instead of quitting. Reopen via the Dock icon, the
                // tray icon, or the global shortcut.
                WindowEvent::CloseRequested { api, .. } => {
                    let _ = window.hide();
                    api.prevent_close();
                }
                // Collapse the title-bar padding while in fullscreen (the
                // traffic lights are hidden there).
                WindowEvent::Resized(_) => {
                    let fs = window.is_fullscreen().unwrap_or(false);
                    if let Some(w) = window.get_webview_window(MAIN_LABEL) {
                        let _ = w.eval(&format!(
                            "window.__whopDesktop && window.__whopDesktop.setFullscreen({fs})"
                        ));
                    }
                }
                _ => {}
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building the Whop Desktop application")
        .run(|app, event| {
            if let RunEvent::Reopen { .. } = event {
                let _ = show_or_create_main(app);
            }
        });
}
