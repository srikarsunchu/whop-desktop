# Native Curfew dashboard

Curfew now renders as local React/Frosted UI inside Whop Desktop. The previous hosted webview, pane positioning loop, and unstable Tauri feature are removed.

The screen includes status, four summary cards, an inspectable payment activity chart, all six signal explanations, incident history with pending-action cancellation, filtered payment rows with risk explanations, launch mode, protection settings, baseline refresh, and disconnection. Destructive and protection-setting changes have review dialogs. Demo scenarios are explicitly synthetic and run entirely in memory.

The Rust bridge talks only to the fixed Curfew HTTPS API and Whop's account-verification endpoint. It validates the business before connection, rejects mismatched sessions before actions, limits action names and payloads, passes credentials through stdin, and stores per-business session cookies in a private app-data directory. It does not embed HTML or expose API keys in process arguments or localStorage.

Validation: production frontend and macOS app builds; Rust tests for invalid accounts/actions, payload boundaries, and curl configuration escaping; existing business workflow suite. Native app walkthrough verified live disconnected state, connection form, switching to/from demo, attack signals and pending counts, incident cancellation, launch-mode confirmation and status, and protection-settings review/save. No live key was submitted, no live protection settings changed, and no refunds were executed. Authenticated backend operations still require end-to-end verification with a connected account.

The existing backend continues handling webhooks, learning, holds, and refunds independently of the desktop. It is not deployed or modified by this change. A signed-in state read follows that backend's existing `/api/state` behavior, including its hold timer check. Cookie sessions from the removed embedded browser are not migrated; reconnect from the native form.
