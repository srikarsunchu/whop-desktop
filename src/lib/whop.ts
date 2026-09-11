// Data layer: every screen is a `whop …` command. The frontend never sees a
// token; it asks the Rust side to run the CLI and hands back JSON.
import { invoke } from "@tauri-apps/api/core";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { demoResolve, DEMO_ACCOUNT_ID } from "./demo";

export interface RawOutput {
  stdout: string;
  stderr: string;
  code: number;
}

export interface WhopError {
  code: string;
  message: string;
}

export interface Account {
  id: string;
  title: string;
  demo?: boolean;
  route?: string;
  logo?: string | null;
}

export const commandString = (args: string[]) =>
  "whop " + args.map((a) => (/[\s"]/.test(a) ? JSON.stringify(a) : a)).join(" ");

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function runWhopRaw(args: string[]): Promise<RawOutput> {
  if (args[0] === "--demo") {
    const data = demoResolve(args.slice(1));
    return { stdout: JSON.stringify(data, null, 2), stderr: "", code: 0 };
  }
  if (!isTauri()) return { stdout: "", stderr: "Not running inside Whop Desktop", code: 1 };
  return invoke<RawOutput>("whop_raw", { args });
}

/** Runs the CLI with `--format json`. Throws `WhopError` on CLI error envelopes. */
export async function runWhopJson<T = unknown>(args: string[], demo = false): Promise<T> {
  if (demo) return demoResolve(args) as T;
  if (!isTauri()) throw { code: "NOT_TAURI", message: "Not running inside Whop Desktop" } satisfies WhopError;
  let out: unknown;
  try {
    out = await invoke("whop_json", { args });
  } catch (e) {
    throw { code: "CLI", message: String(e) } satisfies WhopError;
  }
  if (out && typeof out === "object" && "code" in out && "message" in out && !("data" in out)) {
    const err = out as WhopError;
    throw { code: String(err.code), message: String(err.message) } satisfies WhopError;
  }
  return out as T;
}

// ---------------------------------------------------------------------------
// Account context
// ---------------------------------------------------------------------------

export interface AccountState {
  account: Account | null;
  setAccount: (a: Account) => void;
  accounts: Account[];
  refreshAccounts: () => Promise<void>;
  cliPath: string | null;
  cliVersion: string | null;
  loggedIn: boolean | null;
  profile: string | null;
}

export const AccountContext = createContext<AccountState>({
  account: null,
  setAccount: () => {},
  accounts: [],
  refreshAccounts: async () => {},
  cliPath: null,
  cliVersion: null,
  loggedIn: null,
  profile: null,
});

export const useAccount = () => useContext(AccountContext);

/** Appends `--account_id` for the selected business (demo accounts skip it). */
export function withAccount(args: string[], account: Account | null): string[] {
  if (!account || account.demo) return args;
  if (args.includes("--account_id")) return args;
  // User-scoped commands take no account.
  if (args[0] === "auth" || args[0] === "upgrade" || args[0] === "accounts" || args[0] === "partners" || args[0] === "files" || args[0] === "--version") return args;
  if (args[0] === "apps" && args[1] !== "list") return args;
  if (args[0] === "payouts" && args[1] === "get") return [...args, "--account_id", account.id];
  if (args[0] === "events" && args[1] === "pulse") return args;
  // Record operations identify their owner by ID; only collection operations accept account_id.
  if (["products", "plans", "memberships", "members", "people", "payouts", "bounties", "team-members", "disputes", "events"].includes(args[0]) && ["get", "update", "delete", "publish", "unpublish", "pause", "resume", "cancel", "invite", "submissions", "get-submission"].includes(args[1])) return args;
  return [...args, "--account_id", account.id];
}

// ---------------------------------------------------------------------------
// useWhop: cached, refreshable command execution
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: unknown;
  at: number;
}
let dataRevision = 0;
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

export interface UseWhopResult<T> {
  data: T | undefined;
  error: WhopError | null;
  loading: boolean;
  refresh: () => void;
  command: string;
  updatedAt: number | null;
}

export function useWhop<T = unknown>(
  args: string[] | null,
  opts: { ttl?: number; enabled?: boolean } = {},
): UseWhopResult<T> {
  const { account } = useAccount();
  const demo = !!account?.demo;
  const full = args ? withAccount(args, account) : null;
  const key = full ? (demo ? `demo:${DEMO_ACCOUNT_ID}:` : "") + full.join("\u0000") : null;
  const ttl = opts.ttl ?? 30_000;
  const enabled = opts.enabled ?? true;

  const [tick, setTick] = useState(0);
  const [state, setState] = useState<{ data: T | undefined; error: WhopError | null; loading: boolean; at: number | null }>(() => {
    const hit = key ? cache.get(key) : undefined;
    return { data: hit?.data as T | undefined, error: null, loading: !hit && !!key && enabled, at: hit?.at ?? null };
  });
  const keyRef = useRef(key);

  useEffect(() => {
    keyRef.current = key;
    if (!key || !full || !enabled) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    const hit = cache.get(key);
    const fresh = hit && Date.now() - hit.at < ttl && tick === 0;
    if (hit) setState({ data: hit.data as T, error: null, loading: !fresh, at: hit.at });
    else setState({ data: undefined, error: null, loading: true, at: null });
    if (fresh) return;

    const revision = dataRevision;
    let p = inflight.get(key);
    if (!p) {
      p = runWhopJson<T>(full, demo).finally(() => { if (inflight.get(key) === p) inflight.delete(key); });
      inflight.set(key, p);
    }
    let cancelled = false;
    p.then(
      (data) => {
        const at = Date.now();
        if (revision !== dataRevision) return;
        cache.set(key, { data, at });
        if (!cancelled && keyRef.current === key) setState({ data: data as T, error: null, loading: false, at });
      },
      (err: WhopError) => {
        if (!cancelled && keyRef.current === key)
          setState((s) => ({ ...s, error: err ?? { code: "ERR", message: "Unknown error" }, loading: false }));
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick, enabled]);

  useEffect(() => {
    const changed = () => setTick(t => t + 1);
    window.addEventListener("whop:data-changed", changed);
    return () => window.removeEventListener("whop:data-changed", changed);
  }, []);

  const refresh = useCallback(() => {
    if (key) cache.delete(key);
    setTick((t) => t + 1);
  }, [key]);

  return {
    data: state.data,
    error: state.error,
    loading: state.loading,
    refresh,
    command: full ? commandString(full) : "",
    updatedAt: state.at,
  };
}

/** Drops every cached result (after a write action). */
export function invalidateAll() {
  dataRevision++;
  cache.clear();
  inflight.clear();
  if (typeof window !== "undefined") window.dispatchEvent(new Event("whop:data-changed"));
}

// ---------------------------------------------------------------------------
// Shapes of the CLI responses we rely on
// ---------------------------------------------------------------------------

export interface Page<T> {
  data: T[];
  page_info?: { has_next_page: boolean; end_cursor: string | null };
}

export interface Money {
  currency: string;
  amount: string;
  decimals?: number;
}

export interface StatsSeries {
  data: { points: { timestamp: number; value: number }[]; currency: string };
}

export interface Member {
  id: string;
  status: string;
  access_level: string;
  joined_at: string;
  last_accessed_at: string | null;
  user: { id: string; username: string; name: string | null; profile_picture?: { url: string } | null } | null;
}

export interface Membership {
  id: string;
  status: string;
  created_at: string;
  renewal_period_end?: string | null;
  cancel_at_period_end?: boolean;
  product?: { id: string; title: string } | null;
  plan?: { id: string; title: string | null; plan_type: string; renewal_price?: Money; initial_price?: Money } | null;
  user?: { id: string; username: string; name: string | null } | null;
  member?: { id: string } | null;
}

export interface Product {
  id: string;
  title: string;
  visibility: string;
  route: string;
  member_count: number;
  created_at: string;
  default_plan?: {
    id: string;
    plan_type: string;
    billing_period?: number | null;
    initial_price?: Money;
    renewal_price?: Money;
  } | null;
}

export interface Person {
  id: string;
  name: string | null;
  email: string | null;
  event_count: number;
  purchase_count: number;
  ltv: number;
  first_seen_at: string;
  last_seen_at: string;
  location?: { country: string | null; city: string | null } | null;
  device?: { browser: string | null; os: string | null; device: string | null } | null;
  user?: { username?: string } | null;
}

export interface Payout {
  id: string;
  status: string;
  amount?: Money;
  created_at: string;
  arrival_date?: string | null;
  method?: string | null;
  destination?: string | null;
}

export interface LedgerEntry {
  id: string;
  type?: string;
  description?: string | null;
  amount?: Money;
  created_at: string;
  balance_after?: Money;
}

export interface BalanceReport {
  report_type: string;
  rows: { label?: string; category?: string; currency?: string; amount?: string | number; balance?: string | number }[];
  total: number;
}

export interface AppRecord {
  id: string;
  name: string;
  status?: string;
  app_type?: string;
  domain?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RecommendedAction {
  id: string;
  title: string;
  description?: string | null;
  category?: string;
}
