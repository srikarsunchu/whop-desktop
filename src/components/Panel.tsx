import { Button, Callout, Card, Code, EmptyState, Heading, Spinner, Text } from "frosted-ui";
import { ExclamationTriangleIcon, LockClosedIcon } from "@radix-ui/react-icons";
import { useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CommandStrip } from "./CommandStrip";
import { ApiKeyDialog } from "./ApiKeyDialog";
import { invalidateAll, useAccount, type UseWhopResult, type WhopError } from "../lib/whop";

/** A Frosted Card with a title row, the command strip, and body. */
export function Panel({
  title,
  query,
  onRun,
  children,
  actions,
  size = "3",
}: {
  title?: ReactNode;
  query?: Pick<UseWhopResult<unknown>, "command" | "updatedAt" | "loading" | "refresh">;
  onRun?: (command: string) => void;
  children: ReactNode;
  actions?: ReactNode;
  size?: "1" | "2" | "3" | "4";
}) {
  return (
    <Card size={size} className="panel">
      {(title || query) && (
        <div className="panel-head">
          {title && <Heading size="3" weight="medium" className="panel-title">{title}</Heading>}
          <div className="panel-head-actions">
            {actions}
            {query && <CommandStrip command={query.command} updatedAt={query.updatedAt} loading={query.loading} onRefresh={query.refresh} onRun={onRun} />}
          </div>
        </div>
      )}
      {children}
    </Card>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <Heading size="6" weight="medium">
          {title}
        </Heading>
        {subtitle && (
          <Text size="2" color="gray" style={{ display: "block", marginTop: 4 }}>
            {subtitle}
          </Text>
        )}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}

export function Loading({ label = "Running whop…" }: { label?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "24px 0" }}>
      <Spinner size="1" />
      <Text size="1" color="gray">
        {label}
      </Text>
    </div>
  );
}

/** Designed empty state: one sentence, one action. */
export function EmptyPanel({ title, description, action, icon }: { title: string; description?: string; action?: { label: string; onClick: () => void }; icon?: ReactNode }) {
  return (
    <div className="empty-wrap">
      <EmptyState.Root>
        <EmptyState.Header>
          {icon && (
            <EmptyState.Media variant="soft" color="gray">
              {icon}
            </EmptyState.Media>
          )}
          <EmptyState.Title>{title}</EmptyState.Title>
          {description && <EmptyState.Description>{description}</EmptyState.Description>}
        </EmptyState.Header>
        {action && (
          <EmptyState.Actions>
            <Button size="1" variant="surface" onClick={action.onClick}>
              {action.label}
            </Button>
          </EmptyState.Actions>
        )}
      </EmptyState.Root>
    </div>
  );
}

type Fix = {
  title: string;
  /** Plain-language explanation shown under the title. */
  note?: string;
  /** A command the Terminal can run (install, etc.). */
  command?: string;
  /** A login the app can perform itself. */
  login?: "oauth" | "api-key";
};

/**
 * Turns a CLI error into the one fix that actually applies. Two facts drive it:
 * the current CLI's OAuth flow already asks for `user:notifications:*`, so a
 * "Missing required permission" on an OAuth login just means the token predates
 * that scope and a fresh sign-in fixes it; and `developer:manage_webhook` is
 * never granted to OAuth tokens, so webhooks need an API-key profile.
 */
export function describeFix(error: WhopError, authMethod: string | null): Fix | null {
  const m = error.message;
  if (/developer:manage_webhook|API-key login/i.test(m)) {
    return {
      title: "Needs an API-key login",
      note: "Whop only authorises webhooks for API keys, not for the browser sign-in. Connect a key for this business to use them.",
      login: "api-key",
    };
  }
  const scope = /Missing required permission: (\S+)/i.exec(m)?.[1];
  if (scope) {
    if (authMethod === "api_key")
      return {
        title: "This API key lacks a permission",
        note: `Grant ${scope} to the key in the Whop dashboard (Developer → API keys), then connect it again.`,
        login: "api-key",
      };
    return {
      title: "Sign in again to add a newer permission",
      note: `This login was created before the CLI asked for ${scope}. Signing in with Whop again grants it; nothing else changes.`,
      login: "oauth",
    };
  }
  if (/not found|ENOENT|Install it/i.test(m)) return { title: "Whop CLI not found", command: "curl -fsSL https://whop.com/install.sh | sh" };
  if (/not logged in|unauthorized|401|expired/i.test(m)) return { title: "Not signed in", login: "oauth" };
  return null;
}

