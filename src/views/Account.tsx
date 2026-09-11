import { Button } from "frosted-ui";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PageHeader, Panel, QueryBody } from "../components/Panel";
import {
  ActionEditor,
  Directory,
  Facts,
  RecordTable,
  option,
  type ActionSpec,
  type RecordData,
} from "../components/Workspace";
import { useAccount, useWhop, invalidateAll } from "../lib/whop";
import { UserCell, StatusBadge } from "../components/UserCell";
import { buildFields } from "../lib/business-actions";
export function AccountView({}: { runInTerminal: (c: string) => void }) {
  const { account, cliPath, cliVersion, loggedIn, profile, refreshAccounts } =
    useAccount();
  const detail = useWhop<RecordData>(
    account ? ["accounts", "get", account.id] : null,
  );
  const profiles = useWhop<{ active: string; profiles: RecordData[] }>([
    "auth",
    "list",
  ]);
  const [action, setAction] = useState<ActionSpec | null>(null);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState("");
  const roles = [
    "admin",
    "sales_manager",
    "moderator",
    "advertiser",
    "workforce",
  ].map((v) => option(v));
  const invite = () =>
    setAction({
      key: "team.invite",
      title: "Invite teammate",
      description:
        "Send an invitation with the selected business role. Choose only the access this teammate needs.",
      fields: [
        { key: "email", label: "Email", type: "email", required: true },
        { key: "role", label: "Role", required: true, options: roles },
      ],
      initial: { role: "moderator" },
      build: (v, k) => buildFields("team-members", "create", undefined, v, k),
    });
  const edit = (m: RecordData) =>
    setAction({
      key: `team.${m.id}`,
      title: "Change team role",
      description: `Update access for ${m.user?.name ?? m.email ?? "this teammate"}.`,
      fields: [{ key: "role", label: "Role", required: true, options: roles }],
      initial: { role: m.role },
      build: (v) => buildFields("team-members", "update", m.id, v),
    });
  async function signIn() {
    setSigning(true);
    setError("");
    try {
      await invoke("whop_login");
      invalidateAll();
      refreshAccounts();
    } catch (e) {
      setError(String(e));
    } finally {
      setSigning(false);
    }
  }
  return (
    <div className="stack">
      <PageHeader
        title="Account"
        subtitle="Your business, connections, and the people who help run it."
        actions={
          <>
            <Button variant="soft" onClick={refreshAccounts}>
              Refresh connection
            </Button>
            <Button
              disabled={signing || !cliPath}
              loading={signing}
              onClick={signIn}
            >
              {signing ? "Finish in browser…" : "Sign in with Whop"}
            </Button>
          </>
        }
      />
      {error && (
        <p role="alert" className="workspace-error">
          {error}
        </p>
      )}
      {signing && (
        <p className="workspace-notice">
          Complete the Whop sign-in in your browser. This page updates when the
          connection is ready.
        </p>
      )}
      <div className="grid-2">
        <Panel title="Business">
          <QueryBody q={detail}>
            {(d) => (
              <>
                <div className="business-identity">
                  <span className="app-monogram">
                    {(d.title ?? "B").slice(0, 1)}
                  </span>
                  <div>
                    <h2>{d.title}</h2>
                    <p>{account?.demo ? "Demo business" : "Whop business"}</p>
                  </div>
                </div>
                <Facts
                  items={[
                    ["Country", d.country?.toUpperCase()],
                    ["Type", d.business_type?.replaceAll("_", " ")],
                    [
                      "Workspace",
                      account?.demo ? "Local demo" : "Connected business",
                    ],
                  ]}
                />
              </>
            )}
          </QueryBody>
        </Panel>
        <Panel title="Connection">
          <Facts
            items={[
              [
                "Status",
                account?.demo
                  ? "Local demo"
                  : loggedIn
                    ? "Connected"
                    : "Not signed in",
              ],
              [
                "Profile",
                account?.demo ? "Demo workspace" : (profile ?? "None"),
              ],
            ]}
          />
          <details className="workspace-technical">
            <summary>Technical details</summary>
            <Facts
              items={[
                ["CLI location", cliPath],
                ["CLI version", cliVersion],
              ]}
            />
          </details>
          {!cliPath && (
            <p className="workspace-notice">
              Install the official Whop CLI to connect this app.
            </p>
          )}
        </Panel>
      </div>
      <Panel title="Saved profiles">
        <QueryBody q={profiles}>
          {(d) => (
            <div className="account-profiles">
              {d.profiles.length === 0 ? (
                <p className="workspace-muted">
                  No saved profiles. Sign in to connect your business.
                </p>
              ) : (
                d.profiles.map((p) => (
                  <div className="account-profile" key={p.name}>
                    <div>
                      <strong>{p.name}</strong>
                      <small>{p.accountTitle ?? p.method}</small>
                    </div>
                    {p.name === d.active ? (
                      <StatusBadge status="active" />
                    ) : (
                      <Button
                        size="1"
                        variant="soft"
                        onClick={() =>
                          setAction({
                            key: `profile.${p.name}`,
                            title: `Switch to ${p.name}`,
                            description:
                              "Change the active Whop login and reload the connected businesses.",
                            build: () => ["auth", "switch", p.name],
                            onSuccess: refreshAccounts,
                          })
                        }
                      >
                        Switch profile
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </QueryBody>
      </Panel>
      <div className="workspace-list-heading">
        <h2>Team</h2>
        <Button size="1" onClick={invite}>
          Invite teammate
        </Button>
      </div>
      <Directory
        title="Team members"
        storageKey="team"
        args={["team-members", "list", "--first", "100"]}
        renderRows={(rows) => (
          <RecordTable
            rows={rows}
            canSelect={(r) => r.role !== "owner"}
            onSelect={(r) => {
              if (r.role !== "owner") edit(r);
            }}
            columns={[
              {
                label: "Teammate",
                render: (r) => (
                  <UserCell
                    name={r.user?.name ?? r.email}
                    username={r.user?.username}
                  />
                ),
              },
              {
                label: "Role",
                render: (r) => r.role?.replaceAll("_", " ") ?? "—",
              },
              {
                label: "Access",
                render: (r) =>
                  r.role === "owner" ? (
                    "Business owner"
                  ) : (
                    <Button size="1" variant="soft" onClick={() => edit(r)}>
                      Change role
                    </Button>
                  ),
              },
            ]}
          />
        )}
        onSelect={(r) => {
          if (r.role !== "owner") edit(r);
        }}
        label={(r) => r.user?.name ?? r.user?.username ?? r.email ?? r.id}
        secondary={(r) => r.role?.replaceAll("_", " ")}
      />
      {action && (
        <ActionEditor
          key={action.key}
          spec={action}
          onClose={() => setAction(null)}
        />
      )}
    </div>
  );
}
