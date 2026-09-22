//! Claude-powered assistant: spawns the local Claude Code CLI in headless mode
//! (`claude -p … --output-format stream-json`) and streams its events to the
//! frontend. Claude is only allowed one tool: `Bash(whop:*)`, and `whop` on its
//! PATH resolves to THIS binary running as a shim (see [`shim_main`]) which
//! serves the demo dataset when the demo business is selected and otherwise
//! hands the command to `wv` (github.com/srikarsunchu/whop-view): reads pass
//! through as whop's own bytes, and a write comes back as a plan with a signed
//! rerun that the person approves in the app. Without `wv` installed the shim
//! falls back to blocking writes unless the user enabled them.

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
/// The `wv` binary the shim hands commands to; set by the app when it found one.
const WV_ENV: &str = "WHOP_DESKTOP_WV";

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
    if args.first().map(String::as_str) == Some("media") && args.get(1).map(String::as_str) == Some("generate") {
        println!("{}", serde_json::json!({"code":"CREATIVE_REVIEW_REQUIRED","message":"Use Create image in the chat composer to review and generate images with saved previews. Use Studio for video. Do not generate through terminal tools."}));
        return 1;
    }

    // The gate: wv answers a read with whop's bytes and a write with a plan and a rerun (exit 2). On the demo
    // business wv's `whop` is this binary again, answering from the fixtures, so the demo shows the same cards.
    if let Ok(wv) = std::env::var(WV_ENV) {
        let mut cmd = Command::new(wv);
        cmd.args(wv_argv(args)).env_remove(WV_ENV).stdin(Stdio::null());
        match (std::env::var(DEMO_FILE_ENV).is_ok(), std::env::current_exe()) {
            (true, Ok(exe)) => {
                cmd.env("WV_WHOP_BIN", exe);
            }
            _ => {
                cmd.env("WV_WHOP_BIN", std::env::var(REAL_WHOP_ENV).unwrap_or_else(|_| "whop".into())).env_remove(SHIM_ENV);
            }
        }
        return match cmd.status() {
            Ok(s) => s.code().unwrap_or(1),
            Err(e) => {
                eprintln!("whop shim: wv: {e}");
                127
            }
        };
    }
    // Demo business without wv: answer from the fixtures file the app wrote.
    if let Ok(file) = std::env::var(DEMO_FILE_ENV) {
        return shim_demo(&file, args);
    }
    if is_write(args) && std::env::var(ALLOW_WRITES_ENV).ok().as_deref() != Some("1") {
        let msg = serde_json::json!({
            "code": "WRITE_BLOCKED",
            "message": format!(
                "Whop Desktop blocked `whop {}` because it changes production data. Ask the user to turn on \"Allow changes\" in Assistant Settings, then run it again once they confirm.",
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

/// The argv wv gets: the command as Claude typed it. A leading `wv`, as a rerun carries it, is dropped.
pub fn wv_argv(args: &[String]) -> &[String] {
    if args.first().map(String::as_str) == Some("wv") { &args[1..] } else { args }
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
    // `<group> get <id>` answers from the group's list, so a write's plan can say what changes.
    if a(1) == "get" && !a(2).is_empty() {
        let row = map.get(&format!("{} list", a(0))).and_then(|v| v.get("data")).and_then(|d| d.as_array()).and_then(|rows| rows.iter().find(|r| r.get("id").and_then(|i| i.as_str()) == Some(a(2).as_str())));
        if let Some(row) = row {
            println!("{}", serde_json::to_string_pretty(&serde_json::json!({"ok": true, "data": row})).unwrap());
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
    /// Set by the app when `wv` is installed: the shim gates writes instead of blocking them.
    #[serde(default)]
    pub gated: bool,
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

/// The seven `whop-*` skills wv ships (`<wv root>/skills/whop-*/SKILL.md` and `references/`), copied into
/// `<config>/.claude/skills` so `--setting-sources project` loads them and nothing else from the person's own
/// Claude setup. Returns the skills directory when at least one skill was copied. Evals are not copied.
fn sync_skills(app: &AppHandle) -> Option<PathBuf> {
    let wv = PathBuf::from(crate::wv_binary_path_pub()?);
    let root = fs::canonicalize(&wv).ok()?.parent()?.parent()?.to_path_buf();
    let src = root.join("skills");
    let dest = config_dir(app).join(".claude").join("skills");
    fs::create_dir_all(&dest).ok()?;
    let mut copied = 0;
    for entry in fs::read_dir(&src).ok()?.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if !name.starts_with("whop-") || !entry.path().join("SKILL.md").is_file() {
            continue;
        }
        let to = dest.join(&name);
        let _ = fs::remove_dir_all(&to);
        if copy_skill(&entry.path(), &to).is_ok() {
            copied += 1;
        }
    }
    dlog(&format!("skills: {copied} from {}", src.display()));
    (copied > 0).then_some(dest)
}

fn copy_skill(from: &std::path::Path, to: &std::path::Path) -> std::io::Result<()> {
    fs::create_dir_all(to)?;
    fs::copy(from.join("SKILL.md"), to.join("SKILL.md"))?;
    let refs = from.join("references");
    if refs.is_dir() {
        fs::create_dir_all(to.join("references"))?;
        for f in fs::read_dir(&refs)?.flatten() {
            if f.path().extension().map(|e| e == "md").unwrap_or(false) {
                fs::copy(f.path(), to.join("references").join(f.file_name()))?;
            }
        }
    }
    Ok(())
}

fn dlog(msg: &str) {
    #[cfg(debug_assertions)]
    eprintln!("[whopdesktop] {msg}");
    #[cfg(not(debug_assertions))]
    let _ = msg;
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
    let writes = if a.gated {
        "WRITES ARE GATED: a write (create/update/delete/cancel/payout/deploy/swap) never runs on the first call. It returns exit 2 with `error.code` CONFIRMATION_REQUIRED, a `plan` (what it commits: account, amount, balance, cap, Whop's limit, before → after; for a recipe its steps and blockers), and a `rerun`. The app shows the plan to the user with an Approve button. Your job: say in one or two sentences what the plan will do and stop; do not run the `rerun` yourself, do not add --yes, do not edit the command. A refusal (WHOP_LIMIT, WV_CAP, INSUFFICIENT_BALANCE, WV_AD_CAP, or any *_BLOCKED, with no `rerun`) is final: report it in Whop's words and do not retry. `--plan` on any write shows the plan and runs nothing. `wv …` commands are allowed and preferred for writes and screens: `wv money --format json` (balances, limits, methods), `wv doctor --format json`, and the recipes `wv money close`, `wv money swap --from usd --to eur --amount N`, `wv store price <plan> --to N`, `wv store publish <prod>`, `wv support refund <pay_id>`. The whop-money, whop-store, whop-support, whop-gtm, whop-dev, whop-setup, and whop-report skills are installed: invoke the one for the job with the Skill tool and follow its playbook; its references are readable with Read. Nothing else on disk is."
    } else if a.allow_writes {
        "Writes are ENABLED: still explain what a write command will do and get an explicit yes in chat before running create/update/delete/cancel/payout/deploy commands."
    } else {
        "Writes are DISABLED: if a command returns WRITE_BLOCKED, tell the user to turn on \"Allow changes\" in Assistant Settings and confirm, then retry. Never try to work around the block."
    };
    let reference = if a.demo {
        "DEMO COMMAND SET (only these return data; do not explore with --schema/--help/stats list): \
`whop products list` (data[]: id,title,route,visibility,member_count,default_plan{plan_type,billing_period,initial_price{amount},renewal_price{amount}}); \
`whop memberships list [--status active|trialing|past_due|canceling|paused|canceled|expired]` (data[]: id,status,created_at,renewal_period_end,product{title},plan{plan_type,renewal_price,initial_price},user{username,name}); \
`whop members list`; `whop people list` (visitors: location,device,event_count,purchase_count,ltv,last_seen_at); `whop payouts list`; `whop disputes list`; `whop apps list`; `whop economic-intelligence list` (Whop's own next-step recommendations; an HTTP_403 saying the account does not have access yet means it has not been turned on); \
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
Style: answer like a sharp operator, in short plain sentences; format money like $1,234.50; lead with the answer, then the evidence; suggest one next step when useful. Do not narrate or announce tool calls, run them; the app shows them."
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

    let gated = args.gated && crate::wv_binary_path_pub().is_some();
    // With the gate on, wv's skills ride along: Skill invokes one, Read is allowed on that folder and nowhere else.
    let skills = if gated { sync_skills(&app) } else { None };
    let mut cmd = Command::new(&claude);
    cmd.arg("-p")
        .arg(&args.prompt)
        .arg("--output-format")
        .arg("stream-json")
        .arg("--verbose")
        .arg("--include-partial-messages")
        // Only these built-in tools exist in this run: no Edit/Write/Web*/Task to be offered and refused.
        .arg("--tools")
        .arg(if skills.is_some() { "Bash,Skill,Read" } else { "Bash" })
        .arg("--allowedTools")
        .arg("Bash(whop:*)")
        // With the gate on, `wv …` is allowed too: every write through it comes back as a plan. Its `whop` is
        // the real binary, so it never re-enters the shim.
        .args(if gated { vec!["Bash(wv:*)"] } else { vec![] })
        .args(skills.iter().flat_map(|d| ["Skill".to_string(), format!("Read({}/**)", d.display())]))
        // `--tools` only trims the built-in set: the person's own MCP servers and settings-installed plugins
        // still load without these two, and a `whop` or `wv` MCP tool offered to the model is refused by the
        // allowlist and stalls the run instead of typing the command.
        .arg("--strict-mcp-config")
        .arg("--setting-sources")
        .arg("project")
        .arg("--permission-mode")
        .arg("default")
        .arg("--max-turns")
        .arg(if skills.is_some() { "60" } else { "30" })
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
    match (args.gated, crate::wv_binary_path_pub()) {
        (true, Some(wv)) => {
            cmd.env(WV_ENV, wv).env("WV_WHOP_BIN", &real_whop);
        }
        _ => {
            cmd.env_remove(WV_ENV).env_remove("WV_WHOP_BIN");
        }
    }
    if args.demo {
        cmd.env(DEMO_FILE_ENV, config_dir(&app).join("demo.json"));
    } else {
        cmd.env_remove(DEMO_FILE_ENV);
    }
    cmd.stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    #[cfg(debug_assertions)]
    eprintln!("[whopdesktop] assistant: gated={gated} demo={} resume={} argv={:?}", args.demo, args.session_id.is_some(), cmd.get_args().map(|a| a.to_string_lossy().chars().take(60).collect::<String>()).collect::<Vec<_>>());

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
        #[cfg(debug_assertions)]
        eprintln!("[whopdesktop] assistant done: code={code} stderr={}", stderr.chars().take(400).collect::<String>().replace('\n', " | "));
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

#[tauri::command]
pub async fn claude_auth_status() -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let cli = claude_binary().ok_or("Claude is not installed")?;
        let output = Command::new(cli).args(["auth", "status"]).env_remove("CLAUDECODE")
            .stdin(Stdio::null()).output().map_err(|e| e.to_string())?;
        let value: serde_json::Value = serde_json::from_slice(&output.stdout)
            .map_err(|_| "Could not check the Claude connection. Try again.".to_string())?;
        value.get("loggedIn").and_then(|v| v.as_bool()).ok_or("Claude did not return a connection status.".to_string())
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn claude_login() -> Result<(), String> {
    use std::sync::atomic::{AtomicBool, Ordering};
    static SIGNING_IN: AtomicBool = AtomicBool::new(false);
    if SIGNING_IN.swap(true, Ordering::SeqCst) { return Err("A Claude sign-in is already in progress.".into()); }
    let result = tauri::async_runtime::spawn_blocking(|| {
        let cli = claude_binary().ok_or("Claude is not installed")?;
        let mut child = Command::new(cli).args(["auth", "login", "--claudeai"])
            .env_remove("CLAUDECODE").env_remove("CLAUDE_CODE_ENTRYPOINT")
            .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null())
            .spawn().map_err(|e| e.to_string())?;
        let started = std::time::Instant::now();
        loop {
            match child.try_wait() {
                Ok(Some(status)) => return if status.success() {Ok(())} else {Err("Claude sign-in did not finish. Try again, or run claude auth login in your terminal.".into())},
                Ok(None) => {},
                Err(e) => {let _ = child.kill(); let _ = child.wait(); return Err(e.to_string());}
            }
            if started.elapsed().as_secs() > 300 { let _ = child.kill(); let _ = child.wait(); return Err("Sign-in timed out. Try again when you are ready.".into()); }
            std::thread::sleep(std::time::Duration::from_millis(200));
        }
    }).await.map_err(|e| e.to_string()).and_then(|r| r);
    SIGNING_IN.store(false, Ordering::SeqCst);
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wv_gets_the_command_as_typed_and_drops_a_leading_wv() {
        let typed: Vec<String> = ["payouts", "create", "--amount", "5", "--format", "json"].iter().map(|s| s.to_string()).collect();
        assert_eq!(wv_argv(&typed), &typed[..]);
        let rerun: Vec<String> = ["wv", "payouts", "create", "--amount", "5", "--approve", "t"].iter().map(|s| s.to_string()).collect();
        assert_eq!(wv_argv(&rerun), &rerun[1..]);
    }

    #[test]
    fn writes_are_still_recognised_for_the_fallback_block() {
        let w: Vec<String> = ["payouts", "create"].iter().map(|s| s.to_string()).collect();
        let r: Vec<String> = ["payouts", "list"].iter().map(|s| s.to_string()).collect();
        assert!(is_write(&w));
        assert!(!is_write(&r));
    }
}
