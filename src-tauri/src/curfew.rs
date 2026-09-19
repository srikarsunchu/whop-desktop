//! Native JSON bridge. No hosted HTML, webview, or credentials in localStorage.
use serde_json::{json, Value};
use std::{
    fs,
    io::Write,
    os::unix::fs::{OpenOptionsExt, PermissionsExt},
    path::Path,
    process::{Command, Stdio},
    sync::Mutex,
};
use tauri::{AppHandle, Manager, Webview};
const ORIGIN: &str = "https://curfew-blush.vercel.app";
static REQUEST: Mutex<()> = Mutex::new(());

fn quote(s: &str) -> String {
    format!(
        "\"{}\"",
        s.replace('\\', "\\\\")
            .replace('"', "\\\"")
            .replace('\n', "\\n")
            .replace('\r', "\\r")
    )
}
fn http(
    url: &str,
    jar: Option<&Path>,
    body: Option<&Value>,
    key: Option<&str>,
) -> Result<(u16, Value), String> {
    let mut config = format!(
        "url = {}\nheader = \"Content-Type: application/json\"\n",
        quote(url)
    );
    if let Some(key) = key {
        config += &format!(
            "header = {}\n",
            quote(&format!("Authorization: Bearer {key}"))
        );
    }
    if let Some(body) = body {
        config += &format!("data = {}\n", quote(&body.to_string()));
    }
    let mut cmd = Command::new("/usr/bin/curl");
    cmd.args([
        "--silent",
        "--show-error",
        "--proto",
        "=https",
        "--connect-timeout",
        "15",
        "--max-time",
        "75",
        "--max-filesize",
        "8388608",
        "--write-out",
        "\n%{http_code}",
        "--config",
        "-",
    ]);
    if let Some(jar) = jar {
        cmd.arg("--cookie").arg(jar).arg("--cookie-jar").arg(jar);
    }
    let mut child = cmd
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|_| "Could not start the Curfew connection")?;
    child
        .stdin
        .take()
        .ok_or("Connection input unavailable")?
        .write_all(config.as_bytes())
        .map_err(|_| "Could not send the Curfew request")?;
    let out = child
        .wait_with_output()
        .map_err(|_| "The Curfew connection stopped")?;
    if !out.status.success() {
        return Err("Couldn’t reach Curfew. Check your connection and retry. If connecting, the server may still be learning your baseline.".into());
    }
    let raw = String::from_utf8_lossy(&out.stdout);
    let (body, status) = raw.rsplit_once('\n').ok_or("Invalid Curfew response")?;
    let status = status
        .parse::<u16>()
        .map_err(|_| "Invalid response status")?;
    let data = serde_json::from_str(body)
        .map_err(|_| "Curfew returned an unexpected response. Try again shortly.")?;
    Ok((status, data))
}
fn check(status: u16, data: Value) -> Result<Value, String> {
    if !(200..300).contains(&status) {
        return Err(data
            .get("error")
            .and_then(Value::as_str)
            .unwrap_or("Curfew couldn’t complete that request")
            .chars()
            .take(400)
            .collect());
    }
    Ok(data)
}
fn validate_account(account: &str) -> Result<(), String> {
    if !account.starts_with("biz_")
        || account.len() > 100
        || !account
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_')
        || account == "biz_demoNorthwind"
    {
        return Err("Choose a live business first".into());
    }
    Ok(())
}
fn action_body(action: &str, body: &Value) -> Result<(String, Value), String> {
    match action {
        "launch" => {
            let hours = body["hours"]
                .as_u64()
                .filter(|h| [0, 1, 2, 4, 8, 24].contains(h))
                .ok_or("Choose a valid launch duration")?;
            Ok(("launch".into(), json!({"hours": hours})))
        }
        "undo" => {
            let id = body["id"]
                .as_u64()
                .filter(|i| *i > 0)
                .ok_or("Invalid incident")?;
            Ok((format!("undo/{id}"), json!({})))
        }
        "settings" => {
            let delay = body["refundDelayMin"]
                .as_u64()
                .filter(|d| (1..=120).contains(d))
                .ok_or("Refund delay must be 1–120 minutes")?;
            let revoke = body["immediateRevoke"]
                .as_bool()
                .ok_or("Choose when to revoke access")?;
            let alert = body["alertUrl"].as_str().unwrap_or("");
            if alert.len() > 500 || (!alert.is_empty() && !alert.starts_with("https://")) {
                return Err("Use an HTTPS alert webhook URL".into());
            }
            Ok((
                "settings".into(),
                json!({"refundDelayMin":delay,"immediateRevoke":revoke,"alertUrl":alert}),
            ))
        }
        "relearn" | "disconnect" => Ok((action.into(), json!({}))),
        _ => Err("Unsupported Curfew action".into()),
    }
}

