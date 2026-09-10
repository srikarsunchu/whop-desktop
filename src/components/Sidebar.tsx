import { Avatar, DropdownMenu, Kbd, Text } from "frosted-ui";
import {
  BarChartIcon,
  CheckIcon,
  ChevronDownIcon,
  CodeIcon,
  CubeIcon,
  EyeOpenIcon,
  GearIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  OpenInNewWindowIcon,
  PersonIcon,
  RocketIcon,
} from "@radix-ui/react-icons";
import { invoke } from "@tauri-apps/api/core";
import { useAccount } from "../lib/whop";

export type ViewId = "overview" | "money" | "members" | "products" | "people" | "apps" | "terminal" | "account";

export const NAV: { id: ViewId; label: string; icon: React.ComponentType<{ className?: string }>; hint?: string }[] = [
  { id: "overview", label: "Overview", icon: HomeIcon },
  { id: "money", label: "Money", icon: BarChartIcon },
  { id: "members", label: "Members", icon: PersonIcon },
  { id: "products", label: "Products", icon: CubeIcon },
  { id: "people", label: "People", icon: EyeOpenIcon },
  { id: "apps", label: "Apps", icon: RocketIcon },
  { id: "terminal", label: "Terminal", icon: CodeIcon },
  { id: "account", label: "Account", icon: GearIcon },
];

export function Sidebar({ view, onNavigate, onOpenPalette }: { view: ViewId; onNavigate: (v: ViewId) => void; onOpenPalette: () => void }) {
  const { account, accounts, setAccount, cliVersion, loggedIn, profile, cliPath } = useAccount();
  const initial = (account?.title ?? "W").trim().charAt(0).toUpperCase();
  const version = cliVersion?.replace(/^whop\s*/i, "") ?? null;

  return (
    <aside className="sidebar">
      <div className="sidebar-drag" data-tauri-drag-region />

      <div className="sidebar-switcher">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <button className="sidebar-switcher-button" type="button" aria-label="Switch business">
              <Avatar size="2" shape="square" color={account?.demo ? "gray" : "orange"} fallback={initial} />
              <span className="sidebar-switcher-text">
                <Text size="2" weight="medium">
                  {account?.title ?? "Choose a business"}
                </Text>
                <Text size="1" color="gray">
                  {account?.demo ? "Demo data" : account?.id ?? (loggedIn === false ? "Not signed in" : "Loading…")}
                </Text>
              </span>
              <ChevronDownIcon />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content size="1" style={{ minWidth: 216 }}>
            <DropdownMenu.Group>
              <DropdownMenu.GroupLabel>Businesses</DropdownMenu.GroupLabel>
              {accounts
                .filter((a) => !a.demo)
                .map((a) => (
                  <DropdownMenu.Item key={a.id} onClick={() => setAccount(a)}>
                    <Avatar size="1" shape="square" color="orange" fallback={a.title.charAt(0).toUpperCase()} />
                    <span style={{ flex: 1 }}>{a.title}</span>
                    {account?.id === a.id && <CheckIcon />}
                  </DropdownMenu.Item>
                ))}
              {accounts.filter((a) => !a.demo).length === 0 && <DropdownMenu.Item disabled>No businesses. Run whop login.</DropdownMenu.Item>}
            </DropdownMenu.Group>
            <DropdownMenu.Separator />
            <DropdownMenu.Group>
              <DropdownMenu.GroupLabel>Demo</DropdownMenu.GroupLabel>
              {accounts
                .filter((a) => a.demo)
                .map((a) => (
                  <DropdownMenu.Item key={a.id} onClick={() => setAccount(a)}>
                    <Avatar size="1" shape="square" color="gray" fallback={a.title.charAt(0)} />
                    <span style={{ flex: 1 }}>{a.title}</span>
                    {account?.id === a.id && <CheckIcon />}
                  </DropdownMenu.Item>
                ))}
            </DropdownMenu.Group>
            <DropdownMenu.Separator />
            <DropdownMenu.Item onClick={() => invoke("open_web_window")}>
              <OpenInNewWindowIcon />
              <span style={{ flex: 1 }}>Open whop.com</span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>

      <nav className="sidebar-nav" aria-label="Sections">
        <button className="nav-item" type="button" onClick={onOpenPalette}>
          <MagnifyingGlassIcon />
          Search &amp; run
          <span className="nav-kbd">
            <Kbd size="1">⌘K</Kbd>
          </span>
        </button>
        {NAV.map(({ id, label, icon: Icon }) => (
          <button key={id} className="nav-item" type="button" data-active={view === id} onClick={() => onNavigate(id)}>
            <Icon />
            {label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <Text size="1" color="gray">
          <span className="live-dot" data-off={loggedIn !== true} />
          {loggedIn === true ? `Signed in as ${profile ?? "you"}` : loggedIn === false ? "Whop CLI not signed in" : "Checking Whop CLI…"}
        </Text>
        <Text size="1" color="gray" className="mono" title={cliPath ?? undefined}>
          {cliPath ? `whop ${version ?? ""}`.trim() : "whop CLI not found"}
        </Text>
      </div>
    </aside>
  );
}
