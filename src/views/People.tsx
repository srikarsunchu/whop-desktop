import { Button } from "frosted-ui";
import { useState } from "react";
import { PageHeader } from "../components/Panel";
import {
  Detail,
  Directory,
  Facts,
  RecordDialog,
  RecordTable,
  ReadDetails,
  type RecordData,
} from "../components/Workspace";
import { UserCell } from "../components/UserCell";
import { money, shortDate } from "../lib/format";
export function People({
  onMember,
}: {
  runInTerminal: (c: string) => void;
  onMember?: (username: string) => void;
}) {
  const [selected, setSelected] = useState<RecordData | null>(null);
  const [events, setEvents] = useState(false);
  return (
    <div className="stack">
      <PageHeader
        title="People"
        subtitle="Explore purchase history and the traffic behind your audience."
        actions={
          <Button variant="soft" onClick={() => setEvents(!events)}>
            {events ? "Hide event activity" : "Event activity"}
          </Button>
        }
      />
      {events && (
        <RecordDialog
          title="Event activity"
          subtitle="Recent audience activity"
          onClose={() => setEvents(false)}
        >
          <Detail
            title="Event activity"
            subtitle="Recent activity across your audience"
            onClose={() => setEvents(false)}
          >
            <ReadDetails args={["events", "pulse"]} title="Recent events" />
          </Detail>
        </RecordDialog>
      )}
      <div className="business-directory">
        <Directory
          title="People"
          storageKey="people"
          args={["people", "list", "--first", "100"]}
          renderRows={(rows) => (
            <RecordTable
              rows={rows}
              onSelect={setSelected}
              columns={[
                {
                  label: "Person",
                  render: (r) => (
                    <UserCell
                      name={r.name ?? "Anonymous visitor"}
                      username={r.user?.username}
                    />
                  ),
                },
                { label: "Lifetime value", render: (r) => money(r.ltv) },
                { label: "Purchases", render: (r) => r.purchase_count ?? 0 },
                {
                  label: "Location",
                  render: (r) =>
                    [r.location?.city, r.location?.country]
                      .filter(Boolean)
                      .join(", ") || "—",
                },
                {
                  label: "Last seen",
                  render: (r) => shortDate(r.last_seen_at),
                },
              ]}
            />
          )}
          selected={selected?.id}
          onSelect={setSelected}
          label={(r) => r.name ?? r.user?.username ?? "Anonymous visitor"}
          secondary={(r) =>
            `${r.purchase_count ?? 0} purchases · ${r.location?.city ?? "Unknown location"}`
          }
        />
        {selected && (
          <RecordDialog
            title={selected.name ?? "Visitor profile"}
            subtitle="Purchase history and activity"
            onClose={() => setSelected(null)}
          >
            <Detail
              title={
                selected.name ?? selected.user?.username ?? "Anonymous visitor"
              }
              subtitle={selected.email ?? "No email recorded"}
              onClose={() => setSelected(null)}
              actions={
                selected.user?.username ? (
                  <Button
                    size="1"
                    variant="soft"
                    onClick={() => onMember?.(selected.user.username)}
                  >
                    View memberships
                  </Button>
                ) : undefined
              }
            >
              <Facts
                items={[
                  ["Lifetime value", money(selected.ltv)],
                  ["Purchases", selected.purchase_count],
                  ["Events", selected.event_count],
                  ["First seen", shortDate(selected.first_seen_at)],
                  ["Last seen", shortDate(selected.last_seen_at)],
                  [
                    "Location",
                    [selected.location?.city, selected.location?.country]
                      .filter(Boolean)
                      .join(", "),
                  ],
                  ["Device", selected.device?.device],
                  ["Browser", selected.device?.browser],
                ]}
              />
              <details className="workspace-technical">
                <summary>Full customer record</summary>
                <ReadDetails
                  args={["people", "get", selected.id]}
                  title="Customer profile"
                />
              </details>
            </Detail>
          </RecordDialog>
        )}
      </div>
    </div>
  );
}
