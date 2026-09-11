import { Button } from "frosted-ui";
import { StatusBadge } from "../components/UserCell";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PageHeader, QueryBody } from "../components/Panel";
import {
  ActionEditor,
  Detail,
  Directory,
  Facts,
  RecordDialog,
  RecordTable,
  ReadDetails,
  option,
  type ActionSpec,
  type RecordData,
} from "../components/Workspace";
import { useAccount, runWhopRaw, runWhopJson, useWhop } from "../lib/whop";
import { buildFields } from "../lib/business-actions";
import { shortDate } from "../lib/format";
export function Apps({}: {
  runInTerminal: (c: string) => void;
  ask: (p: string) => void;
}) {
  const { account } = useAccount();
  const [selected, setSelected] = useState<RecordData | null>(null);
  const [build, setBuild] = useState<RecordData | null>(null);
  const [action, setAction] = useState<ActionSpec | null>(null);
  const [logs, setLogs] = useState(false);
  const [result, setResult] = useState("");
  const execute = async (args: string[], demo: boolean) => {
    if (demo) return runWhopJson(args, true);
    const out = await runWhopRaw(args);
    if (out.code !== 0)
      throw Error(out.stderr || out.stdout || "The operation failed.");
    return out.stdout;
  };
  const completed = (r: any) =>
    setResult(
      typeof r === "string" ? r : "Demo operation completed on this Mac.",
    );
  const create = () =>
    setAction({
      key: "app.new",
      title: "Create app",
      description:
        "Register an app and scaffold its local project. A blueprint is optional. This does not deploy the app.",
      fields: [
        { key: "name", label: "App name", required: true },
        {
          key: "app_type",
          label: "Type",
          required: true,
          options: [
            option("website", "Website"),
            option("b2c_app", "Whop app"),
          ],
        },
        {
          key: "dir",
          label: "New project folder",
          required: true,
          hint: "Absolute path to a new folder on this Mac.",
        },
        {
          key: "template",
          label: "Blueprint app ID (optional)",
          hint: "Clone a published Whop blueprint.",
        },
      ],
      initial: { app_type: "website" },
      build: (v) => {
        if (!v.dir.startsWith("/") || v.dir === "/")
          throw Error("Choose an absolute path for the new project folder.");
        if (v.template && !v.template.startsWith("app_"))
          throw Error("Blueprint IDs start with app_.");
        return buildFields("apps", "init", undefined, {
          ...v,
          company_id: account!.id,
        });
      },
      execute,
      onSuccess: completed,
    });
  const deploy = () => {
    if (!selected) return;
    setAction({
      key: `deploy.${selected.id}`,
      title: "Deploy preview",
      description: `Build a local project and upload a preview for ${selected.name}. The project will be linked to this app. Production stays unchanged until a build is promoted.`,
      fields: [
        {
          key: "dir",
          label: "Project folder",
          required: true,
          hint: "Absolute path to the project containing its source.",
        },
      ],
      build: (v) => {
        if (!v.dir.startsWith("/") || v.dir === "/")
          throw Error("Enter an absolute project folder.");
        return [
          "apps",
          "deploy",
          "--dir",
          v.dir,
          "--app",
          selected.id,
          "--preview",
          "true",
        ];
      },
      execute,
      onSuccess: completed,
    });
  };
  return (
    <div className="stack">
      <PageHeader
        title="Apps"
        subtitle="Keep your projects, preview builds, and runtime logs together."
        actions={
          <Button variant="classic" onClick={create}>
            New app
          </Button>
        }
      />
      {result && (
        <details className="workspace-technical">
          <summary>Last operation</summary>
          <pre style={{ whiteSpace: "pre-wrap" }}>{result}</pre>
        </details>
      )}
      <div className="business-directory">
        <Directory
          title="Apps"
          storageKey="apps"
          args={["apps", "list", "--first", "100"]}
          renderRows={(rows) => (
            <div className="app-gallery">
              {rows.map((r) => (
                <button
                  key={r.id}
                  className="app-project"
                  onClick={() => {
                    setSelected(r);
                    setBuild(null);
                    setLogs(false);
                  }}
                >
                  <div className="app-project-top">
                    <span className="app-monogram">
                      {r.name?.slice(0, 1) ?? "A"}
                    </span>
                    <StatusBadge status={r.status} />
                  </div>
                  <h3>{r.name}</h3>
                  <p>
                    {r.domain ??
                      (r.app_type === "website" ? "Website" : "Whop app")}
                  </p>
                  <footer>
                    <span>Updated {shortDate(r.updated_at)}</span>
                    <span>Manage app →</span>
                  </footer>
                </button>
              ))}
            </div>
          )}
          selected={selected?.id}
          onSelect={(r) => {
            setSelected(r);
            setBuild(null);
            setLogs(false);
          }}
          secondary={(r) => r.domain ?? r.app_type}
        />
        {selected && (
          <RecordDialog
            title={selected.name ?? selected.title ?? "Details"}
            subtitle="Manage this record"
            open={!action}
            onClose={() => {
              if (!action) setSelected(null);
            }}
          >
            <Detail
              title={selected.name}
              subtitle={selected.domain ?? selected.id}
              onClose={() => setSelected(null)}
              actions={
                <>
                  <Button size="1" onClick={deploy}>
                    Deploy preview
                  </Button>
                  <Button
                    size="1"
                    variant="soft"
                    onClick={() => setLogs(!logs)}
                  >
                    {logs ? "Hide logs" : "Show logs"}
                  </Button>
                  {selected.domain && !account?.demo && (
                    <Button
                      size="1"
                      variant="soft"
                      onClick={() =>
                        invoke("open_external", {
                          url: `https://${selected.domain}`,
                        })
                      }
                    >
                      Open app
                    </Button>
                  )}
                </>
              }
            >
              <Facts
                items={[
                  ["Status", selected.status],
                  [
                    "Type",
                    selected.app_type === "b2c_app"
                      ? "Whop app"
                      : selected.app_type?.replaceAll("_", " "),
                  ],
                  ["Updated", shortDate(selected.updated_at)],
                  ["Created", shortDate(selected.created_at)],
                ]}
              />
              <div className="workspace-section">
                <Directory
                  title="Builds"
                  storageKey={`builds.${selected.id}`}
                  args={[
                    "apps",
                    "builds",
                    "list",
                    "--app_id",
                    selected.id,
                    "--first",
                    "100",
                  ]}
                  renderRows={(rows) => (
                    <RecordTable
                      rows={rows}
                      onSelect={setBuild}
                      columns={[
                        { label: "Build", render: (r) => r.name ?? r.id },
                        {
                          label: "Status",
                          render: (r) => <StatusBadge status={r.status} />,
                        },
                        {
                          label: "Created",
                          render: (r) => shortDate(r.created_at),
                        },
                      ]}
                    />
                  )}
                  selected={build?.id}
                  onSelect={setBuild}
                  label={(r) => r.name ?? r.id}
                  secondary={(r) => shortDate(r.created_at)}
                />
                {build && (
                  <>
                    <ReadDetails
                      args={["apps", "builds", "get", build.id]}
                      title="Selected build"
                    />
                    <Button
                      size="1"
                      variant="soft"
                      onClick={() =>
                        setAction({
                          key: `promote.${build.id}`,
                          title: "Promote build to production",
                          description: `Make build ${build.id} the live version of ${selected.name}.`,
                          build: () => ["apps", "builds", "promote", build.id],
                        })
                      }
                    >
                      Review promotion
                    </Button>
                  </>
                )}
              </div>
              {logs && <RuntimeLogs appId={selected.id} />}
            </Detail>
          </RecordDialog>
        )}
      </div>
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

function RuntimeLogs({ appId }: { appId: string }) {
  const q = useWhop<any>(["apps", "logs", appId, "--first", "100"]);
  return (
    <section className="workspace-section">
      <h3>
        Runtime logs <span className="workspace-muted">· latest 100</span>
      </h3>
      <QueryBody q={q}>
        {(data) => {
          const rows = Array.isArray(data)
            ? data
            : Array.isArray(data?.data)
              ? data.data
              : Array.isArray(data?.logs)
                ? data.logs
                : [data];
          return (
            <div className="runtime-log">
              {rows.length === 0 ? (
                <p>No recent logs.</p>
              ) : (
                rows.map((r: any, i: number) => (
                  <div key={r?.id ?? i}>
                    <time>
                      {r?.created_at
                        ? new Date(r.created_at).toLocaleTimeString()
                        : "—"}
                    </time>
                    <span>{r?.level ?? "info"}</span>
                    <p>
                      {typeof r === "string"
                        ? r
                        : (r?.message ?? JSON.stringify(r))}
                    </p>
                  </div>
                ))
              )}
            </div>
          );
        }}
      </QueryBody>
    </section>
  );
}
