//! Claude-powered assistant: spawns the local Claude Code CLI in headless mode
//! (`claude -p … --output-format stream-json`) and streams its events to the
//! frontend. Claude is only allowed one tool: `Bash(whop:*)`, and `whop` on its
//! PATH resolves to THIS binary running as a shim (see [`shim_main`]) which
//! blocks write commands unless the user enabled them, and serves the demo
//! dataset when the demo business is selected.

use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};

/// Env var that turns this binary into the `whop` shim.
pub const SHIM_ENV: &str = "WHOP_DESKTOP_SHIM";
const REAL_WHOP_ENV: &str = "WHOP_DESKTOP_REAL_WHOP";
const ALLOW_WRITES_ENV: &str = "WHOP_DESKTOP_ALLOW_WRITES";
const DEMO_FILE_ENV: &str = "WHOP_DESKTOP_DEMO_FILE";

/// Sub-commands that change state or move money. Anything else is a read.
const WRITE_VERBS: &[&str] = &[
    "create", "delete", "update", "cancel", "pause", "resume", "transfer", "deploy", "publish",
    "unpublish", "replay", "deliveries-replay", "extend", "invite", "logout", "switch", "login",
    "mark_read", "form_company", "transfer_ownership", "update-preferences", "create-method",
    "delete-method", "update-method", "retry_payment", "unpause", "duplicate", "submit",
    "return_url", "account", "init", "upgrade", "add", "remove",
];

pub fn is_write(args: &[String]) -> bool {
    args.iter().take(3).any(|a| WRITE_VERBS.contains(&a.as_str()))
}

// ---------------------------------------------------------------------------
// Shim: `whop` as seen by Claude
// ---------------------------------------------------------------------------

/// Entry point when the binary is invoked as the `whop` shim. Never returns.
pub fn shim_main() -> ! {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let code = shim_run(&args);
    std::process::exit(code);
}

fn shim_run(args: &[String]) -> i32 {
    // Demo business: answer from the fixtures file the app wrote.
    if let Ok(file) = std::env::var(DEMO_FILE_ENV) {
        return shim_demo(&file, args);
    }
    if is_write(args) && std::env::var(ALLOW_WRITES_ENV).ok().as_deref() != Some("1") {
        let msg = serde_json::json!({
            "code": "WRITE_BLOCKED",
            "message": format!(
                "Whop Desktop blocked `whop {}` because it changes production data. Ask the user to turn on \"Allow writes\" in the assistant header, then run it again once they confirm.",
                args.join(" ")
            )
        });
        println!("{}", serde_json::to_string_pretty(&msg).unwrap());
        return 2;
    }
    let real = std::env::var(REAL_WHOP_ENV).unwrap_or_else(|_| "whop".into());
    let mut cmd = Command::new(real);
    cmd.args(args);
    cmd.env_remove(SHIM_ENV);
    match cmd.status() {
        Ok(s) => s.code().unwrap_or(1),
        Err(e) => {
            eprintln!("whop shim: {e}");
            127
        }
    }
}

fn shim_demo(file: &str, args: &[String]) -> i32 {
    let text = match fs::read_to_string(file) {
        Ok(t) => t,
        Err(e) => {
            println!("{{\"code\":\"DEMO\",\"message\":\"demo fixtures unavailable: {e}\"}}");
            return 1;
        }
    };
    let map: HashMap<String, serde_json::Value> = serde_json::from_str(&text).unwrap_or_default();
    let a = |i: usize| args.get(i).cloned().unwrap_or_default();
    let flag = |name: &str| args.iter().position(|x| x == name).and_then(|i| args.get(i + 1)).cloned();
    let mut keys = vec![];
    if !a(2).starts_with("--") && !a(2).is_empty() {
        keys.push(format!("{} {} {}", a(0), a(1), a(2)));
    }
    if let Some(v) = flag("--report_type") {
        keys.push(format!("{} {} {}", a(0), a(1), v));
    }
    if let Some(v) = flag("--status") {
        keys.push(format!("{} {} --status {}", a(0), a(1), v));
    }
    keys.push(format!("{} {}", a(0), a(1)));
    keys.push(a(0));
    if args.iter().any(|x| x == "--help" || x == "--schema") {
        // Let the real CLI answer help/schema questions; they carry no data.
        let real = std::env::var(REAL_WHOP_ENV).unwrap_or_else(|_| "whop".into());
        let mut cmd = Command::new(real);
        cmd.args(args).env_remove(SHIM_ENV).env_remove(DEMO_FILE_ENV);
        return cmd.status().map(|s| s.code().unwrap_or(1)).unwrap_or(127);
    }
    for k in keys {
        if let Some(v) = map.get(&k) {
            println!("{}", serde_json::to_string_pretty(v).unwrap());
            return 0;
        }
    }
    if is_write(args) {
        println!("{{\"code\":\"DEMO\",\"message\":\"This is the demo business (Northwind Picks): write commands are simulated as successful.\",\"ok\":true}}");
        return 0;
    }
    println!(
        "{{\"code\":\"DEMO\",\"message\":\"No demo data for `whop {}`. The demo business only has data for products, memberships, members, ledgers, payouts, people, apps, stats, disputes and accounts.\"}}",
        args.join(" ")
    );
    1
}

