import { Text } from "frosted-ui";
import { useId, useMemo, useRef, useState } from "react";
import { money } from "../lib/format";

interface Point { timestamp: number; value: number }

// Stats buckets are UTC days; local conversion otherwise labels them a day early.
const shortDate = (timestamp: number) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(timestamp * (timestamp < 1e12 ? 1000 : 1));

/** Reveal actual data once on entry; support the same inspection by pointer and keyboard. */
export function RevenueChart({ points, currency = "usd", height = 220, label = "Net revenue" }: { points: Point[]; currency?: string; height?: number; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const gradient = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const W = 1000, H = height, padL = 44, padR = 16, padT = 16, padB = 28;
  const { path, area, xs, ys, ticks } = useMemo(() => {
    const vals = points.map((p) => p.value);
    const rawMax = Math.max(1, ...vals);
    const mag = 10 ** Math.floor(Math.log10(rawMax));
    const max = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((m) => m >= rawMax) ?? rawMax;
    const min = Math.min(0, ...vals);
    const x = (i: number) => padL + (points.length <= 1 ? .5 : i / (points.length - 1)) * (W - padL - padR);
    const y = (v: number) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
    const xs = points.map((_, i) => x(i)), ys = vals.map(y);
    const path = xs.map((px, i) => `${i ? "L" : "M"}${px.toFixed(1)},${ys[i].toFixed(1)}`).join("");
    const area = points.length ? `${path}L${xs[xs.length - 1]},${y(0)}L${xs[0]},${y(0)}Z` : "";
    return { path, area, xs, ys, ticks: [min, (max + min) / 2, max].map((v) => ({ v, y: y(v) })) };
  }, [points, H]);
  const last = points.length - 1;
  const hi = Math.min(hover ?? last, last);
  const inspect = (clientX: number) => {
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds || last < 0) return;
    const px = (clientX - bounds.left) / bounds.width * W;
    setHover(xs.reduce((best, x, i) => Math.abs(x - px) < Math.abs(xs[best] - px) ? i : best, 0));
  };
  const tick = (v: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);
  return <div className="chart" ref={ref} style={{ height }} tabIndex={points.length ? 0 : undefined} role="group" aria-label={`${label}. Use left and right arrows to inspect daily values.`}
    onPointerMove={(e) => inspect(e.clientX)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(last)} onBlur={() => setHover(null)}
    onKeyDown={(e) => {
      if (!points.length || !["ArrowLeft", "ArrowRight", "Home", "End", "Escape"].includes(e.key)) return;
      e.preventDefault();
      if (e.key === "Escape") setHover(null);
      else setHover(e.key === "Home" ? 0 : e.key === "End" ? last : Math.max(0, Math.min(last, hi + (e.key === "ArrowLeft" ? -1 : 1))));
    }}>
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent-9)" stopOpacity=".22" /><stop offset="100%" stopColor="var(--accent-9)" stopOpacity=".015" /></linearGradient></defs>
      {ticks.map((t) => <line key={t.v} className="chart-grid" x1={padL} x2={W-padR} y1={t.y} y2={t.y} />)}
      <g className="chart-reveal" key={path}>
        {area && <path d={area} fill={`url(#${gradient})`} />}
        {path && <path className="chart-line" d={path} vectorEffect="non-scaling-stroke" />}
      </g>
      {last >= 0 && <>
        <line className="chart-cross" x1={xs[hi]} x2={xs[hi]} y1={padT} y2={H-padB} opacity={hover == null ? 0 : 1} />
        <circle className="chart-dot" cx={xs[hi]} cy={ys[hi]} r={4} />
      </>}
    </svg>
    <div className="chart-labels">
      {ticks.map((t) => <Text key={t.v} size="0" color="gray" className="num" style={{ position: "absolute", left: 0, top: `${t.y/H*100}%`, transform: "translateY(-50%)" }}>{tick(t.v)}</Text>)}
      {points.filter((_, i) => [0, Math.floor(last/2), last].includes(i)).map((p) => {
        const i = points.indexOf(p);
        return <Text key={p.timestamp} size="0" color="gray" style={{ position: "absolute", left: `${xs[i]/W*100}%`, bottom: 0, transform: i === last ? "translateX(-100%)" : i === 0 ? undefined : "translateX(-50%)" }}>{shortDate(p.timestamp)}</Text>;
      })}
      {hover != null && hi >= 0 && <div className="chart-tip" style={{ left: `${xs[hi]/W*100}%`, transform: xs[hi] > W*.78 ? "translateX(-100%)" : xs[hi] < W*.22 ? "none" : "translateX(-50%)" }}>
        <Text size="1" color="gray">{shortDate(points[hi].timestamp)}</Text><Text size="2" weight="medium" className="num">{money(points[hi].value,currency)}</Text>
      </div>}
    </div>
    <span className="sr-only" aria-live="polite">{hover != null && hi >= 0 ? `${shortDate(points[hi].timestamp)}: ${money(points[hi].value,currency)}` : ""}</span>
  </div>;
}
