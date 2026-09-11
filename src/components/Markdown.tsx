import { Code, Text } from "frosted-ui";
import type { ReactNode } from "react";

/** Minimal, safe markdown: paragraphs, bullet/numbered lists, headings, bold, inline code, fenced code. */
export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    const cells = (row: string) =>
      row
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => c.trim());
    const tableStart = (n: number) =>
      n + 1 < lines.length &&
      lines[n].includes("|") &&
      cells(lines[n + 1]).every((c) => /^:?-{3,}:?$/.test(c));
    if (tableStart(i)) {
      const headers = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim())
        rows.push(cells(lines[i++]));
      out.push(
        <div className="md-table-wrap" key={key++}>
          <table>
            <thead>
              <tr>
                {headers.map((h, n) => (
                  <th key={n}>{inline(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, n) => (
                <tr key={n}>
                  {headers.map((_, c) => (
                    <td key={c}>{inline(r[c] ?? "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (line.startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```"))
        buf.push(lines[i++]);
      i++;
      out.push(
        <pre key={key++} className="md-pre">
          {buf.join("\n")}
        </pre>,
      );
      continue;
    }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
      const items: string[] = [];
      const ordered = /^\s*\d+[.)]/.test(line);
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i]))
        items.push(lines[i++].replace(/^\s*([-*•]|\d+[.)])\s+/, ""));
      out.push(
        ordered ? (
          <ol key={key++} className="md-list">
            {items.map((it, k) => (
              <li key={k}>{inline(it)}</li>
            ))}
          </ol>
        ) : (
          <ul key={key++} className="md-list">
            {items.map((it, k) => (
              <li key={k}>{inline(it)}</li>
            ))}
          </ul>
        ),
      );
      continue;
    }
    const h = /^(#{1,3})\s+(.*)/.exec(line);
    if (h) {
      out.push(
        <Text
          key={key++}
          size="3"
          weight="medium"
          style={{ display: "block", marginTop: 8 }}
        >
          {inline(h[2])}
        </Text>,
      );
      i++;
      continue;
    }
    if (line.trim() === "") {
      i++;
      continue;
    }
    const buf: string[] = [];
    while (
      i < lines.length &&
      !tableStart(i) &&
      lines[i].trim() !== "" &&
      !/^\s*([-*•]|\d+[.)])\s+/.test(lines[i]) &&
      !lines[i].startsWith("```") &&
      !/^#{1,3}\s/.test(lines[i])
    )
      buf.push(lines[i++]);
    out.push(
      <p key={key++} className="md-p">
        {inline(buf.join(" "))}
      </p>,
    );
  }
  return <div className="md">{out}</div>;
}

function inline(s: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("`"))
      parts.push(
        <Code key={k++} size="1" variant="soft" color="gray">
          {tok.slice(1, -1)}
        </Code>,
      );
    else parts.push(<strong key={k++}>{tok.slice(2, -2)}</strong>);
    last = m.index + tok.length;
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts;
}

/** Colors JSON tokens with Frosted tokens; falls back to plain text. */
export function JsonText({ text }: { text: string }) {
  const trimmed = text.trim();
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return <>{text}</>;
  const re =
    /("(?:[^"\\]|\\.)*")(\s*:)?|(\b-?\d+(?:\.\d+)?(?:e[+-]?\d+)?\b)|(\btrue\b|\bfalse\b|\bnull\b)/g;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) {
      out.push(
        <span key={k++} className={m[2] ? "j-key" : "j-str"}>
          {m[1]}
        </span>,
      );
      if (m[2]) out.push(m[2]);
    } else if (m[3])
      out.push(
        <span key={k++} className="j-num">
          {m[3]}
        </span>,
      );
    else if (m[4])
      out.push(
        <span key={k++} className="j-lit">
          {m[4]}
        </span>,
      );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