// ---------------------------------------------------------------------------
// Assistant runs
// ---------------------------------------------------------------------------

#[derive(Default)]
pub struct AssistantState {
    runs: Mutex<HashMap<String, Child>>,
}

#[derive(Deserialize)]
pub struct StartArgs {
    pub run_id: String,
    pub prompt: String,
    pub session_id: Option<String>,
    pub account_id: Option<String>,
    pub account_title: Option<String>,
    pub demo: bool,
    pub allow_writes: bool,
    pub model: Option<String>,
}

#[derive(Serialize, Clone)]
struct LineEvent {
    run_id: String,
    line: String,
}

#[derive(Serialize, Clone)]
struct DoneEvent {
    run_id: String,
    code: i32,
    stderr: String,
}

/// Locates the Claude Code CLI.
pub fn claude_binary() -> Option<PathBuf> {
    if let Some(p) = std::env::var_os("CLAUDE_BIN") {
        let p = PathBuf::from(p);
        if p.is_file() {
            return Some(p);
        }
    }
    let home = std::env::var("HOME").unwrap_or_default();
    let mut candidates: Vec<PathBuf> = vec![
        PathBuf::from(&home).join(".local/bin/claude"),
        PathBuf::from(&home).join(".claude/local/claude"),
        PathBuf::from("/opt/homebrew/bin/claude"),
        PathBuf::from("/usr/local/bin/claude"),
        PathBuf::from(&home).join(".npm-global/bin/claude"),
    ];
    if let Some(path) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&path) {
            candidates.push(dir.join("claude"));
        }
    }
    candidates.into_iter().find(|p| p.is_file())
}

fn config_dir(app: &AppHandle) -> PathBuf {
    let home = std::env::var_os("HOME").unwrap_or_default();
    PathBuf::from(home)
        .join("Library")
        .join("Application Support")
        .join(&app.config().identifier)
}

/// Creates `<config>/bin/whop` → this executable, so Claude's `whop` is the shim.
fn ensure_shim_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = config_dir(app).join("bin");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let link = dir.join("whop");
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let stale = fs::read_link(&link).map(|t| t != exe).unwrap_or(true);
    if stale {
        let _ = fs::remove_file(&link);
        std::os::unix::fs::symlink(&exe, &link).map_err(|e| e.to_string())?;
    }
    Ok(dir)
}