/** Shows a CLI error as a Whop-style callout with the exact fix, and performs it when the app can. */
export function ErrorState({ error, onRun }: { error: WhopError; onRun?: (command: string) => void }) {
  const { authMethod, refreshAccounts } = useAccount();
  const [busy, setBusy] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const [loginError, setLoginError] = useState("");
  const fix = describeFix(error, authMethod);
  const scope = /permission: (\S+)/i.exec(error.message)?.[1];
  const locked = /permission|scope|API-key/i.test(error.message);
  const unavailable = /don't have access|not available|not enabled|yet\./i.test(error.message);
  if (unavailable) {
    return (
      <Callout.Root color="gray" style={{ marginTop: 8 }}>
        <Callout.Icon>
          <LockClosedIcon />
        </Callout.Icon>
        <Callout.Title>Not available on this business yet</Callout.Title>
        <Callout.Description>{error.message.split("\n")[0]}</Callout.Description>
      </Callout.Root>
    );
  }
  async function signInAgain() {
    setBusy(true);
    setLoginError("");
    try {
      await invoke("whop_login");
      invalidateAll();
      await refreshAccounts();
    } catch (e) {
      setLoginError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const fixCommand = fix?.command ?? (fix?.login === "oauth" ? "whop login --method oauth" : fix?.login === "api-key" ? "whop login --method api-key" : undefined);
  return (
    <Callout.Root color={locked ? "amber" : "red"} style={{ marginTop: 8 }}>
      <Callout.Icon>{locked ? <LockClosedIcon /> : <ExclamationTriangleIcon />}</Callout.Icon>
      <Callout.Title>{fix?.title ?? `whop returned ${error.code}`}</Callout.Title>
      <Callout.Description>
        {scope ? (
          <>
            This login lacks the <Code size="1">{scope}</Code> scope.{" "}
          </>
        ) : (
          error.message.split("\n")[0]
        )}
        {fix?.note && <> {fix.note}</>}
        {fixCommand && (
          <>
            {" "}
            Fix: <Code size="1">{fixCommand}</Code>
          </>
        )}
        {loginError && <> {loginError}</>}
      </Callout.Description>
      {fix && (
        <Callout.Actions>
          {fix.login === "oauth" && (
            <Callout.Action onClick={signInAgain} disabled={busy}>
              {busy ? "Finish in browser…" : "Sign in with Whop"}
            </Callout.Action>
          )}
          {fix.login === "api-key" && <Callout.Action onClick={() => setKeyOpen(true)}>Connect API key</Callout.Action>}
          {fix.command && onRun && <Callout.Action onClick={() => onRun(fix.command!)}>Open in Terminal</Callout.Action>}
        </Callout.Actions>
      )}
      {fix?.login === "api-key" && <ApiKeyDialog open={keyOpen} onOpenChange={setKeyOpen} reason={fix.note} />}
    </Callout.Root>
  );
}

/** Handles the three states every query has. */
export function QueryBody<T>({ q, onRun, empty, children }: { q: UseWhopResult<T>; onRun?: (c: string) => void; empty?: (data: T) => ReactNode | null; children: (data: T) => ReactNode }) {
  if (q.error) return <><ErrorState error={q.error} onRun={onRun} /><Button size="1" variant="soft" style={{marginTop:12}} onClick={q.refresh}>Retry</Button></>;
  if (q.data === undefined) return <Loading />;
  const e = empty?.(q.data);
  if (e) return <>{e}</>;
  return <>{children(q.data)}</>;
}
