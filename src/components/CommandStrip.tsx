import { Button, Code, IconButton, Popover, Text, Tooltip, toast } from "frosted-ui";
import { CheckIcon, CodeIcon, CopyIcon, PlayIcon, ReloadIcon } from "@radix-ui/react-icons";
import { useEffect, useState } from "react";
import { relative } from "../lib/format";

/** Keep provenance one click away without letting shell syntax dominate the page. */
export function CommandStrip({ command, updatedAt, loading, onRefresh, onRun }: {
  command: string;
  updatedAt?: number | null;
  loading?: boolean;
  onRefresh?: () => void;
  onRun?: (command: string) => void;
}) {
  const [, tick] = useState(0);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(command); setCopied(true); }
    catch { toast.error("Could not copy command"); }
  };
  const short = command.split(" ").slice(0, 3).join(" ");
  return (
    <div className="cmd">
      <Popover.Root>
        <Popover.Trigger>
          <button type="button" className="cmd-trigger" aria-label={`Inspect command: ${short}`}>
            <CodeIcon /><span>{short}</span>
          </button>
        </Popover.Trigger>
        <Popover.Content align="end" sideOffset={8} className="cmd-popover">
          <div className="cmd-popover-head"><Text size="2" weight="medium">Behind this view</Text><Text size="1" color="gray">{loading ? "Refreshing…" : updatedAt ? `Updated ${relative(updatedAt)}` : "Whop CLI"}</Text></div>
          <Code className="cmd-full" size="1" variant="ghost" color="gray">$ {command}</Code>
          <div className="cmd-popover-actions">
            <Button size="1" variant="soft" color="gray" onClick={copy}>{copied ? <CheckIcon /> : <CopyIcon />}{copied ? "Copied" : "Copy command"}</Button>
            {onRun && <Button size="1" variant="surface" color="gray" onClick={() => onRun(command)}><PlayIcon />Open in terminal</Button>}
          </div>
        </Popover.Content>
      </Popover.Root>
      {onRefresh && <Tooltip content="Refresh data"><IconButton size="1" variant="ghost" color="gray" onClick={onRefresh} aria-label={`Refresh ${short}`} loading={loading}><ReloadIcon /></IconButton></Tooltip>}
    </div>
  );
}
