import { Code, IconButton, Text, Tooltip, toast } from "frosted-ui";
import { CopyIcon, PlayIcon, ReloadIcon } from "@radix-ui/react-icons";
import { useEffect, useState } from "react";
import { relative } from "../lib/format";

/** The anchor of every panel: the exact CLI command that produced it. */
export function CommandStrip({
  command,
  updatedAt,
  loading,
  onRefresh,
  onRun,
}: {
  command: string;
  updatedAt?: number | null;
  loading?: boolean;
  onRefresh?: () => void;
  onRun?: (command: string) => void;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      toast.success("Copied command");
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <div className="cmd">
      <Code variant="ghost" size="1" color="gray" className="cmd-code" title={command}>
        $ {command}
      </Code>
      {updatedAt ? (
        <Text size="1" color="gray" className="cmd-meta">
          {loading ? "refreshing…" : relative(updatedAt)}
        </Text>
      ) : null}
      <Tooltip content="Copy command">
        <IconButton size="1" variant="ghost" color="gray" onClick={copy} aria-label="Copy command">
          <CopyIcon />
        </IconButton>
      </Tooltip>
      {onRun && (
        <Tooltip content="Run in Terminal">
          <IconButton size="1" variant="ghost" color="gray" onClick={() => onRun(command)} aria-label="Run in terminal">
            <PlayIcon />
          </IconButton>
        </Tooltip>
      )}
      {onRefresh && (
        <Tooltip content="Refresh">
          <IconButton size="1" variant="ghost" color="gray" onClick={onRefresh} aria-label="Refresh" loading={loading}>
            <ReloadIcon />
          </IconButton>
        </Tooltip>
      )}
    </div>
  );
}
