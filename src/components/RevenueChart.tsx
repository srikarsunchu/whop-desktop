import { Card, Text } from "frosted-ui";
import { useMemo, useRef, useState } from "react";
import { money, shortDate } from "../lib/format";

interface Point {
  timestamp: number;
  value: number;
}

/**
 * Single-series area chart on Frosted tokens. 2px line, 10% wash, hairline
 * horizontal grid, crosshair + tooltip on hover, endpoint label. One axis.
 */
export function RevenueChart({ points, currency = "usd", height = 220 }: { points: Point[]; currency?: string; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 1000;
  const H = height;
  const padL = 44;
  const padR = 16;
  const padT = 12;
  const padB = 24;

  const { path, area, xs, ys, ticks, max } = useMemo(() => {
    const n = points.length;
    const vals = points.map((p) => p.value);
    const rawMax = Math.max(1, ...vals);
    // Clean tick ceiling: 1, 2, 2.5, 5 × 10^k
    const mag = Math.pow(10, Math.floor(Math.log10(rawMax)));
    const steps = [1, 2, 2.5, 5, 10];
    const max = steps.map((s) => s * mag).find((m) => m >= rawMax) ?? rawMax;
    const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * (W - padL - padR));
    const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
    const xs = points.map((_, i) => x(i));
    const ys = vals.map(y);
    let path = "";
    xs.forEach((px, i) => {
      path += `${i === 0 ? "M" : "L"}${px.toFixed(1)},${ys[i].toFixed(1)}`;
    });
    const base = y(0);
    const area = n > 0 ? `${path}L${xs[n - 1].toFixed(1)},${base}L${xs[0].toFixed(1)},${base}Z` : "";
    const ticks = [0, 0.5, 1].map((f) => ({ v: max * f, y: y(max * f) }));
    return { path, area, xs, ys, ticks, max };
  }, [points, H]);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || points.length === 0) return;
    const r = el.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    let bd = Infinity;
    xs.forEach((x, i) => {
      const d = Math.abs(x - px);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    setHover(best);
  };

  const last = points.length - 1;
  const hi = hover ?? last;
  const fmtTick = (v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : `${Math.round(v)}`);

  return (
    <div className="chart" ref={ref} onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Net revenue, last 30 days">
        {ticks.map((t) => (
          <g key={t.v}>
            <line className="chart-grid" x1={padL} x2={W - padR} y1={t.y} y2={t.y} />
          </g>
        ))}
        {area && <path className="chart-area" d={area} />}
        {path && <path className="chart-line" d={path} vectorEffect="non-scaling-stroke" />}
        {points.length > 0 && (
          <>
            <line className="chart-cross" x1={xs[hi]} x2={xs[hi]} y1={padT} y2={H - padB} opacity={hover == null ? 0 : 1} />
            <circle className="chart-dot" cx={xs[hi]} cy={ys[hi]} r={4} vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      {/* Axis labels live in HTML so they never stretch with preserveAspectRatio=none. */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {ticks.map((t) => (
          <Text key={t.v} size="0" color="gray" className="num" style={{ position: "absolute", left: 0, top: `${(t.y / H) * 100}%`, transform: "translateY(-50%)" }}>
            {fmtTick(t.v)}
          </Text>
        ))}
        {points.length > 1 && (
          <>
            <Text size="0" color="gray" style={{ position: "absolute", left: `${(padL / W) * 100}%`, bottom: 0 }}>
              {shortDate(points[0].timestamp)}
            </Text>
            <Text size="0" color="gray" style={{ position: "absolute", right: `${(padR / W) * 100}%`, bottom: 0 }}>
              {shortDate(points[last].timestamp)}
            </Text>
          </>
        )}
        {points.length > 0 && (
          <div className="chart-tip" style={{ left: `${(xs[hi] / W) * 100}%`, transform: xs[hi] > W * 0.82 ? "translateX(-100%)" : xs[hi] < W * 0.12 ? "none" : "translateX(-50%)" }}>
            <Card size="1" variant="surface">
              <Text size="1" color="gray">
                {shortDate(points[hi].timestamp)}
              </Text>{" "}
              <Text size="1" weight="medium" className="num">
                {money(points[hi].value, currency)}
              </Text>
            </Card>
          </div>
        )}
      </div>
      <span style={{ display: "none" }}>{max}</span>
    </div>
  );
}
