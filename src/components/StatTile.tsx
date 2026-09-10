import { Badge, Card, Heading, Text } from "frosted-ui";

/** Stat tile contract: label · value · signed delta vs a named period. */
export function StatTile({
  label,
  value,
  format,
  delta,
  deltaLabel = "vs prior 30d",
  upIsGood = true,
  loading,
  note,
}: {
  label: string;
  value: number | null | undefined;
  format?: Intl.NumberFormatOptions;
  delta?: number | null;
  deltaLabel?: string;
  upIsGood?: boolean;
  loading?: boolean;
  note?: string;
}) {
  const good = delta == null ? null : (delta >= 0) === upIsGood;
  return (
    <Card size="3">
      <div className="stat">
        <Text size="1" color="gray">
          {label}
        </Text>
        <Heading size="7" weight="medium" className="stat-value">
          {value == null ? (
            <span style={{ color: "var(--gray-8)" }}>{loading ? "…" : "—"}</span>
          ) : (
            new Intl.NumberFormat("en-US", format ?? { maximumFractionDigits: 0 }).format(value)
          )}
        </Heading>
        <div className="stat-row">
          {delta == null ? (
            <Text size="1" color="gray">
              {note ?? (value == null ? "" : "no prior period")}
            </Text>
          ) : (
            <>
              <Badge size="1" variant="soft" color={delta === 0 ? "gray" : good ? "green" : "red"}>
                {delta > 0 ? "+" : ""}
                {delta.toFixed(delta === 0 ? 0 : 1)}%
              </Badge>
              <Text size="1" color="gray">
                {deltaLabel}
              </Text>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
