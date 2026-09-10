// Prevents an extra console window on Windows in release. Harmless on macOS.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // When Claude runs `whop`, PATH resolves to this binary with
    // WHOP_DESKTOP_SHIM=1: act as the gated shim instead of launching the app.
    if std::env::var(whop_desktop_lib::assistant::SHIM_ENV).ok().as_deref() == Some("1") {
        whop_desktop_lib::assistant::shim_main();
    }
    whop_desktop_lib::run();
}
