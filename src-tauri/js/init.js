// Whop Desktop — injected at document start into the main webview only.
// Authored by this app (not by whop.com). It has NO access to Tauri IPC or any
// native capability; it only adds stylesheets and a small window.__whopDesktop
// API that the Rust side drives via eval().
;(function () {
  if (window.__whopDesktop) return;
  var host = location.hostname;

  // Google sign-in popup. WKWebView only offers the cross-device (Bluetooth)
  // passkey path, so when Google sees a passkey-capable browser it tries that
  // and fails with "Something went wrong". Hide WebAuthn from the page so
  // Google falls back to its normal password flow.
  if (host === 'accounts.google.com' || host.endsWith('.google.com')) {
    try { delete window.PublicKeyCredential; } catch (e) {}
    try {
      Object.defineProperty(window, 'PublicKeyCredential', { value: undefined, configurable: true, writable: true });
    } catch (e) {}
    try {
      Object.defineProperty(Navigator.prototype, 'credentials', { get: function () { return undefined; }, configurable: true });
    } catch (e) {}
    return;
  }

  if (!(host === 'whop.com' || host.endsWith('.whop.com'))) return;

  var TITLEBAR = __WD_TITLEBAR_HEIGHT__;
  var CUSTOM_CSS = __WD_CUSTOM_CSS__;
  var INITIAL = __WD_INITIAL_TWEAKS__;
  var LS_KEY = 'whopdesktop.tweaks';

  // Always-on: push whop's layout down so nothing sits under the traffic lights.
  var BASE_CSS =
    ':root{--wd-titlebar:' + TITLEBAR + 'px}' +
    'html.wd-fullscreen{--wd-titlebar:0px}' +
    'body{padding-top:var(--wd-titlebar)!important;box-sizing:border-box}' +
    'body::before{content:"";position:fixed;top:0;left:0;right:0;height:var(--wd-titlebar);' +
      'z-index:2147483647;pointer-events:none;background:inherit}' +
    'header.fixed,header.sticky,nav.fixed,nav.sticky,[class~="fixed"][class~="top-0"],' +
    '[class~="sticky"][class~="top-0"]{top:var(--wd-titlebar)!important}' +
    'aside.fixed,aside[class~="h-screen"],[class~="fixed"][class~="h-screen"],[class~="fixed"][class~="inset-y-0"]' +
      '{top:var(--wd-titlebar)!important;height:calc(100vh - var(--wd-titlebar))!important}';

  var TWEAK_DEFS = {
    compact:
      'html{font-size:14px}' +
      '[class~="p-6"]{padding:1rem!important}' +
      '[class~="px-6"]{padding-left:1rem!important;padding-right:1rem!important}' +
      '[class~="py-6"]{padding-top:1rem!important;padding-bottom:1rem!important}' +
      '[class~="py-4"]{padding-top:.5rem!important;padding-bottom:.5rem!important}' +
      '[class~="gap-6"]{gap:1rem!important}[class~="gap-4"]{gap:.5rem!important}' +
      '[class~="space-y-6"]>*+*{margin-top:1rem!important}[class~="space-y-4"]>*+*{margin-top:.5rem!important}',
    hide_promos:
      '[class*="banner"],[class*="promo"],[class*="upsell"],[class*="announcement"],' +
      '[id*="intercom"],iframe[src*="intercom"],[data-testid*="banner"],[data-testid*="promo"]' +
      '{display:none!important}',
    dark_scrollbars:
      '*{scrollbar-color:#3a3a3a #111;scrollbar-width:thin}' +
      '::-webkit-scrollbar{width:10px;height:10px;background:#111}' +
      '::-webkit-scrollbar-thumb{background:#3a3a3a;border-radius:6px}' +
      '::-webkit-scrollbar-thumb:hover{background:#555}'
  };

  var useAdopted = 'adoptedStyleSheets' in document &&
    typeof CSSStyleSheet.prototype.replaceSync === 'function';
  var sheets = {};

  function attach(el) {
    var parent = document.head || document.documentElement;
    if (el.parentNode !== parent) parent.appendChild(el);
  }
  function setSheet(name, css) {
    if (useAdopted) {
      var s = sheets[name];
      if (!s) { s = new CSSStyleSheet(); sheets[name] = s; }
      s.replaceSync(css || '');
      var list = Array.prototype.slice.call(document.adoptedStyleSheets);
      if (list.indexOf(s) === -1) { list.push(s); document.adoptedStyleSheets = list; }
    } else {
      var el = sheets[name];
      if (!el) {
        el = document.createElement('style');
        el.setAttribute('data-whop-desktop', name);
        sheets[name] = el;
      }
      el.textContent = css || '';
      attach(el);
    }
  }
  if (!useAdopted) {
    document.addEventListener('DOMContentLoaded', function () {
      Object.keys(sheets).forEach(function (k) { attach(sheets[k]); });
      new MutationObserver(function () {
        Object.keys(sheets).forEach(function (k) { if (!sheets[k].isConnected) attach(sheets[k]); });
      }).observe(document.documentElement, { childList: true, subtree: false });
    });
  }

  function readState() {
    try { var raw = localStorage.getItem(LS_KEY); if (raw) return JSON.parse(raw); } catch (e) {}
    return null;
  }
  function writeState(st) { try { localStorage.setItem(LS_KEY, JSON.stringify(st)); } catch (e) {} }

  var state = Object.assign({}, INITIAL, readState() || {});
  Object.keys(TWEAK_DEFS).forEach(function (k) { if (typeof state[k] !== 'boolean') state[k] = false; });

  function apply() {
    setSheet('base', BASE_CSS);
    Object.keys(TWEAK_DEFS).forEach(function (k) { setSheet('tweak:' + k, state[k] ? TWEAK_DEFS[k] : ''); });
    setSheet('custom', CUSTOM_CSS);
  }

  var api = {
    set: function (name, enabled) {
      if (!(name in TWEAK_DEFS)) return;
      state[name] = !!enabled; writeState(state);
      setSheet('tweak:' + name, state[name] ? TWEAK_DEFS[name] : '');
    },
    get: function (name) { return !!state[name]; },
    setCustomCss: function (css) { CUSTOM_CSS = String(css || ''); setSheet('custom', CUSTOM_CSS); },
    setFullscreen: function (on) { document.documentElement.classList.toggle('wd-fullscreen', !!on); },
    state: function () { return Object.assign({}, state); }
  };
  Object.defineProperty(window, '__whopDesktop', { value: Object.freeze(api), writable: false, configurable: false });

  apply();
})();
