import { PageMotion } from "./components/Motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { NAV, Sidebar, type ViewId } from "./components/Sidebar";
import { Palette } from "./components/Palette";
import {
  AccountContext,
  runWhopJson,
  runWhopRaw,
  type Account,
} from "./lib/whop";
import { DEMO_ACCOUNT } from "./lib/demo";
import { syncDemoFixtures } from "./lib/assistant";
import { planPrice } from "./lib/format";
import { Overview } from "./views/Overview";
import { Money } from "./views/Money";
import { Members } from "./views/Members";
import { Products } from "./views/Products";
import { People } from "./views/People";
import { Apps } from "./views/Apps";
import { Assistant } from "./views/Assistant";
import { Ads } from "./views/Ads";
import { useStudioJobs } from "./lib/studio-jobs";
import { Welcome } from "./components/Welcome";
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
  useStudioJobs();
  const [welcomeOpen, setWelcomeOpen] = useState(
    () => localStorage.getItem("whopdesktop.welcome.v1") !== "done",
  );
  const [view, setViewState] = useState<ViewId>("assistant");
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
        if (st.account)
          current = {
            id: st.account.id,
            title: st.account.title,
            route: st.account.route,
          };
      } catch {
        setLoggedIn(false);
      }
      let list: Account[] = [];
      try {
        const res = await runWhopJson<{
          data: {
            id: string;
            title: string;
            route?: string;
            logo_url?: string | null;
          }[];
        }>(["accounts", "list"]);
        list = (res.data ?? []).map((a) => ({
          id: a.id,
          title: a.title,
          route: a.route,
          logo: a.logo_url ?? null,
        }));
      } catch {
        /* accounts list needs a logged-in profile */
      }
      if (current && !list.some((a) => a.id === current!.id))
        list.unshift(current);
      const all = [...list, DEMO_ACCOUNT];
      setAccounts(all);
      const remembered = hints.account ?? localStorage.getItem(LS_ACCOUNT);
      const pick =
        all.find((a) => a.id === remembered) ?? current ?? all[0] ?? null;
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
      if (
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        !e.altKey &&
        /^[1-9]$/.test(e.key)
      ) {
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
    () => ({
      account,
      setAccount,
      accounts,
      refreshAccounts,
      cliPath,
      cliVersion,
      loggedIn,
      profile,
    }),
    [
      account,
      setAccount,
      accounts,
      refreshAccounts,
      cliPath,
      cliVersion,
      loggedIn,
      profile,
    ],
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
      page = (
        <Products
          runInTerminal={runInTerminal}
          onStudio={(p) => {
            let saved: any = {};
            try {
              saved = JSON.parse(
                localStorage.getItem(`studio.brief.${account?.id}`) ?? "{}",
              );
            } catch {}
            localStorage.setItem(
              `studio.brief.${account?.id}`,
              JSON.stringify({
                ...saved,
                selectedId: "new",
                context: {
                  ...saved.context,
                  productId: p.id,
                  productTitle: p.title,
                  planId: p.default_plan?.id ?? "",
                  price: planPrice(p.default_plan),
                  destinationUrl: account?.demo
                    ? ""
                    : `https://whop.com/${account?.route ? `${account.route}/` : ""}${p.route}`,
                  concept: `${p.title} launch`,
                },
                prompt: `Introduce ${p.title}. ${p.description ?? ""}`.slice(
                  0,
                  2000,
                ),
              }),
            );
            setView("studio");
          }}
        />
      );
      break;
    case "people":
      page = (
        <People
          runInTerminal={runInTerminal}
          onMember={(username) => {
            sessionStorage.setItem(
              `workspace.${account?.id}.members.tab`,
              JSON.stringify("memberships"),
            );
            sessionStorage.setItem(
              `workspace.${account?.id}.memberships.search`,
              JSON.stringify(username),
            );
            sessionStorage.removeItem(
              `workspace.${account?.id}.members.selected`,
            );
            setView("members");
          }}
        />
      );
      break;
    case "ads":
      page = <Ads runInTerminal={runInTerminal} ask={ask} />;
      break;
    case "studio":
      page = <Studio onOpenAds={() => setView("ads")} />;
      break;
    case "apps":
      page = <Apps runInTerminal={runInTerminal} ask={ask} />;
      break;
    case "growth":
      page = <Growth runInTerminal={runInTerminal} ask={ask} />;
      break;
    case "assistant":
      page = null;
      break;
    case "account":
      page = <AccountView runInTerminal={runInTerminal} />;
      break;
    default:
      page = (
        <Overview
          runInTerminal={runInTerminal}
          onNavigate={setView}
          ask={ask}
        />
      );
  }

  return (
    <AccountContext.Provider value={ctx}>
      <Welcome
        open={welcomeOpen}
        onDemo={() => {
          setAccount(DEMO_ACCOUNT);
          setView("assistant");
          localStorage.setItem("whopdesktop.welcome.v1", "done");
          setWelcomeOpen(false);
        }}
        onConnected={() => {
          const real = accounts.find((a) => !a.demo);
          if (real) {
            setAccount(real);
            setView("assistant");
            localStorage.setItem("whopdesktop.welcome.v1", "done");
            setWelcomeOpen(false);
          }
        }}
      />
      <div className="app">
        <Sidebar
          view={view}
          onNavigate={setView}
          onOpenPalette={() => setPaletteOpen(true)}
        />
        <main
          className={`content${view === "assistant" ? " content-assistant" : ""}`}
        >
          <div className="content-drag" />
          {account && (
            <div
              className="page assistant-host"
              key={account.id}
              hidden={view !== "assistant"}
            >
              <Assistant
                seed={terminalSeed}
                onSeedConsumed={() => setTerminalSeed(null)}
                chatSeed={chatSeed}
                onChatSeedConsumed={() => setChatSeed(null)}
                onNavigate={setView}
              />
            </div>
          )}
          {view !== "assistant" && (
            <PageMotion key={view + (account?.id ?? "")}>
              {page}
            </PageMotion>
          )}
        </main>
        <Palette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          onNavigate={setView}
          onRun={runInTerminal}
        />
      </div>
    </AccountContext.Provider>
  );
}
