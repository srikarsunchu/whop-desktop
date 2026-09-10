import { Badge, Card, Heading, Text } from "frosted-ui";

/** Stat tile contract: label · value · signed delta vs a named period · sparkline. */
export function StatTile({
  label,
  value,
  format,
  delta,
  deltaLabel = "vs prior 30d",
  upIsGood = true,
  loading,
  note,
  spark,
  sparkLabel,
}: {
  label: string;
  value: number | null | undefined;
  format?: Intl.NumberFormatOptions;
  delta?: number | null;
  deltaLabel?: string;
  upIsGood?: boolean;
  loading?: boolean;
  note?: string;
  spark?: number[];
  sparkLabel?: string;
}) {
  const good = delta == null ? null : (delta >= 0) === upIsGood;
  return (
    <Card size="3">
      <div className="stat">
        <div className="stat-top">
          <Text size="1" color="gray">
            {label}
          </Text>
          {spark && spark.length > 1 && <Sparkline values={spark} title={sparkLabel} />}
        </div>
        <Heading size="7" weight="medium" className="stat-value">
          {value == null ? <span style={{ color: "var(--gray-8)" }}>{loading ? "…" : "—"}</span> : new Intl.NumberFormat("en-US", format ?? { maximumFractionDigits: 0 }).format(value)}
        </Heading>
        <div className="stat-row">
          {delta == null ? (
            <Text size="1" color="gray">
              {note ?? ""}
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

/** 12-to-30 point sparkline in the accent hue; last point marked. */
export function Sparkline({ values, title, width = 64, height = 22 }: { values: number[]; title?: string; width?: number; height?: number }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const x = (i: number) => (values.length <= 1 ? 0 : (i / (values.length - 1)) * (width - 2)) + 1;
  const y = (v: number) => height - 2 - ((v - min) / span) * (height - 4);
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const last = values.length - 1;
  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title ?? "trend"}>
      <title>{title ?? "trend"}</title>
      <path d={d} className="spark-line" />
      <circle cx={x(last)} cy={y(values[last])} r={2.5} className="spark-dot" />
    </svg>
  );
}