#[tauri::command]
pub async fn curfew_request(
    app: AppHandle,
    webview: Webview,
    account: String,
    action: String,
    body: Option<Value>,
) -> Result<Value, String> {
    if webview.label() != "main" {
        return Err("Only the desktop workspace can access Curfew".into());
    }
    validate_account(&account)?;
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("curfew-sessions");
    tauri::async_runtime::spawn_blocking(move || {
        let _lock = REQUEST.lock().map_err(|_| "Curfew connection is busy")?;
        fs::create_dir_all(&dir).map_err(|_| "Cannot create the Curfew session folder")?;
        fs::set_permissions(&dir, fs::Permissions::from_mode(0o700)).map_err(|_| "Cannot protect the Curfew session folder")?;
        let jar = dir.join(format!("{account}.cookies"));
        fs::OpenOptions::new().create(true).append(true).mode(0o600).open(&jar).map_err(|_| "Cannot save the Curfew session")?;
        fs::set_permissions(&jar, fs::Permissions::from_mode(0o600)).map_err(|_| "Cannot protect the Curfew session")?;
        let body = body.unwrap_or(json!({}));
        if action == "connect" {
            let key = body["apiKey"].as_str().unwrap_or("").trim();
            if key.is_empty() || key.len() > 4096 || key.contains(['\r', '\n']) { return Err("Enter a valid Whop account API key".into()); }
            // Verify ownership before Curfew creates a webhook or rotates a session.
            let (status, me) = http("https://api.whop.com/api/v1/accounts?first=1", None, None, Some(key))?;
            let me = check(status, me)?;
            if me["data"][0]["id"].as_str() != Some(account.as_str()) { return Err("This key belongs to a different business. Switch businesses or use the matching key.".into()); }
            let (status, data) = http(&format!("{ORIGIN}/api/connect"), Some(&jar), Some(&json!({"apiKey":key})), None)?;
            return check(status, data);
        }
        let (status, state) = http(&format!("{ORIGIN}/api/state"), Some(&jar), None, None)?;
        if status == 401 { return if action == "state" { Ok(json!({"connected":false})) } else { Err("Reconnect this business to Curfew first".into()) }; }
        let state = check(status, state)?;
        if state["tenant"]["account_id"].as_str() != Some(account.as_str()) { return Err("The Curfew session does not match this business. Reconnect with the correct key.".into()); }
        if action == "state" { return Ok(state); }
        let (path, payload) = action_body(&action, &body)?;
        let (status, data) = http(&format!("{ORIGIN}/api/{path}"), Some(&jar), Some(&payload), None)?;
        let data = check(status, data)?;
        if action == "disconnect" { let _ = fs::remove_file(&jar); }
        Ok(data)
    }).await.map_err(|_| "Curfew request was interrupted")?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_unscoped_accounts_and_unsafe_actions() {
        assert!(validate_account("../other").is_err());
        assert!(validate_account("biz_demoNorthwind").is_err());
        assert!(action_body("refund", &json!({})).is_err());
        assert!(action_body("undo", &json!({"id":"../settings"})).is_err());
        assert!(action_body("launch", &json!({"hours":-1})).is_err());
        assert!(action_body(
            "settings",
            &json!({"refundDelayMin":0,"immediateRevoke":true})
        )
        .is_err());
        assert_eq!(action_body("undo", &json!({"id":42})).unwrap().0, "undo/42");
    }
    #[test]
    fn config_values_cannot_inject_curl_options() {
        assert_eq!(quote("a\"\nurl = evil"), "\"a\\\"\\nurl = evil\"");
    }
}
