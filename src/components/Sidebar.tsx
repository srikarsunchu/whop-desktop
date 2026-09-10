import { DropdownMenu, Kbd, Text } from "frosted-ui";
import { BizAvatar } from "./BizAvatar";
import {
  BarChartIcon,
  CheckIcon,
  ChevronDownIcon,
  ChatBubbleIcon,
  ImageIcon,
  MagicWandIcon,
  StarIcon,
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

export type ViewId = "overview" | "money" | "members" | "products" | "people" | "ads" | "studio" | "apps" | "growth" | "assistant" | "account";

export const NAV: { id: ViewId; label: string; icon: React.ComponentType<{ className?: string }>; hint?: string }[] = [
  { id: "overview", label: "Overview", icon: HomeIcon },
  { id: "money", label: "Money", icon: BarChartIcon },
  { id: "members", label: "Members", icon: PersonIcon },
  { id: "products", label: "Products", icon: CubeIcon },
  { id: "people", label: "People", icon: EyeOpenIcon },
  { id: "ads", label: "Ads", icon: MagicWandIcon },
  { id: "studio", label: "Studio", icon: ImageIcon },
  { id: "apps", label: "Apps", icon: RocketIcon },
  { id: "growth", label: "Growth", icon: StarIcon },
  { id: "assistant", label: "Assistant", icon: ChatBubbleIcon },
  { id: "account", label: "Account", icon: GearIcon },
];

export function Sidebar({ view, onNavigate, onOpenPalette }: { view: ViewId; onNavigate: (v: ViewId) => void; onOpenPalette: () => void }) {
  const { account, accounts, setAccount, cliVersion, loggedIn, cliPath } = useAccount();
  const version = cliVersion?.replace(/^whop\s*/i, "") ?? null;

  return (
    <aside className="sidebar">
      <div className="sidebar-drag" data-tauri-drag-region />

      <div className="sidebar-switcher">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <button className="sidebar-switcher-button" type="button" aria-label="Switch business">
              <BizAvatar account={account} size="2" />
              <span className="sidebar-switcher-text">
                <Text size="2" weight="medium">
                  {account?.title ?? "Choose a business"}
                </Text>
                <Text size="1" color="gray">
                  {account?.demo ? "Demo data" : (account ? "Business workspace" : loggedIn === false ? "Not signed in" : "Loading…")}
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
                    <BizAvatar account={a} size="1" />
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
                    <BizAvatar account={a} size="1" />
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
        <button className="nav-item nav-assistant" type="button" data-active={view === "assistant"} aria-current={view === "assistant" ? "page" : undefined} onClick={() => onNavigate("assistant")}>
          <ChatBubbleIcon />Assistant<span className="nav-assistant-label">Claude</span>
        </button>
        {[
          { label: "Business", ids: ["overview", "money", "members", "products", "people"] },
          { label: "Grow", ids: ["ads", "studio", "growth"] },
          { label: "Build", ids: ["apps"] },
        ].map((group) => <div className="nav-group" key={group.label}>
          <Text size="1" color="gray" className="sidebar-section">{group.label}</Text>
          {group.ids.map((id) => {
            const item = NAV.find((n) => n.id === id)!;
            const Icon = item.icon;
            const shortcut = NAV.indexOf(item) + 1;
            return <button key={id} className="nav-item" type="button" data-active={view === id} aria-current={view === id ? "page" : undefined} onClick={() => onNavigate(item.id)} title={`${item.label}${shortcut <= 9 ? ` ⌘${shortcut}` : ""}`}><Icon />{item.label}</button>;
          })}
        </div>)}
      </nav>

      <div className="sidebar-footer">
        <button className="nav-item" type="button" data-active={view === "account"} aria-current={view === "account" ? "page" : undefined} onClick={() => onNavigate("account")}><GearIcon />Account</button>
        <Text size="1" color="gray" className="connection-status" title={cliPath ? `whop ${version ?? ""} · ${cliPath}` : undefined}>
          <span className="live-dot" data-off={!account?.demo && loggedIn !== true} />
          {account?.demo ? "Demo workspace" : loggedIn === true ? "Whop CLI connected" : loggedIn === false ? "CLI not connected" : "Connecting…"}
        </Text>
      </div>
    </aside>
  );
}
