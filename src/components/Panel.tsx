import { Button, Callout, Card, Code, EmptyState, Heading, Spinner, Text } from "frosted-ui";
import { ExclamationTriangleIcon, LockClosedIcon } from "@radix-ui/react-icons";
import type { ReactNode } from "react";
import { CommandStrip } from "./CommandStrip";
import type { UseWhopResult, WhopError } from "../lib/whop";

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
    <Card size={size}>
      {(title || query) && (
        <div className="panel-head">
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            {title && (
              <Heading size="3" weight="medium">
                {title}
              </Heading>
            )}
            {query && <CommandStrip command={query.command} updatedAt={query.updatedAt} loading={query.loading} onRefresh={query.refresh} onRun={onRun} />}
          </div>
          {actions && <div className="panel-head-actions">{actions}</div>}
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

const SCOPE_HINTS: { match: RegExp; title: string; fix: string }[] = [
  { match: /API-key login|developer:manage_webhook/i, title: "Needs an API-key login", fix: "whop login --api-key" },
  { match: /Missing required permission: (\S+)/i, title: "Missing permission", fix: "whop login --api-key" },
  { match: /not found|ENOENT|Install it/i, title: "Whop CLI not found", fix: "curl -fsSL https://whop.com/install.sh | sh" },
  { match: /not logged in|unauthorized|401/i, title: "Not signed in", fix: "whop login" },
];

/** Shows a CLI error as a Whop-style callout with the exact command that fixes it. */
export function ErrorState({ error, onRun }: { error: WhopError; onRun?: (command: string) => void }) {
  const hint = SCOPE_HINTS.find((h) => h.match.test(error.message));
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
  return (
    <Callout.Root color={locked ? "amber" : "red"} style={{ marginTop: 8 }}>
      <Callout.Icon>{locked ? <LockClosedIcon /> : <ExclamationTriangleIcon />}</Callout.Icon>
      <Callout.Title>{hint?.title ?? `whop returned ${error.code}`}</Callout.Title>
      <Callout.Description>
        {scope ? (
          <>
            This login lacks the <Code size="1">{scope}</Code> scope.{" "}
          </>
        ) : (
          error.message.split("\n")[0]
        )}
        {hint && (
          <>
            {" "}
            Fix: <Code size="1">{hint.fix}</Code>
          </>
        )}
      </Callout.Description>
      {hint && onRun && (
        <Callout.Actions>
          <Callout.Action onClick={() => onRun(hint.fix)}>Open in Terminal</Callout.Action>
        </Callout.Actions>
      )}
    </Callout.Root>
  );
}

/** Handles the three states every query has. */
export function QueryBody<T>({ q, onRun, empty, children }: { q: UseWhopResult<T>; onRun?: (c: string) => void; empty?: (data: T) => ReactNode | null; children: (data: T) => ReactNode }) {
  if (q.error) return <ErrorState error={q.error} onRun={onRun} />;
  if (q.data === undefined) return <Loading />;
  const e = empty?.(q.data);
  if (e) return <>{e}</>;
  return <>{children(q.data)}</>;
}
