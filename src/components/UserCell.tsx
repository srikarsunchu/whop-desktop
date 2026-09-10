import { Avatar, Badge, Text } from "frosted-ui";

export function UserCell({ username, name, avatar }: { username?: string | null; name?: string | null; avatar?: string | null }) {
  const label = username ? `@${username}` : name ?? "Unknown";
  return (
    <div className="cell-user">
      <Avatar size="1" fallback={(name ?? username ?? "?").charAt(0).toUpperCase()} src={avatar ?? undefined} color="gray" />
      <div className="cell-user-text">
        <Text size="2" weight="medium">
          {name ?? label}
        </Text>
        {name && username && (
          <Text size="1" color="gray">
            @{username}
          </Text>
        )}
      </div>
    </div>
  );
}

const STATUS_COLOR: Record<string, "green" | "gray" | "red" | "amber" | "blue"> = {
  active: "green",
  joined: "green",
  paid: "green",
  live: "green",
  visible: "green",
  completed: "green",
  trialing: "blue",
  pending: "amber",
  preview: "amber",
  past_due: "amber",
  canceling: "amber",
  needs_response: "red",
  paused: "gray",
  canceled: "gray",
  expired: "gray",
  hidden: "gray",
  failed: "red",
};

export function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <Text size="1" color="gray">—</Text>;
  const color = STATUS_COLOR[status] ?? "gray";
  return (
    <Badge size="1" variant="soft" color={color}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
