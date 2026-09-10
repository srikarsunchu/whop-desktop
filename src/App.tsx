import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { NAV, Sidebar, type ViewId } from "./components/Sidebar";
import { Palette } from "./components/Palette";
import { AccountContext, runWhopJson, runWhopRaw, type Account } from "./lib/whop";
import { DEMO_ACCOUNT } from "./lib/demo";
import { syncDemoFixtures } from "./lib/assistant";
import { Overview } from "./views/Overview";
import { Money } from "./views/Money";
import { Members } from "./views/Members";
import { Products } from "./views/Products";
import { People } from "./views/People";
import { Apps } from "./views/Apps";
import { Assistant } from "./views/Assistant";
import { Ads } from "./views/Ads";
import { Studio } from "./views/Studio";
import { Growth } from "./views/Growth";
import { AccountView } from "./views/Account";

interface AuthStatus {
  loggedIn: boolean;
  profile?: string;
  account?: { id: string; title: string; route?: string } | null;
}

const LS_VIEW = "whopdesktop.view";
const LS_ACCOUNT = "whopdesktop.account";

export function App() {
  const [view, setViewState] = useState<ViewId>(() => {
    const v = localStorage.getItem(LS_VIEW) as string | null;
    return (v === "terminal" ? "assistant" : (v as ViewId)) || "overview";
  });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [terminalSeed, setTerminalSeed] = useState<string | null>(null);
  const [chatSeed, setChatSeed] = useState<string | null>(null);

  const [account, setAccountState] = useState<Account | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cliPath, setCliPath] = useState<string | null>(null);
  const [cliVersion, setCliVersion] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<string | null>(null);

  const setView = useCallback((v: ViewId) => {
    setViewState(v);
    localStorage.setItem(LS_VIEW, v);
  }, []);

  const setAccount = useCallback((a: Account) => {
    setAccountState(a);
    localStorage.setItem(LS_ACCOUNT, a.id);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const refreshAccounts = useCallback(() => {
    (async () => {
      let hints: { account?: string | null; view?: string | null } = {};
      try {
        hints = await invoke("launch_hints");
        if (hints.view) setView(hints.view as ViewId);
      } catch {
        /* not in tauri */
      }
      try {
        const path = await invoke<string | null>("whop_binary_path");
        setCliPath(path);
      } catch {
        setCliPath(null);
      }
      try {
        const v = await runWhopRaw(["--version"]);
        setCliVersion(v.stdout.trim().split("\n")[0] || null);
      } catch {
        setCliVersion(null);
      }
      let current: Account | null = null;
      try {
        const st = await runWhopJson<AuthStatus>(["auth", "status"]);
        setLoggedIn(!!st.loggedIn);
        setProfile(st.profile ?? null);
        if (st.account) current = { id: st.account.id, title: st.account.title, route: st.account.route };
      } catch {
        setLoggedIn(false);
      }
      let list: Account[] = [];
      try {
        const res = await runWhopJson<{ data: { id: string; title: string; route?: string; logo_url?: string | null }[] }>(["accounts", "list"]);
        list = (res.data ?? []).map((a) => ({ id: a.id, title: a.title, route: a.route, logo: a.logo_url ?? null }));
      } catch {
        /* accounts list needs a logged-in profile */
      }
      if (current && !list.some((a) => a.id === current!.id)) list.unshift(current);
      const all = [...list, DEMO_ACCOUNT];
      setAccounts(all);
      const remembered = hints.account ?? localStorage.getItem(LS_ACCOUNT);
      const pick = all.find((a) => a.id === remembered) ?? current ?? all[0] ?? null;
      setAccountState(pick);
    })();
  }, [setView]);

  useEffect(() => {
    refreshAccounts();
  }, [refreshAccounts]);

  // Keep the shim's demo fixtures current whenever the demo business is active.
  useEffect(() => {
    if (account?.demo) syncDemoFixtures();
  }, [account?.demo]);

  // ⌘K from the native menu, and from the keyboard.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const un = listen("palette", () => setPaletteOpen(true));
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      // ⌘1…⌘8 jump between views.
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && /^[1-9]$/.test(e.key)) {
        const target = NAV[Number(e.key) - 1];
        if (target) {
          e.preventDefault();
          setView(target.id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      un.then((f) => f()).catch(() => {});
    };
  }, [setView]);

  const runInTerminal = useCallback(
    (command: string) => {
      setTerminalSeed(command);
      setView("assistant");
    },
    [setView],
  );

  const ask = useCallback(
    (prompt: string) => {
      setChatSeed(prompt);
      setView("assistant");
    },
    [setView],
  );

  const ctx = useMemo(
    () => ({ account, setAccount, accounts, refreshAccounts, cliPath, cliVersion, loggedIn, profile }),
    [account, setAccount, accounts, refreshAccounts, cliPath, cliVersion, loggedIn, profile],
  );

  let page: React.ReactNode;
  switch (view) {
    case "money":
      page = <Money runInTerminal={runInTerminal} />;
      break;
    case "members":
      page = <Members runInTerminal={runInTerminal} />;
      break;
    case "products":
      page = <Products runInTerminal={runInTerminal} />;
      break;
    case "people":
      page = <People runInTerminal={runInTerminal} />;
      break;
    case "ads":
      page = <Ads runInTerminal={runInTerminal} ask={ask} />;
      break;
    case "studio":
      page = <Studio runInTerminal={runInTerminal} ask={ask} />;
      break;
    case "apps":
      page = <Apps runInTerminal={runInTerminal} ask={ask} />;
      break;
    case "growth":
      page = <Growth runInTerminal={runInTerminal} ask={ask} />;
      break;
    case "assistant":
      page = <Assistant seed={terminalSeed} onSeedConsumed={() => setTerminalSeed(null)} chatSeed={chatSeed} onChatSeedConsumed={() => setChatSeed(null)} />;
      break;
    case "account":
      page = <AccountView runInTerminal={runInTerminal} />;
      break;
    default:
      page = <Overview runInTerminal={runInTerminal} onNavigate={setView} />;
  }

  return (
    <AccountContext.Provider value={ctx}>
      <div className="app">
        <Sidebar view={view} onNavigate={setView} onOpenPalette={() => setPaletteOpen(true)} />
        <main className="content">
          <div className="content-drag" />
          <div className="page" key={view + (account?.id ?? "")}>
            {page}
          </div>
        </main>
        <Palette open={paletteOpen} onOpenChange={setPaletteOpen} onNavigate={setView} onRun={runInTerminal} />
      </div>
    </AccountContext.Provider>
  );
}