fn system_prompt(a: &StartArgs) -> String {
    let biz = match (&a.account_title, &a.account_id) {
        (Some(t), Some(id)) => format!("{t} ({id})"),
        (Some(t), None) => t.clone(),
        _ => "the user's business".to_string(),
    };
    let acct_flag = a
        .account_id
        .as_deref()
        .filter(|_| !a.demo)
        .map(|id| format!("Pass `--account_id {id}` on every account-scoped command (lists, gets, reports, stats). "))
        .unwrap_or_default();
    let demo = if a.demo {
        "DEMO MODE: this is a demo business with invented data; say so once if asked whether it is real. "
    } else {
        ""
    };
    let writes = if a.allow_writes {
        "Writes are ENABLED: still explain what a write command will do and get an explicit yes in chat before running create/update/delete/cancel/payout/deploy commands."
    } else {
        "Writes are DISABLED: if a command returns WRITE_BLOCKED, tell the user to turn on \"Allow writes\" in the header and confirm, then retry. Never try to work around the block."
    };
    let reference = if a.demo {
        "DEMO COMMAND SET (only these return data; do not explore with --schema/--help/stats list): \
`whop products list` (data[]: id,title,route,visibility,member_count,default_plan{plan_type,billing_period,initial_price{amount},renewal_price{amount}}); \
`whop memberships list [--status active|trialing|past_due|canceling|paused|canceled|expired]` (data[]: id,status,created_at,renewal_period_end,product{title},plan{plan_type,renewal_price,initial_price},user{username,name}); \
`whop members list`; `whop people list` (visitors: location,device,event_count,purchase_count,ltv,last_seen_at); `whop payouts list`; `whop disputes list`; `whop apps list`; `whop recommended-actions list`; \
`whop ledgers list` (data[]: type payment|refund|payout, description, amount{amount}, created_at); `whop ledgers report --report_type balance_summary|income_statement` (rows[]: category|label, amount); \
`whop stats get <net_revenue|gross_revenue|new_memberships|paid_active_members|new_users|account_balance|visitors|ad_spend> --from YYYY-MM-DD --to YYYY-MM-DD --interval day` (data.points[{timestamp,value}], daily); \
ADS: `whop ad-campaigns list [--status active|paused]` (data[]: id,title,status,objective,budget_amount,budget_type,spend,impressions,clicks,results,cost_per_result,return_on_ad_spend), `whop ad-groups list`, `whop ads list` (headlines,descriptions,call_to_action,creatives), `whop audiences list`, `whop social-accounts list`; \
MEDIA: `whop media generate --type image|video --prompt \"…\" --wait true` (returns {id,status,file{id,url},cost}; billed from balance); BOUNTIES: `whop bounties list` (title,status,business_goal_type,gross_reward_amount,gross_paid_out_amount,submissions_count); PARTNERS: `whop partners list`, `whop partners leaderboard`. \
There is no per-product revenue metric: derive it from memberships × plan price, or from ledger descriptions (\"<product> · <user>\"). Two or three commands usually answer any question."
    } else {
        "COMMAND REFERENCE (go straight to these; only use `--schema` if a command errors): \
`whop products list`, `whop plans list --product_id <id>`, `whop memberships list [--status …] [--product_id <id>] [--first 100]`, `whop members list`, `whop people list`, `whop payouts list`, `whop disputes list`, `whop apps list`, \
`whop ledgers list` (no --first flag), `whop ledgers report --report_type balance_summary|income_statement`, \
`whop stats list` (metric catalog), `whop stats get <metric> --from YYYY-MM-DD --to YYYY-MM-DD --interval day|week|month` with metrics such as net_revenue, gross_revenue, monthly_recurring_revenue, churn_rate, paid_active_members, new_users, account_balance, total_refunded, disputes, ad_spend. \
ADS (Meta, funded from the Whop balance, attributed by the Whop pixel): `whop ad-campaigns list [--status …] [--stats_from YYYY-MM-DD]` (spend, impressions, clicks, results, cost_per_result, return_on_ad_spend per campaign), `whop ad-groups list`, `whop ads list`, `whop audiences list`, `whop social-accounts list` (a connected Facebook page is required); create with `whop ad-campaigns create --objective sales|leads|traffic|awareness|engagement --platform meta --budget_amount N --budget_type daily`, `whop ad-groups create --ad_campaign_id … --title … --optimization_goal …`, `whop ads create --ad_group_id … --headlines … --descriptions … --call_to_action … --creatives '[{\"id\":\"file_…\"}]'`, `whop ad-groups estimate_reach`, `whop ad-groups targeting_options --query …`. \
AI MEDIA: `whop media generate --type image|video --prompt \"…\" [--duration_seconds 5|10|15] [--resolution 720p|1080p|4k] --wait true` (billed from the balance; returns {id,status,file{id,url}}; poll `whop media get <id>` while processing); uploads via `whop files`. \
BOUNTIES (pay creators for clips/UGC/growth): `whop bounties list [--status open|closed|completed]`, `whop bounties create --title … --description … --gross_reward_amount N --business_goal_type clipping|post_engagement|owned_account_growth|ugc_content|local_activation|data_capture|other --frequency once|weekly`, `whop bounties submissions <id>`. PARTNERS (user-scoped, no --account_id): `whop partners list`, `whop partners earnings <coma_id>`, `whop partners leaderboard`, `whop partners referred_users`. \
APPS/BLUEPRINTS: `whop apps list`, `whop apps init --template app_xxx --name … --route … --app_type website|b2c_app` (clone a blueprint from whop.com/blueprints), `whop apps deploy [--preview]`, `whop apps builds list --app_id …`, `whop app-builds promote <id>`, `whop apps logs --app_id …`, `whop apps secrets`. \
Lists return {data:[…],page_info}; errors return {code,message}. Prefer `--filter-output a,b.c` and `--token-limit` to keep output small. `whop auth *` and `whop accounts *` take no --account_id."
    };
    format!(
        "You are the assistant inside Whop Desktop, a Mac app for running a Whop business, currently {biz}. \
{demo}\
You operate the business ONLY through the `whop` CLI via the Bash tool. Always add `--format json`. {acct_flag}\
{reference} \
Do not use any other tools, do not read or write files, do not pipe secrets, do not pipe through head/tail (the app truncates for you). \
{writes} \
Style: answer like a sharp operator, in short plain sentences; format money like $1,234.50; lead with the answer, then the evidence; suggest one next step when useful. Do not narrate tool calls; the app shows them."
    )
}

