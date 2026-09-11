import { Button, Dialog, toast } from "frosted-ui";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  commandString,
  invalidateAll,
  runWhopJson,
  useAccount,
  useWhop,
  withAccount,
  type Page,
} from "../lib/whop";
import { EmptyPanel, QueryBody } from "./Panel";
import { StatusBadge } from "./UserCell";

export type RecordData = { id: string; [key: string]: any };
export type FieldSpec = {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  hint?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
};
export type ActionSpec = {
  key: string;
  title: string;
  description: string;
  fields?: FieldSpec[];
  initial?: Record<string, string>;
  build: (values: Record<string, string>, requestKey: string) => string[];
  review?: (values: Record<string, string>, reviewing: boolean) => ReactNode;
  danger?: boolean;
  execute?: (args: string[], demo: boolean) => Promise<any>;
  onSuccess?: (result: any) => void;
};
export const option = (value: string, label = value.replaceAll("_", " ")) => ({
  value,
  label,
});
export function useSaved<T>(key: string, initial: T): [T, (value: T) => void] {
  const { account } = useAccount();
  const storageKey = `workspace.${account?.id}.${key}`;
  const [value, setValue] = useState<T>(() => {
    try {
      return (
        JSON.parse(sessionStorage.getItem(storageKey) ?? "null") ?? initial
      );
    } catch {
      return initial;
    }
  });
  return [
    value,
    (next: T) => {
      setValue(next);
      sessionStorage.setItem(storageKey, JSON.stringify(next));
    },
  ];
}
export function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="workspace-facts">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
export function Detail({
  title,
  subtitle,
  children,
  actions,
  onClose,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
}) {
  return (
    <section className="workspace-detail">
      <header>
        <div>
          <span className="workspace-eyebrow">DETAILS</span>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <Button
          variant="ghost"
          color="gray"
          aria-label="Close details"
          onClick={onClose}
        >
          ×
        </Button>
      </header>
      {actions && <div className="workspace-actions">{actions}</div>}
      {children}
    </section>
  );
}
export function Records({
  rows,
  onSelect,
  selected,
  label,
  secondary,
}: {
  rows: RecordData[];
  onSelect: (r: RecordData) => void;
  selected?: string;
  label?: (r: RecordData) => ReactNode;
  secondary?: (r: RecordData) => ReactNode;
}) {
  return (
    <div className="workspace-records">
      {rows.map((r) => (
        <button
          type="button"
          key={r.id}
          className="workspace-record"
          aria-pressed={r.id === selected}
          onClick={() => onSelect(r)}
        >
          <span>
            <strong>
              {label?.(r) ?? r.title ?? r.name ?? r.description ?? r.id}
            </strong>
            <small>{secondary?.(r) ?? r.id}</small>
          </span>
          <span className="workspace-record-end">
            {r.status || r.visibility ? (
              <StatusBadge status={r.status ?? r.visibility} />
            ) : null}
            <span aria-hidden>›</span>
          </span>
        </button>
      ))}
    </div>
  );
}
export function Directory({
  args,
  title,
  selected,
  onSelect,
  label,
  secondary,
  statuses,
  storageKey,
  renderRows,
}: {
  args: string[];
  title: string;
  selected?: string;
  onSelect: (r: RecordData) => void;
  label?: (r: RecordData) => ReactNode;
  secondary?: (r: RecordData) => ReactNode;
  statuses?: string[];
  storageKey: string;
  renderRows?: (rows: RecordData[]) => ReactNode;
}) {
  const [search, setSearch] = useSaved(`${storageKey}.search`, "");
  const [status, setStatus] = useSaved(`${storageKey}.status`, "all");
  const [sort, setSort] = useSaved(`${storageKey}.sort`, "default");
  const [cursor, setCursor] = useState<string | null>(null);
  const [history, setHistory] = useState<(string | null)[]>([]);
  const key = args.join("\0");
  useEffect(() => {
    setCursor(null);
    setHistory([]);
  }, [key]);
  const q = useWhop<Page<RecordData>>([
    ...args,
    ...(cursor ? [args[0] === "ledgers" ? "--cursor" : "--after", cursor] : []),
  ]);
  const rows = (q.data?.data ?? [])
    .filter(
      (r) =>
        (status === "all" || r.status === status || r.visibility === status) &&
        JSON.stringify(r).toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "name"
        ? String(a.title ?? a.name ?? a.user?.name ?? a.id).localeCompare(
            String(b.title ?? b.name ?? b.user?.name ?? b.id),
          )
        : sort === "newest"
          ? Date.parse(b.created_at ?? b.joined_at ?? "") -
            Date.parse(a.created_at ?? a.joined_at ?? "")
          : 0,
    );
  return (
    <section className="workspace-list" id={`directory-${storageKey}`}>
      <div className="workspace-list-heading">
        <h2>{title}</h2>
        <Button variant="ghost" size="1" color="gray" onClick={q.refresh}>
          Refresh
        </Button>
      </div>
      <div className="workspace-toolbar">
        <input
          aria-label={`Search ${title}`}
          placeholder={`Search ${title.toLowerCase()}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {statuses && (
          <select
            aria-label={`${title} status`}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label={`Sort ${title}`}
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="default">Default order</option>
          <option value="name">Name A–Z</option>
          <option value="newest">Newest first</option>
        </select>
      </div>
      <QueryBody q={q}>
        {() =>
          rows.length ? (
            renderRows ? (
              renderRows(rows)
            ) : (
              <Records
                rows={rows}
                selected={selected}
                onSelect={onSelect}
                label={label}
                secondary={secondary}
              />
            )
          ) : (
            <EmptyPanel
              title={
                search || status !== "all"
                  ? "No matches on this page"
                  : `No ${title.toLowerCase()} yet`
              }
              description={
                search || status !== "all"
                  ? "Clear the filters or browse another page."
                  : "New records will appear here."
              }
            />
          )
        }
      </QueryBody>
      <footer className="workspace-pagination">
        <span>
          {rows.length} of {q.data?.data?.length ?? 0} on this page · search
          filters this page
        </span>
        <div>
          <Button
            size="1"
            variant="soft"
            disabled={!history.length || q.loading}
            onClick={() => {
              setCursor(history.at(-1) ?? null);
              setHistory(history.slice(0, -1));
            }}
          >
            Previous
          </Button>
          <Button
            size="1"
            variant="soft"
            disabled={
              !q.data?.page_info?.has_next_page ||
              !q.data.page_info.end_cursor ||
              q.loading
            }
            onClick={() => {
              setHistory([...history, cursor]);
              setCursor(q.data!.page_info!.end_cursor);
            }}
          >
            Next
          </Button>
        </div>
      </footer>
    </section>
  );
}
export function Field({
  spec,
  value,
  onChange,
}: {
  spec: FieldSpec;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="workspace-field">
      <span>
        {spec.label}
        {spec.required ? " *" : ""}
      </span>
      {spec.options ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={spec.required}
        >
          <option value="">Choose…</option>
          {spec.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : spec.type === "textarea" ? (
        <textarea
          rows={5}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={spec.required}
        />
      ) : (
        <input
          type={spec.type ?? "text"}
          value={value}
          required={spec.required}
          min={spec.min}
          max={spec.max}
          step={spec.type === "number" ? "any" : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      )}{" "}
      {spec.hint && <small>{spec.hint}</small>}
    </label>
  );
}
export function ActionEditor({
  spec,
  onClose,
}: {
  spec: ActionSpec;
  onClose: () => void;
}) {
  const { account } = useAccount();
  const storageKey = `draft.${spec.key}`;
  const [values, setValues] = useSaved(storageKey, spec.initial ?? {});
  const [review, setReview] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const requestStorage = `workspace.${account?.id}.${storageKey}.request`;
  const request = useRef<{ body: string; key: string }>(
    (() => {
      try {
        return (
          JSON.parse(sessionStorage.getItem(requestStorage) ?? "null") ?? {
            body: "",
            key: crypto.randomUUID(),
          }
        );
      } catch {
        return { body: "", key: crypto.randomUUID() };
      }
    })(),
  );
  const prepare = () => {
    try {
      for (const f of spec.fields ?? [])
        if (f.required && !values[f.key]?.trim())
          throw Error(`${f.label} is required.`);
      const body = JSON.stringify(values);
      if (request.current.body !== body)
        request.current = { body, key: crypto.randomUUID() };
      sessionStorage.setItem(requestStorage, JSON.stringify(request.current));
      setReview(withAccount(spec.build(values, request.current.key), account));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    if (!spec.fields?.length) prepare();
  }, []);
  const submit = async () => {
    if (lock.current || !review || !account) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await (spec.execute ?? runWhopJson)(
        review,
        !!account.demo,
      );
      invalidateAll();
      sessionStorage.removeItem(`workspace.${account.id}.${storageKey}`);
      sessionStorage.removeItem(requestStorage);
      if (mounted.current) {
        toast.success(
          account.demo ? "Saved in the local demo" : "Change completed",
        );
        spec.onSuccess?.(result);
        onClose();
      }
    } catch (e) {
      if (mounted.current) setError((e as Error).message ?? String(e));
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <Dialog.Root
      open
      onOpenChange={(o) => {
        if (!o && !busy) onClose();
      }}
    >
      <Dialog.Content className="workspace-dialog" style={{ maxWidth: 680 }}>
        <Dialog.Title>
          {review ? "Review: " : ""}
          {spec.title}
        </Dialog.Title>
        <Dialog.Description>{spec.description}</Dialog.Description>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            review ? void submit() : prepare();
          }}
        >
          <fieldset disabled={busy}>
            {!review ? (
              <div className="workspace-form">
                {(spec.fields ?? []).map((f) => (
                  <Field
                    key={f.key}
                    spec={f}
                    value={values[f.key] ?? ""}
                    onChange={(v) => setValues({ ...values, [f.key]: v })}
                  />
                ))}
              </div>
            ) : (
              <Facts
                items={(spec.fields ?? [])
                  .filter((f) => values[f.key])
                  .map((f) => [
                    f.label,
                    f.options?.find((o) => o.value === values[f.key])?.label ??
                      values[f.key],
                  ])}
              />
            )}{" "}
            {spec.review?.(values, !!review)}
            {review && (
              <>
                <p className="workspace-notice">
                  {account?.demo
                    ? "Demo · saved on this Mac. No messages, payments, or live changes."
                    : `This changes ${account?.title ?? "the selected business"}. Review the details before confirming.`}
                </p>
                <details className="workspace-technical">
                  <summary>Inspect command</summary>
                  <code>{commandString(review)}</code>
                </details>
              </>
            )}
            {error && (
              <p role="alert" className="workspace-error">
                {error}
              </p>
            )}
            <div className="workspace-dialog-actions">
              <Button
                type="button"
                variant="soft"
                color="gray"
                disabled={busy}
                onClick={() =>
                  review && spec.fields?.length
                    ? (setReview(null), setError(""))
                    : onClose()
                }
              >
                {review
                  ? spec.fields?.length
                    ? "Back to edit"
                    : "Cancel"
                  : "Close · keep draft"}
              </Button>
              <Button
                type="submit"
                variant="classic"
                color={spec.danger ? "red" : undefined}
                disabled={!account || busy}
                loading={busy}
              >
                {review
                  ? error
                    ? "Retry change"
                    : "Confirm change"
                  : "Review change"}
              </Button>
            </div>
          </fieldset>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
export function ReadDetails({
  args,
  title,
  select,
}: {
  args: string[];
  title: string;
  select?: (data: any) => any;
}) {
  const q = useWhop<any>(args);
  return (
    <div className="workspace-section">
      <h3>{title}</h3>
      <QueryBody q={q}>
        {(d) => <Readable value={select ? select(d) : d} />}
      </QueryBody>
    </div>
  );
}
export function Readable({ value }: { value: any }) {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Array.isArray(value.data)
  )
    return <Readable value={value.data} />;
  if (value == null)
    return <p className="workspace-muted">No details returned.</p>;
  if (Array.isArray(value))
    return value.length ? (
      <div className="workspace-result-list">
        {value.map((v, i) => (
          <div key={v?.id ?? i}>
            <Readable value={v} />
          </div>
        ))}
      </div>
    ) : (
      <p className="workspace-muted">No records yet.</p>
    );
  if (typeof value === "object")
    return (
      <dl className="workspace-facts">
        {Object.entries(value)
          .filter(([k, v]) => k !== "page_info" && v != null)
          .map(([k, v]) => (
            <div key={k}>
              <dt>{k.replaceAll("_", " ")}</dt>
              <dd>
                {typeof v === "object" ? <Readable value={v} /> : String(v)}
              </dd>
            </div>
          ))}
      </dl>
    );
  return <p>{String(value)}</p>;
}
export function Placeholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="workspace-detail workspace-placeholder">
      <span className="workspace-eyebrow">WORKSPACE</span>
      <EmptyPanel title={title} description={description} />
    </section>
  );
}

export function RecordTable({
  rows,
  columns,
  onSelect,
  canSelect,
}: {
  canSelect?: (r: RecordData) => boolean;
  rows: RecordData[];
  columns: { label: string; render: (r: RecordData) => ReactNode }[];
  onSelect: (r: RecordData) => void;
}) {
  return (
    <div className="business-table-wrap">
      <table className="business-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.label}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {columns.map((c, i) => (
                <td key={c.label}>
                  {i === 0 && (canSelect?.(r) ?? true) ? (
                    <button
                      className="business-record-link"
                      onClick={() => onSelect(r)}
                    >
                      {c.render(r)}
                    </button>
                  ) : (
                    c.render(r)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function RecordDialog({
  title,
  subtitle,
  children,
  open = true,
  onClose,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  open?: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <Dialog.Content
        className="business-dialog"
        style={{ maxWidth: 820, overflowY: "auto" }}
      >
        <Dialog.Title className="sr-only">{title}</Dialog.Title>
        <Dialog.Description className="sr-only">{subtitle}</Dialog.Description>
        {children}
      </Dialog.Content>
    </Dialog.Root>
  );
}
