// wv's preflight, continuously: `wv doctor` runs when the business changes and its worst level sits in the
// sidebar footer. Clicking it lists every check that is not green with its fix: a `wv` write through the gate
// in the action editor, a `whop` read in the terminal, a dashboard page in the browser. Hidden without wv.
import { Badge, Button, Dialog, Text } from "frosted-ui";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { ActionEditor, type ActionSpec } from "./Workspace";
import type { ViewId } from "./Sidebar";
import { useAccount, useWv, wvPath, type WvDoctor, type WvDoctorCheck } from "../lib/whop";

const worst = (d: WvDoctor | undefined): "ok" | "warn" | "fail" | undefined =>
  !d ? undefined : d.checks.some((c) => c.level === "fail") ? "fail" : d.checks.some((c) => c.level === "warn") ? "warn" : "ok";

export function DoctorStrip({ runInTerminal, onNavigate }: { runInTerminal?: (command: string) => void; onNavigate: (v: ViewId) => void }) {
  const { account } = useAccount();
  const [hasWv, setHasWv] = useState(false);
  useEffect(() => {
    wvPath().then((p) => setHasWv(!!p));
  }, []);
  const q = useWv<WvDoctor>(hasWv && account ? "doctor" : null, [], { ttl: 5 * 60_000 });
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<ActionSpec | null>(null);
  if (!hasWv || !account) return null;
  const level = worst(q.data);
  const failing = q.data?.checks.filter((c) => c.level !== "ok") ?? [];
  const blocking = q.data?.checks.filter((c) => c.level === "fail" && c.blocking).length ?? 0;
  const label = q.error
    ? "Doctor could not run"
    : !q.data
      ? "Checking the business…"
      : level === "ok"
        ? "Every check is green"
        : blocking
          ? `${blocking} ${blocking === 1 ? "check blocks" : "checks block"} selling`
          : `${failing.length} ${failing.length === 1 ? "check needs" : "checks need"} you`;
  const fix = (c: WvDoctorCheck) => {
    const cmd = c.fix ?? [];
    if (cmd[0] === "wv") {
      setOpen(false);
      setAction({ key: `doctor.${c.key}`, title: c.label, description: c.detail, fields: [], build: () => cmd.slice(1) });
    } else if (cmd.length && runInTerminal) {
      setOpen(false);
      runInTerminal(cmd.join(" "));
    } else if (c.dashboard) void invoke("open_external", { url: c.dashboard });
  };
  return (
    <>
      <button type="button" className="doctor-strip" onClick={() => setOpen(true)} title="wv doctor: is this business set up to sell?">
        <span className="doctor-dot" data-level={q.error ? "fail" : level} />
        <span>{label}</span>
      </button>
      {open && (
        <Dialog.Root open onOpenChange={(o) => !o && setOpen(false)}>
          <Dialog.Content style={{ maxWidth: 520 }}>
            <Dialog.Title>Doctor</Dialog.Title>
            <Dialog.Description>
              {q.data?.account?.title ?? account.title} · {q.data ? `${q.data.checks.length} checks` : "running"} · wv doctor
            </Dialog.Description>
            {q.error ? (
              <Text size="2" color="red">{q.error.message}</Text>
            ) : !q.data ? (
              <Text size="2" color="gray">Running…</Text>
            ) : failing.length === 0 ? (
              <Text size="2" color="gray">Every check is green: this business is set up to sell, run ads, pay out, and receive webhooks.</Text>
            ) : (
              <ul className="doctor-checks">
                {failing.map((c) => (
                  <li key={c.key} data-level={c.level}>
                    <div className="setup-head">
                      <strong>{c.label}</strong>
                      <Badge size="1" color={c.level === "fail" ? "red" : "amber"} variant="soft">
                        {c.level === "fail" ? (c.blocking ? "blocks selling" : "failing") : "warning"}
                      </Badge>
                    </div>
                    <p className="workspace-muted">{c.detail}</p>
                    {(c.fix?.length || c.dashboard) && (
                      <div className="workspace-actions" style={{ padding: "4px 0 0", border: 0 }}>
                        {c.fix?.length ? (
                          <Button size="1" variant={c.fix[0] === "wv" ? "classic" : "soft"} onClick={() => fix(c)}>
                            {c.fix[0] === "wv" ? "Fix with approval" : "Run in terminal"}
                          </Button>
                        ) : null}
                        {c.dashboard && (
                          <Button size="1" variant="ghost" onClick={() => void invoke("open_external", { url: c.dashboard })}>
                            Open dashboard ↗
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="workspace-dialog-actions">
              <Button variant="soft" color="gray" onClick={() => { setOpen(false); onNavigate("account"); }}>
                Setup steps
              </Button>
              <Button variant="soft" color="gray" onClick={q.refresh}>
                Re-check
              </Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </div>
          </Dialog.Content>
        </Dialog.Root>
      )}
      {action && <ActionEditor key={action.key} spec={action} onClose={() => setAction(null)} />}
    </>
  );
}