#[tauri::command]
pub fn assistant_start(app: AppHandle, state: State<'_, AssistantState>, args: StartArgs) -> Result<(), String> {
    let claude = claude_binary().ok_or_else(|| {
        "Claude Code CLI not found. Install it from https://claude.com/claude-code (or `npm i -g @anthropic-ai/claude-code`), run `claude` once to sign in, then try again.".to_string()
    })?;
    let shim_dir = ensure_shim_dir(&app)?;
    let real_whop = crate::whop_binary_path_pub().unwrap_or_else(|| "whop".into());
    let path = format!(
        "{}:{}",
        shim_dir.display(),
        std::env::var("PATH").unwrap_or_default()
    );
    let home = std::env::var("HOME").unwrap_or_default();
    let extra_path = format!("{path}:{home}/.local/bin:/opt/homebrew/bin:/usr/local/bin");

    let mut cmd = Command::new(&claude);
    cmd.arg("-p")
        .arg(&args.prompt)
        .arg("--output-format")
        .arg("stream-json")
        .arg("--verbose")
        .arg("--include-partial-messages")
        .arg("--allowedTools")
        .arg("Bash(whop:*)")
        .arg("--disallowedTools")
        .arg("Read")
        .arg("Edit")
        .arg("Write")
        .arg("Glob")
        .arg("Grep")
        .arg("WebFetch")
        .arg("WebSearch")
        .arg("Task")
        .arg("NotebookEdit")
        .arg("--permission-mode")
        .arg("default")
        .arg("--max-turns")
        .arg("30")
        .arg("--append-system-prompt")
        .arg(system_prompt(&args));
    if let Some(m) = &args.model {
        cmd.arg("--model").arg(m);
    } else {
        cmd.arg("--model").arg("sonnet");
    }
    if let Some(sid) = &args.session_id {
        cmd.arg("--resume").arg(sid);
    }
    cmd.current_dir(config_dir(&app));
    cmd.env("PATH", extra_path)
        .env(SHIM_ENV, "1")
        .env(REAL_WHOP_ENV, &real_whop)
        .env("NO_COLOR", "1")
        .env_remove("CLAUDECODE")
        .env_remove("CLAUDE_CODE_ENTRYPOINT")
        .env_remove("WHOP_DESKTOP_ACCOUNT")
        .env_remove("WHOP_DESKTOP_VIEW");
    if args.allow_writes {
        cmd.env(ALLOW_WRITES_ENV, "1");
    } else {
        cmd.env_remove(ALLOW_WRITES_ENV);
    }
    if args.demo {
        cmd.env(DEMO_FILE_ENV, config_dir(&app).join("demo.json"));
    } else {
        cmd.env_remove(DEMO_FILE_ENV);
    }
    cmd.stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("failed to start claude: {e}"))?;
    let stdout = child.stdout.take().ok_or("no stdout")?;
    let stderr = child.stderr.take().ok_or("no stderr")?;
    let run_id = args.run_id.clone();
    state.runs.lock().map_err(|_| "state poisoned")?.insert(run_id.clone(), child);

    // stderr collector
    let err_handle = std::thread::spawn(move || {
        let mut buf = String::new();
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            buf.push_str(&line);
            buf.push('\n');
            if buf.len() > 20_000 {
                break;
            }
        }
        buf
    });

    let app2 = app.clone();
    let rid = run_id.clone();
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if line.trim().is_empty() {
                continue;
            }
            let _ = app2.emit("assistant:line", LineEvent { run_id: rid.clone(), line });
        }
        let stderr = err_handle.join().unwrap_or_default();
        let code = {
            let st = app2.state::<AssistantState>();
            let child = st.runs.lock().ok().and_then(|mut m| m.remove(&rid));
            match child {
                Some(mut c) => c.wait().ok().and_then(|s| s.code()).unwrap_or(-1),
                None => -1,
            }
        };
        let _ = app2.emit("assistant:done", DoneEvent { run_id: rid, code, stderr });
    });
    Ok(())
}

#[tauri::command]
pub fn assistant_stop(state: State<'_, AssistantState>, run_id: String) -> Result<(), String> {
    if let Ok(mut m) = state.runs.lock() {
        if let Some(mut c) = m.remove(&run_id) {
            let _ = c.kill();
        }
    }
    Ok(())
}

#[tauri::command]
pub fn claude_binary_path() -> Option<String> {
    claude_binary().map(|p| p.to_string_lossy().into_owned())
}

/// Frontend writes the demo dataset here so the shim can answer Claude in demo mode.
#[tauri::command]
pub fn write_demo_fixtures(app: AppHandle, json: String) -> Result<(), String> {
    let dir = config_dir(&app);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    fs::write(dir.join("demo.json"), json).map_err(|e| e.to_string())
}
