import { Button, toast } from "frosted-ui";
import { StatusBadge } from "../components/UserCell";
import { useState } from "react";
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
  useSaved,
  type ActionSpec,
  type RecordData,
} from "../components/Workspace";
import { runWhopJson, useAccount, useWhop } from "../lib/whop";
import { bountyCommand, buildFields } from "../lib/business-actions";
import { money } from "../lib/format";
export function Growth({
  ask,
}: {
  runInTerminal: (c: string) => void;
  ask: (p: string) => void;
}) {
  const { account } = useAccount();
  const edit = async () => {
    if (!selected) return;
    try {
      const b = await runWhopJson<RecordData>(
        ["bounties", "get", selected.id],
        !!account?.demo,
      );
      setAction({
        key: `bounty.edit.${b.id}`,
        title: "Edit bounty brief",
        description:
          "Update the title and instructions. Existing funding stays the same.",
        initial: { title: b.title, description: b.description ?? "" },
        fields: [
          { key: "title", label: "Title", required: true },
          {
            key: "description",
            label: "Instructions",
            type: "textarea",
            required: true,
          },
        ],
        build: (v) => buildFields("bounties", "update", b.id, v),
        onSuccess: (r) => {
          if (r?.id) setSelected(r);
        },
      });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const [submission, setSubmission] = useState<RecordData | null>(null);
  const [tab, setTab] = useSaved("growth.tab", "bounties");
  const [selected, setSelected] = useState<RecordData | null>(null);
  const [action, setAction] = useState<ActionSpec | null>(null);
  const create = () =>
    setAction({
      key: "bounty.new",
      title: "Create bounty",
      description:
        "Publish a paid task. Funding is escrowed immediately: reward per accepted submission × winner slots.",
      initial: {
        business_goal_type: "clipping",
        gross_reward_amount: "10",
        accepted_submissions_limit: "50",
      },
      fields: [
        { key: "title", label: "Title", required: true },
        {
          key: "business_goal_type",
          label: "Goal",
          required: true,
          options: [
            "clipping",
            "post_engagement",
            "owned_account_growth",
            "ugc_content",
            "local_activation",
            "data_capture",
            "other",
          ].map((v) => option(v)),
        },
        {
          key: "description",
          label: "Task instructions and acceptance criteria",
          type: "textarea",
          required: true,
        },
        {
          key: "gross_reward_amount",
          label: "Reward per accepted submission (USD)",
          type: "number",
          min: 1,
          required: true,
        },
        {
          key: "accepted_submissions_limit",
          label: "Winner slots",
          type: "number",
          min: 1,
          required: true,
        },
      ],
      build: bountyCommand,
      review: (v) => (
        <p className="workspace-notice">
          Total funding:{" "}
          {money(
            Number(v.gross_reward_amount || 0) *
              Number(v.accepted_submissions_limit || 0),
          )}
          . Platform fees and affiliate shares come from the reward amount.
        </p>
      ),
    });
  return (
    <div className="stack">
      <PageHeader
        title="Growth"
        subtitle="Give creators a clear brief and track the work it brings in."
        actions={
          <>
            <Button
              variant="soft"
              onClick={() =>
                ask(
                  "Help me write a clear clipping bounty brief and acceptance criteria for my business. Draft only; do not create or fund anything.",
                )
              }
            >
              Help with a brief
            </Button>
            <Button variant="classic" onClick={create}>
              New bounty
            </Button>
          </>
        }
      />
      <div className="workspace-tabs">
        {["bounties", "partners"].map((t) => (
          <button
            key={t}
            aria-pressed={tab === t}
            onClick={() => {
              setTab(t);
              setSelected(null);
            }}
          >
            {t === "bounties" ? "Bounties" : "Referrals"}
          </button>
        ))}
      </div>
      {tab === "partners" && (
        <div className="workspace-actions">
          <Button
            variant="soft"
            onClick={() =>
              setAction({
                key: "partner.enroll",
                title: "Enroll as a Whop partner",
                description:
                  "Enroll the signed-in user in the Whop partner program.",
                build: (_v, k) => [
                  "partners",
                  "create",
                  "--idempotency-key",
                  k,
                ],
              })
            }
          >
            Enroll as a partner
          </Button>
        </div>
      )}
      <div className="business-directory">
        <Directory
          key={tab}
          title={tab === "bounties" ? "Bounties" : "Referred businesses"}
          storageKey={`growth.${tab}`}
          args={[tab, "list", "--first", "100"]}
          renderRows={(rows) => (
            <RecordTable
              rows={rows}
              onSelect={(r) => {
                setSelected(r);
                setSubmission(null);
              }}
              columns={
                tab === "bounties"
                  ? [
                      {
                        label: "Bounty",
                        render: (r) => (
                          <span>
                            <strong>{r.title}</strong>
                            <small>
                              {r.business_goal_type?.replaceAll("_", " ")}
                            </small>
                          </span>
                        ),
                      },
                      {
                        label: "Status",
                        render: (r) => <StatusBadge status={r.status} />,
                      },
                      {
                        label: "Submissions",
                        render: (r) => r.submissions_count ?? 0,
                      },
                      {
                        label: "Accepted",
                        render: (r) => r.accepted_submissions_count ?? 0,
                      },
                      {
                        label: "Paid out",
                        render: (r) => money(r.gross_paid_out_amount),
                      },
                    ]
                  : [
                      {
                        label: "Business",
                        render: (r) => r.title ?? r.name ?? "Referred business",
                      },
                      {
                        label: "Status",
                        render: (r) => <StatusBadge status={r.status} />,
                      },
                      {
                        label: "Earnings",
                        render: (r) => money(r.total_earnings),
                      },
                    ]
              }
            />
          )}
          statuses={
            tab === "bounties" ? ["open", "completed", "canceled"] : undefined
          }
          selected={selected?.id}
          onSelect={(r) => {
            setSelected(r);
            setSubmission(null);
          }}
          secondary={(r) =>
            tab === "bounties"
              ? `${r.submissions_count ?? 0} submissions · ${money(r.gross_paid_out_amount ?? 0)} paid`
              : `${money(r.total_earnings)} earned`
          }
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
              title={selected.title ?? "Referral"}
              subtitle={
                tab === "bounties"
                  ? selected.business_goal_type?.replaceAll("_", " ")
                  : "Referral performance"
              }
              onClose={() => setSelected(null)}
              actions={
                tab === "bounties" &&
                !["completed", "canceled"].includes(selected.status) ? (
                  <>
                    <Button variant="soft" size="1" onClick={edit}>
                      Edit brief
                    </Button>
                    <Button
                      variant="soft"
                      color="red"
                      size="1"
                      onClick={() =>
                        setAction({
                          key: `bounty.cancel.${selected.id}`,
                          title: "Cancel bounty",
                          description: `Cancel “${selected.title}”. Review its submissions and funding before continuing.`,
                          danger: true,
                          build: () => ["bounties", "cancel", selected.id],
                          onSuccess: () => setSelected(null),
                        })
                      }
                    >
                      Cancel bounty
                    </Button>
                  </>
                ) : undefined
              }
            >
              <Facts
                items={
                  tab === "bounties"
                    ? [
                        ["Status", selected.status],
                        [
                          "Goal",
                          selected.business_goal_type?.replaceAll("_", " "),
                        ],
                        ["Submissions", selected.submissions_count],
                        ["Accepted", selected.accepted_submissions_count],
                        ["Paid out", money(selected.gross_paid_out_amount)],
                        ["Schedule", selected.frequency],
                      ]
                    : [
                        ["Status", selected.status],
                        ["Earnings", money(selected.total_earnings)],
                      ]
                }
              />
              {tab === "bounties" && (
                <>
                  <BountyBrief id={selected.id} />
                  <div className="workspace-section">
                    <h3>Public submissions</h3>
                    <p className="workspace-muted">
                      Inspect submitted work here. Submission approval and
                      payout management are not available in this app yet.
                    </p>
                    <Directory
                      title="Submissions"
                      storageKey={`submissions.${selected.id}`}
                      args={[
                        "bounties",
                        "submissions",
                        selected.id,
                        "--first",
                        "100",
                      ]}
                      onSelect={setSubmission}
                    />
                    {submission && (
                      <ReadDetails
                        args={["bounties", "get-submission", submission.id]}
                        title="Selected submission"
                      />
                    )}
                  </div>
                </>
              )}
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

function BountyBrief({ id }: { id: string }) {
  const q = useWhop<RecordData>(["bounties", "get", id]);
  return (
    <section className="workspace-section">
      <h3>Brief and funding</h3>
      <QueryBody q={q}>
        {(d) => (
          <>
            <p className="bounty-instructions">
              {d.description ?? "No instructions returned."}
            </p>
            <Facts
              items={[
                [
                  "Reward per accepted submission",
                  money(d.gross_reward_amount, d.currency ?? "usd"),
                ],
                ["Winner slots", d.accepted_submissions_limit ?? "—"],
              ]}
            />
          </>
        )}
      </QueryBody>
    </section>
  );
}
