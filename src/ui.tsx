import React, {
  useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import { useOverlay, useSort, compareValues, fmtDate, type SortState } from './state';

/* ------------------------------------------------------------------ icons */
/* One stroke weight, one 16-unit box, so every glyph sits on the same grid. */

type IconProps = { className?: string };
const svg = (path: React.ReactNode, extra?: Record<string, unknown>) =>
  function Glyph({ className }: IconProps) {
    return (
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={className}
        {...extra}
      >
        {path}
      </svg>
    );
  };

export const IconSearch = svg(<><circle cx="7" cy="7" r="4.4" /><path d="M10.4 10.4 14 14" /></>);
export const IconClose = svg(<path d="M4 4l8 8M12 4l-8 8" />);
export const IconCheck = svg(<path d="M3.2 8.4 6.3 11.5 12.8 5" />);
export const IconChevronDown = svg(<path d="M4 6.2 8 10.2l4-4" />);
export const IconChevronRight = svg(<path d="M6.2 4 10.2 8l-4 4" />);
export const IconArrowUp = svg(<path d="M8 12.5V3.5M4.2 7.3 8 3.5l3.8 3.8" />);
export const IconAlert = svg(<><path d="M8 5v4" /><circle cx="8" cy="11.4" r="0.55" fill="currentColor" stroke="none" /><circle cx="8" cy="8" r="6.2" /></>);
export const IconInfo = svg(<><path d="M8 7.4v3.8" /><circle cx="8" cy="5.1" r="0.55" fill="currentColor" stroke="none" /><circle cx="8" cy="8" r="6.2" /></>);
export const IconCheckCircle = svg(<><circle cx="8" cy="8" r="6.2" /><path d="M5.3 8.2 7.2 10.1 10.8 6.1" /></>);
export const IconSun = svg(<><circle cx="8" cy="8" r="3" /><path d="M8 1.4v1.5M8 13.1v1.5M1.4 8h1.5M13.1 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M12.6 3.4l-1 1M4.4 11.6l-1 1" /></>);
export const IconMoon = svg(<path d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.7 5.7 0 1 0 6.8 6.8Z" />);
export const IconSidebar = svg(<><rect x="1.8" y="2.8" width="12.4" height="10.4" rx="1.6" /><path d="M10 2.8v10.4" /></>);
export const IconRows = svg(<><path d="M2.2 4.4h11.6M2.2 8h11.6M2.2 11.6h11.6" /></>);
export const IconInbox = svg(<><path d="M2 9.2h3l1 1.8h4l1-1.8h3" /><path d="M3.6 3.2h8.8l1.6 6v3.6H2V9.2Z" /></>);
export const IconCalendar = svg(<><rect x="2.2" y="3.4" width="11.6" height="10.4" rx="1.6" /><path d="M2.2 6.6h11.6M5.4 1.9v2.6M10.6 1.9v2.6" /></>);
export const IconBook = svg(<><path d="M2.6 3.2h4a2 2 0 0 1 2 2v8a1.6 1.6 0 0 0-1.6-1.6H2.6Z" /><path d="M13.4 3.2h-4a2 2 0 0 0-2 2v8a1.6 1.6 0 0 1 1.6-1.6h4.4Z" /></>);

/* ------------------------------------------------------------------ panel */

export function Panel({
  title, sub, actions, children, className = '', footer, style, id,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  /** Controls that belong to this card, shown beside its title. */
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
  style?: React.CSSProperties;
  id?: string;
}) {
  return (
    <section className={`lt-panel ${className}`} style={style} id={id}>
      <header className="lt-panel-title">
        <div className="lt-title-main"><span>{title}</span></div>
        {sub || actions ? (
          <div className="lt-sub">
            {sub ? <span>{sub}</span> : null}
            {actions}
          </div>
        ) : null}
      </header>
      <div className="lt-panel-body">{children}</div>
      {footer ? <footer className="lt-panel-foot">{footer}</footer> : null}
    </section>
  );
}

/* --------------------------------------------------------------- feedback */

export function Spinner({ large }: { large?: boolean }) {
  return <span className={`lt-spinner ${large ? 'is-lg' : ''}`} role="presentation" />;
}

export function Loading({ what = 'Loading' }: { what?: string }) {
  return (
    <div className="lt-loading" role="status" aria-live="polite">
      <Spinner />
      <span>{what}...</span>
    </div>
  );
}

/** A table-shaped placeholder, so the page does not jump when data lands. */
export function SkeletonTable({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="lt-skeleton-table" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, r) => (
        <div className="lt-skeleton-row" key={r}>
          {Array.from({ length: cols }, (_, c) => (
            <div className="lt-skeleton" key={c} style={{ opacity: 1 - r * 0.1 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title, note, action, icon,
}: { title: React.ReactNode; note?: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="lt-empty">
      {icon ?? <IconInbox />}
      <div className="lt-empty-title">{title}</div>
      {note ? <div className="lt-empty-note">{note}</div> : null}
      {action}
    </div>
  );
}

export function Alert({
  tone = 'info', children, icon = true,
}: { tone?: 'info' | 'error' | 'warn' | 'success'; children: React.ReactNode; icon?: boolean }) {
  const Glyph = tone === 'error' || tone === 'warn' ? IconAlert : tone === 'success' ? IconCheckCircle : IconInfo;
  return (
    <div className={`lt-alert is-${tone}`} role={tone === 'error' ? 'alert' : undefined}>
      {icon ? <Glyph /> : null}
      <div>{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------- stat tiles */

export function StatTile({
  label, value, note, tone, onClick, keys,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  note?: React.ReactNode;
  tone?: 'good' | 'bad';
  onClick?: () => void;
  keys?: string;
}) {
  const body = (
    <>
      <span className="lt-tile-label">{label}</span>
      <span className="lt-tile-value">{value}</span>
      {note ? <span className="lt-tile-note">{note}</span> : null}
    </>
  );
  const cls = `lt-tile ${tone ? `is-${tone}` : ''}`;
  if (!onClick) return <div className={cls}>{body}</div>;
  return (
    <button type="button" className={cls} onClick={onClick} title={keys ? `Shortcut: ${keys}` : undefined}>
      {body}
    </button>
  );
}

/* ------------------------------------------------------------ search box */

export function SearchInput({
  value, onChange, placeholder = 'Search', autoFocus, ariaLabel, style, block, onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  ariaLabel?: string;
  style?: React.CSSProperties;
  /** Fill the width of the container rather than sitting inline. */
  block?: boolean;
  onEnter?: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className={`lt-search ${block ? 'is-block' : ''}`} style={style}>
      <IconSearch />
      <input
        ref={ref}
        type="search"
        className="lt-search-input"
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Esc clears the box first; only an already-empty box lets Esc
          // through to the screen's own "go back".
          if (e.key === 'Escape' && value) { e.stopPropagation(); e.preventDefault(); onChange(''); }
          else if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter(); }
        }}
      />
      {value ? (
        <button
          type="button"
          className="lt-clear"
          aria-label="Clear the search"
          title="Clear"
          onClick={() => { onChange(''); ref.current?.focus(); }}
        >
          <IconClose />
        </button>
      ) : null}
    </div>
  );
}

/** A checkbox that reads as a filter chip rather than a bare tick box. */
export function CheckChip({
  checked, onChange, children,
}: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`lt-check ${checked ? 'is-on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="lt-check-box">{checked ? <IconCheck /> : null}</span>
      <span>{children}</span>
    </button>
  );
}

/* -------------------------------------------------------------- nav menu */

export type MenuEntry =
  | { kind: 'section'; label: string }
  | { kind: 'rule' }
  | {
      kind?: 'item';
      label: string;
      note?: React.ReactNode;
      onSelect: () => void;
      disabled?: boolean;
      align?: 'right';
      /** Extra words the filter box should match on. */
      keywords?: string;
    };

type Selectable = Extract<MenuEntry, { label: string; onSelect: () => void }>;

const isItem = (e: MenuEntry): e is Selectable =>
  !('kind' in e) || e.kind === 'item' || (e as { onSelect?: unknown }).onSelect !== undefined;

/** Highlights the first letter of the label that is not already a shortcut. */
function hotIndexes(entries: MenuEntry[]): Map<number, number> {
  const used = new Set<string>();
  const map = new Map<number, number>();
  entries.forEach((e, i) => {
    if (!isItem(e) || e.disabled) return;
    const label = e.label;
    for (let c = 0; c < label.length; c++) {
      const ch = label[c].toLowerCase();
      if (!/[a-z0-9]/.test(ch)) continue;
      if (!used.has(ch)) {
        used.add(ch);
        map.set(i, c);
        return;
      }
    }
  });
  return map;
}

export function HotLabel({ label, at }: { label: string; at?: number }) {
  if (at === undefined || at < 0) return <span>{label}</span>;
  return (
    <span>
      {label.slice(0, at)}
      <span className="lt-hot">{label[at]}</span>
      {label.slice(at + 1)}
    </span>
  );
}

export function NavMenu({
  entries, autoFocus = true, filterAfter = 14, filterLabel = 'Filter this list',
}: {
  entries: MenuEntry[];
  autoFocus?: boolean;
  /** Show a filter box once the menu has more than this many items. */
  filterAfter?: number;
  filterLabel?: string;
}) {
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const itemCount = useMemo(() => entries.filter(isItem).length, [entries]);
  const showFilter = itemCount > filterAfter;

  /* Filtering drops the sections that end up empty. */
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    const kept = entries.filter(
      (e) => isItem(e) && `${e.label} ${e.keywords || ''}`.toLowerCase().includes(q),
    );
    return kept;
  }, [entries, query]);

  const hots = useMemo(() => hotIndexes(shown), [shown]);
  const selectableIdx = useMemo(
    () => shown.map((e, i) => (isItem(e) && !e.disabled ? i : -1)).filter((i) => i >= 0),
    [shown],
  );
  const [cursor, setCursor] = useState(selectableIdx[0] ?? -1);

  useEffect(() => {
    setCursor(selectableIdx[0] ?? -1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectableIdx.join(',')]);

  useEffect(() => {
    // Focusing must not drag a tall panel's scroll container with it.
    if (autoFocus && !showFilter) ref.current?.focus({ preventScroll: true });
  }, [autoFocus, showFilter]);

  useEffect(() => {
    listRef.current?.querySelector('.lt-menu-item.is-selected')?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const move = (delta: number) => {
    if (!selectableIdx.length) return;
    const pos = selectableIdx.indexOf(cursor);
    const next = selectableIdx[(pos + delta + selectableIdx.length) % selectableIdx.length];
    setCursor(next ?? -1);
  };

  const activate = (i: number) => {
    const e = shown[i];
    if (isItem(e) && !e.disabled) e.onSelect();
  };

  const onKeyDown = (ev: React.KeyboardEvent) => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); move(1); return; }
    if (ev.key === 'ArrowUp') { ev.preventDefault(); move(-1); return; }
    if (ev.key === 'PageDown') { ev.preventDefault(); move(5); return; }
    if (ev.key === 'PageUp') { ev.preventDefault(); move(-5); return; }
    if (ev.key === 'Home') { ev.preventDefault(); setCursor(selectableIdx[0]); return; }
    if (ev.key === 'End') { ev.preventDefault(); setCursor(selectableIdx[selectableIdx.length - 1]); return; }
    if (ev.key === 'Enter') { ev.preventDefault(); activate(cursor); return; }
    // The highlighted letter picks an entry - but only when nothing is typed
    // into the filter box, where letters belong to the query.
    if (!showFilter && ev.key.length === 1 && /[a-z0-9]/i.test(ev.key)) {
      const ch = ev.key.toLowerCase();
      const match = selectableIdx.find((i) => {
        const at = hots.get(i);
        const e = shown[i] as Selectable;
        return at !== undefined && e.label[at]?.toLowerCase() === ch;
      });
      if (match !== undefined) {
        ev.preventDefault();
        setCursor(match);
        activate(match);
      }
    }
  };

  return (
    <div className="lt-menu" ref={ref} tabIndex={showFilter ? -1 : 0} onKeyDown={onKeyDown}>
      {showFilter ? (
        <div className="lt-menu-filter">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={filterLabel}
            ariaLabel={filterLabel}
            autoFocus={autoFocus}
            block
          />
        </div>
      ) : null}

      <div ref={listRef} role="menu">
        {shown.map((e, i) => {
          if ('kind' in e && e.kind === 'section') {
            return <div className="lt-menu-section" key={`s${i}`}>{e.label}</div>;
          }
          if ('kind' in e && e.kind === 'rule') {
            return <div className="lt-menu-rule" key={`r${i}`} />;
          }
          const item = e as Selectable;
          const cls = [
            'lt-menu-item',
            cursor === i ? 'is-selected' : '',
            item.disabled ? 'is-disabled' : '',
            item.align === 'right' ? 'lt-right-align' : '',
          ].filter(Boolean).join(' ');
          return (
            <button
              type="button"
              role="menuitem"
              key={`${item.label}-${i}`}
              className={cls}
              tabIndex={-1}
              onMouseEnter={() => !item.disabled && setCursor(i)}
              onClick={() => activate(i)}
              disabled={item.disabled}
            >
              <HotLabel label={item.label} at={hots.get(i)} />
              {item.note !== undefined ? <span className="lt-count">{item.note}</span> : null}
            </button>
          );
        })}
        {!shown.length ? (
          <div className="lt-empty" style={{ padding: '26px 14px' }}>
            <div className="lt-empty-note">Nothing matches &ldquo;{query}&rdquo;.</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ table */

export interface Column<T> {
  /** Stable id, needed only when the column can be sorted. */
  key?: string;
  header: React.ReactNode;
  cell: (row: T, index: number) => React.ReactNode;
  /** Returning a value here makes the column sortable. */
  sortValue?: (row: T) => unknown;
  num?: boolean;
  width?: string | number;
  className?: string;
}

export function DataTable<T>({
  columns, rows, rowKey, onRowClick, rowClass, footer, empty,
  selectedIndex, onSelectedIndexChange, onSelectedRowChange,
  loading, zebra = true, defaultSort, tall, caption,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, i: number) => React.Key;
  onRowClick?: (row: T, i: number) => void;
  rowClass?: (row: T, i: number) => string;
  footer?: React.ReactNode;
  empty?: React.ReactNode;
  selectedIndex?: number;
  onSelectedIndexChange?: (i: number) => void;
  /** Receives the row the cursor is on, already in display (sorted) order. */
  onSelectedRowChange?: (row: T | null) => void;
  loading?: boolean;
  zebra?: boolean;
  defaultSort?: SortState;
  /** Lets the table grow instead of scrolling inside a fixed height. */
  tall?: boolean;
  caption?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const { sort, toggle } = useSort(defaultSort);

  const sortable = useMemo(
    () => new Map(columns.filter((c) => c.sortValue && c.key).map((c) => [c.key!, c.sortValue!])),
    [columns],
  );

  const view = useMemo(() => {
    if (!sort || !sortable.has(sort.key)) return rows;
    const get = sortable.get(sort.key)!;
    const sign = sort.dir === 'asc' ? 1 : -1;
    return [...rows]
      .map((row, i) => ({ row, i }))
      .sort((a, b) => compareValues(get(a.row), get(b.row)) * sign || a.i - b.i)
      .map((x) => x.row);
  }, [rows, sort, sortable]);

  /* Tell the screen which record the cursor sits on, so its side buttons
     act on what the user can actually see. */
  const lastReported = useRef<T | null>(null);
  useEffect(() => {
    if (!onSelectedRowChange) return;
    const row = selectedIndex === undefined ? null : (view[selectedIndex] ?? null);
    if (row === lastReported.current) return;
    lastReported.current = row;
    onSelectedRowChange(row);
  }, [view, selectedIndex, onSelectedRowChange]);

  useEffect(() => {
    if (selectedIndex === undefined || !onSelectedIndexChange) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const last = view.length - 1;
      const clamp = (n: number) => Math.max(0, Math.min(last, n));
      if (e.key === 'ArrowDown') { e.preventDefault(); onSelectedIndexChange(clamp(selectedIndex + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); onSelectedIndexChange(clamp(selectedIndex - 1)); }
      else if (e.key === 'PageDown') { e.preventDefault(); onSelectedIndexChange(clamp(selectedIndex + 10)); }
      else if (e.key === 'PageUp') { e.preventDefault(); onSelectedIndexChange(clamp(selectedIndex - 10)); }
      else if (e.key === 'Home') { e.preventDefault(); onSelectedIndexChange(0); }
      else if (e.key === 'End') { e.preventDefault(); onSelectedIndexChange(last); }
      else if (e.key === 'Enter' && onRowClick && view[selectedIndex]) {
        e.preventDefault();
        onRowClick(view[selectedIndex], selectedIndex);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedIndex, view, onRowClick, onSelectedIndexChange]);

  /* Arrow keys must bring the highlighted row with them. */
  useEffect(() => {
    if (selectedIndex === undefined) return;
    wrapRef.current
      ?.querySelector('tbody tr.is-selected')
      ?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, view]);

  if (loading) {
    return (
      <div className="lt-table-wrap">
        <SkeletonTable cols={Math.min(columns.length, 6)} />
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="lt-table-wrap">
        {typeof empty === 'string' || empty === undefined
          ? <EmptyState title={empty || 'There is nothing to show here.'} />
          : empty}
      </div>
    );
  }

  return (
    <div className={`lt-table-wrap ${tall ? 'lt-tall' : ''}`} ref={wrapRef}>
      <table className={`lt-table ${zebra ? 'is-zebra' : ''}`}>
        {caption ? <caption className="lt-sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((c, i) => {
              const canSort = !!(c.sortValue && c.key);
              const active = canSort && sort?.key === c.key;
              return (
                <th
                  key={c.key || i}
                  scope="col"
                  className={[c.num ? 'num' : '', canSort ? 'is-sortable' : ''].filter(Boolean).join(' ')}
                  style={c.width ? { width: c.width } : undefined}
                  aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {canSort ? (
                    <button type="button" onClick={() => toggle(c.key!)}>
                      <span>{c.header}</span>
                      <IconArrowUp className="lt-sort-ind" />
                    </button>
                  ) : c.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {view.map((row, i) => (
            <tr
              key={rowKey(row, i)}
              className={[
                rowClass?.(row, i) || '',
                onRowClick ? 'is-clickable' : '',
                selectedIndex === i ? 'is-selected' : '',
              ].filter(Boolean).join(' ')}
              aria-selected={selectedIndex === i || undefined}
              onClick={() => {
                onSelectedIndexChange?.(i);
                onRowClick?.(row, i);
              }}
            >
              {columns.map((c, ci) => (
                <td key={c.key || ci} className={[c.num ? 'num' : '', c.className || ''].filter(Boolean).join(' ')}>
                  {c.cell(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer ? <tfoot>{footer}</tfoot> : null}
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ field */

const FieldCtx = React.createContext<{ id: string; describedBy?: string } | null>(null);

export function Field({
  label, children, hint, error, wide, required, htmlFor,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  wide?: boolean;
  required?: boolean;
  htmlFor?: string;
}) {
  const auto = useId();
  const id = htmlFor || auto;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const ctx = useMemo(
    () => ({ id, describedBy: [hintId, errorId].filter(Boolean).join(' ') || undefined }),
    [id, hintId, errorId],
  );
  /* Label, control, hint and error travel as one block, so a two-column form
     keeps each hint under the field it belongs to. */
  return (
    <FieldCtx.Provider value={ctx}>
      <div className={`lt-field-group ${wide ? 'is-wide' : ''}`}>
        <div className={`lt-field ${wide ? 'lt-field-wide' : ''}`}>
          <label htmlFor={id}>
            {label}
            {required ? <span className="lt-req" aria-hidden="true">*</span> : null}
          </label>
          <div className="lt-control">{children}</div>
        </div>
        {hint ? <div className="lt-hint" id={hintId}>{hint}</div> : null}
        {error ? (
          <div className="lt-error-text" id={errorId}><IconAlert /><span>{error}</span></div>
        ) : null}
      </div>
    </FieldCtx.Provider>
  );
}

/** Lets a control inside <Field> pick up the generated id and descriptions. */
export const useFieldIds = () => React.useContext(FieldCtx);

/** An <input> that adopts the surrounding <Field>'s id, so its label works. */
export function FieldInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const ctx = useFieldIds();
  return <input id={ctx?.id} aria-describedby={ctx?.describedBy} {...props} />;
}

/** The textarea counterpart of FieldInput. */
export function FieldTextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ctx = useFieldIds();
  return <textarea id={ctx?.id} aria-describedby={ctx?.describedBy} {...props} />;
}

export function TextField({
  label, value, onChange, placeholder, hint, error, type = 'text', disabled, autoFocus,
  maxWidth, required, suffix, onBlur, inputMode, max, min, step,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  type?: 'text' | 'number' | 'date' | 'email';
  disabled?: boolean;
  autoFocus?: boolean;
  maxWidth?: number;
  required?: boolean;
  suffix?: React.ReactNode;
  onBlur?: () => void;
  inputMode?: 'text' | 'numeric' | 'decimal' | 'email' | 'tel';
  max?: number | string;
  min?: number | string;
  step?: number | string;
}) {
  /* A date is never a plain text box - it gets the application's own field,
     which shows 21-Apr-26 and opens the in-app calendar. */
  if (type === 'date') {
    return (
      <Field label={label} hint={hint} error={error} required={required}>
        <DateInput
          value={value as string}
          onChange={onChange}
          disabled={disabled}
          invalid={!!error}
          autoFocus={autoFocus}
          width={maxWidth || 168}
        />
        {suffix ? <span className="lt-suffix">{suffix}</span> : null}
      </Field>
    );
  }

  return (
    <Field label={label} hint={hint} error={error} required={required}>
      <FieldInput
        type={type}
        className={[type === 'number' ? 'num' : '', error ? 'is-invalid' : ''].filter(Boolean).join(' ')}
        value={value as string}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        required={required}
        inputMode={inputMode}
        max={max}
        min={min}
        step={step}
        aria-invalid={error ? true : undefined}
        style={maxWidth ? { maxWidth } : undefined}
        onBlur={onBlur}
        onChange={(e) => onChange(e.target.value)}
      />
      {suffix ? <span className="lt-suffix">{suffix}</span> : null}
    </Field>
  );
}

export function TextAreaField({
  label, value, onChange, hint, rows, placeholder, mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: React.ReactNode;
  rows?: number;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <Field label={label} hint={hint} wide>
      <FieldTextArea
        value={value}
        rows={rows}
        placeholder={placeholder}
        spellCheck={!mono}
        style={mono ? { fontFamily: 'var(--mono)', fontSize: 12.5 } : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

/* --------------------------------------------------------------- dropdown */

export interface DropdownOption {
  value: string | number;
  label: string;
  note?: string;
}

/** Wraps the part of `text` that matches `query` so the eye finds it fast. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const at = text.toLowerCase().indexOf(q.toLowerCase());
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="lt-mark">{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  );
}

/**
 * Replaces the native select. Opens on click, Enter, Space or Arrow Down;
 * moves with the arrow keys, filters as you type and closes on Escape.
 */
export function Dropdown({
  value, onChange, options, disabled, allowBlank, blankLabel = 'Not Applicable',
  placeholder = 'Select...', width, size = 'md', invalid, ariaLabel, id,
}: {
  value: string | number | null;
  onChange: (v: string) => void;
  options: DropdownOption[];
  disabled?: boolean;
  allowBlank?: boolean;
  blankLabel?: string;
  placeholder?: string;
  width?: number | string;
  size?: 'sm' | 'md';
  invalid?: boolean;
  ariaLabel?: string;
  id?: string;
}) {
  const field = useFieldIds();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; width: number; maxH: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useOverlay(open);

  const rows = useMemo<DropdownOption[]>(() => {
    const base = allowBlank ? [{ value: '', label: blankLabel }, ...options] : options;
    const q = query.trim().toLowerCase();
    if (!q) return base;
    // Entries that start with the query are the ones the user usually means.
    const starts: DropdownOption[] = [];
    const contains: DropdownOption[] = [];
    for (const o of base) {
      const l = o.label.toLowerCase();
      if (l.startsWith(q)) starts.push(o);
      else if (l.includes(q) || (o.note || '').toLowerCase().includes(q)) contains.push(o);
    }
    return [...starts, ...contains];
  }, [options, query, allowBlank, blankLabel]);

  const searchable = (allowBlank ? options.length + 1 : options.length) > 7;
  const current = options.find((o) => String(o.value) === String(value ?? ''));

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 4;
    const below = window.innerHeight - r.bottom - gap - 8;
    const above = r.top - gap - 8;
    const dropUp = below < 190 && above > below;
    setPos({
      top: dropUp ? undefined : r.bottom + gap,
      bottom: dropUp ? window.innerHeight - r.top + gap : undefined,
      left: Math.max(8, Math.min(r.left, window.innerWidth - Math.max(r.width, 200) - 8)),
      width: Math.max(r.width, 200),
      maxH: Math.max(160, Math.min(330, dropUp ? above : below)),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onScroll = () => place();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const idx = rows.findIndex((o) => String(o.value) === String(value ?? ''));
    setCursor(idx >= 0 ? idx : 0);
    const t = setTimeout(() => {
      if (searchable) searchRef.current?.focus({ preventScroll: true });
      else popRef.current?.focus({ preventScroll: true });
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  }, [cursor, open]);

  const choose = (o: DropdownOption) => {
    onChange(String(o.value));
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(rows.length - 1, c + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
    else if (e.key === 'PageDown') { e.preventDefault(); setCursor((c) => Math.min(rows.length - 1, c + 8)); }
    else if (e.key === 'PageUp') { e.preventDefault(); setCursor((c) => Math.max(0, c - 8)); }
    else if (e.key === 'Home') { e.preventDefault(); setCursor(0); }
    else if (e.key === 'End') { e.preventDefault(); setCursor(rows.length - 1); }
    else if (e.key === 'Enter' || (e.key === 'Tab' && rows[cursor])) {
      e.preventDefault();
      if (rows[cursor]) choose(rows[cursor]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    } else if (!searchable && e.key.length === 1 && /\S/.test(e.key)) {
      const ch = e.key.toLowerCase();
      const start = rows.findIndex((o, i) => i > cursor && o.label.toLowerCase().startsWith(ch));
      const idx = start >= 0 ? start : rows.findIndex((o) => o.label.toLowerCase().startsWith(ch));
      if (idx >= 0) setCursor(idx);
    }
  };

  const activeId = rows[cursor] ? `${listId}-${cursor}` : undefined;

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        id={id || field?.id}
        className={[
          'lt-select',
          size === 'sm' ? 'lt-select-sm' : '',
          open ? 'is-open' : '',
          invalid ? 'is-invalid' : '',
          current || (allowBlank && value === '') ? '' : 'is-placeholder',
        ].filter(Boolean).join(' ')}
        style={width ? { width, maxWidth: '100%' } : undefined}
        disabled={disabled}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        aria-describedby={field?.describedBy}
        aria-invalid={invalid || undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="lt-select-value">
          {current ? current.label : value === '' && allowBlank ? blankLabel : placeholder}
        </span>
        <IconChevronDown className="lt-select-chevron" />
      </button>

      {open && pos ? (
        <div
          ref={popRef}
          className="lt-dropdown"
          tabIndex={-1}
          onKeyDown={onKeyDown}
          style={{ top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width, maxHeight: pos.maxH }}
        >
          {searchable ? (
            <div className="lt-dropdown-search">
              <input
                ref={searchRef}
                value={query}
                placeholder="Type to filter..."
                aria-label="Filter the list"
                aria-controls={listId}
                aria-activedescendant={activeId}
                onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
                onKeyDown={onKeyDown}
              />
            </div>
          ) : null}
          <div className="lt-dropdown-list" ref={listRef} role="listbox" id={listId}>
            {rows.length === 0 ? <div className="lt-dropdown-empty">No matches for &ldquo;{query}&rdquo;</div> : null}
            {rows.map((o, i) => {
              const selected = String(o.value) === String(value ?? '');
              return (
                <div
                  key={`${o.value}`}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={selected}
                  className={[
                    'lt-dropdown-item',
                    i === cursor ? 'is-active' : '',
                    selected ? 'is-selected' : '',
                  ].filter(Boolean).join(' ')}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => choose(o)}
                >
                  <span className="lt-dropdown-label"><Highlight text={o.label} query={query} /></span>
                  {o.note ? <span className="lt-dropdown-note">{o.note}</span> : null}
                  {selected ? <IconCheck className="lt-select-tick" /> : null}
                </div>
              );
            })}
          </div>
          {searchable ? (
            <div className="lt-dropdown-foot">
              <span>{rows.length} of {options.length}</span>
              <span style={{ marginLeft: 'auto' }}>Enter to choose &middot; Esc to close</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/* --------------------------------------------------------------- dates */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function fromIso(s: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(s ?? ''));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const addMonths = (d: Date, n: number) => {
  const x = new Date(d.getFullYear(), d.getMonth() + n, 1);
  // Keep the day where the target month is long enough for it.
  x.setDate(Math.min(d.getDate(), new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()));
  return x;
};

/** Builds a date only if the parts describe a real one (31 Feb is rejected). */
function buildDate(day: number, month: number, year: number): string | null {
  let y = year;
  if (y < 100) y += y >= 70 ? 1900 : 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(y, month - 1, day);
  if (d.getFullYear() !== y || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return toIso(d);
}

/**
 * Reads a date the way an accountant would type one. Returns an ISO date,
 * '' to clear the field, or null when the text is not a date at all.
 *
 *   21-4-26   21/4/2026   21.4.26   21 4 26   210426   21042026
 *   21-Apr-26   21 apr   apr 21 2026   2026-04-21   t   today   21
 *
 * A bare day, or a day and month with no year, is completed from `ref` - the
 * date the field already holds - so "21" on a voucher means the 21st of the
 * month being worked on.
 */
export function parseDateInput(raw: string, ref: Date): string | null {
  const t = String(raw ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!t) return '';
  if (t === 't' || t === 'today') return toIso(new Date());
  if (t === 'y' || t === 'yesterday') return toIso(addDays(new Date(), -1));

  const month = (name: string) => MONTHS.findIndex((m) => m.toLowerCase() === name.slice(0, 3)) + 1;
  let m: RegExpExecArray | null;

  // 2026-04-21
  m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(t);
  if (m) return buildDate(+m[3], +m[2], +m[1]);

  // 21-Apr-26, 21 apr 2026, 21apr
  m = /^(\d{1,2})[-/. ]?([a-z]{3,9})[-/. ]?(\d{2}|\d{4})?$/.exec(t);
  if (m) {
    const mo = month(m[2]);
    if (mo) return buildDate(+m[1], mo, m[3] ? +m[3] : ref.getFullYear());
  }

  // Apr 21 2026
  m = /^([a-z]{3,9})[-/. ]?(\d{1,2})[-/. ]?(\d{2}|\d{4})?$/.exec(t);
  if (m) {
    const mo = month(m[1]);
    if (mo) return buildDate(+m[2], mo, m[3] ? +m[3] : ref.getFullYear());
  }

  // 21-4-26, 21/4/2026 - and 21-4 with the year carried over
  m = /^(\d{1,2})[-/. ](\d{1,2})(?:[-/. ](\d{2}|\d{4}))?$/.exec(t);
  if (m) return buildDate(+m[1], +m[2], m[3] ? +m[3] : ref.getFullYear());

  // 210426 / 21042026
  m = /^(\d{2})(\d{2})(\d{2}|\d{4})$/.exec(t);
  if (m) return buildDate(+m[1], +m[2], +m[3]);

  // a bare day in the month already on screen
  m = /^(\d{1,2})$/.exec(t);
  if (m) return buildDate(+m[1], ref.getMonth() + 1, ref.getFullYear());

  return null;
}

/** The 42 cells of a month view, starting on the Sunday on or before the 1st. */
function monthCells(view: Date): Date[] {
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/**
 * A date field that speaks the application's own date format. It shows
 * 21-Apr-26 rather than the browser's locale, takes typed dates in the
 * shorthands above, and opens a calendar that is styled like the rest of the
 * interface instead of the operating system's.
 *
 * The value in and out is always an ISO `yyyy-mm-dd` string, or '' for blank.
 */
export function DateInput({
  value, onChange, min, max, disabled, size = 'md', placeholder = 'dd-mmm-yy',
  ariaLabel, id, width, invalid, clearable = true, autoFocus,
}: {
  value: string | null | undefined;
  onChange: (iso: string) => void;
  /** Inclusive ISO bounds; days outside them cannot be picked. */
  min?: string;
  max?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  placeholder?: string;
  ariaLabel?: string;
  id?: string;
  width?: number | string;
  invalid?: boolean;
  clearable?: boolean;
  autoFocus?: boolean;
}) {
  const field = useFieldIds();
  const selected = fromIso(value);
  const today = useMemo(() => new Date(), []);
  const minDate = fromIso(min);
  const maxDate = fromIso(max);

  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [view, setView] = useState<Date>(() => selected || today);
  // The calendar drills day -> month -> year and back down again.
  const [level, setLevel] = useState<'day' | 'month' | 'year'>('day');
  const [cursor, setCursor] = useState<Date>(() => selected || today);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const gridId = useId();

  useOverlay(open);

  /* Follow the value when the screen changes it underneath us. */
  useEffect(() => {
    if (editing) return;
    const d = fromIso(value);
    if (d) { setView(d); setCursor(d); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const outOfRange = useCallback((d: Date) => {
    if (minDate && d < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())) return true;
    if (maxDate && d > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate())) return true;
    return false;
  }, [minDate, maxDate]);

  const place = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const h = 310;
    const below = window.innerHeight - r.bottom - 6;
    const dropUp = below < h && r.top > below;
    setPos({
      top: dropUp ? undefined : r.bottom + 4,
      bottom: dropUp ? window.innerHeight - r.top + 4 : undefined,
      left: Math.max(8, Math.min(r.left, window.innerWidth - 268)),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onScroll = () => place();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || wrapRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const openCalendar = () => {
    const base = fromIso(value) || today;
    setView(base);
    setCursor(base);
    setLevel('day');
    setOpen(true);
    setTimeout(() => popRef.current?.focus({ preventScroll: true }), 0);
  };

  const pick = (d: Date) => {
    if (outOfRange(d)) return;
    onChange(toIso(d));
    setEditing(false);
    setOpen(false);
    inputRef.current?.focus({ preventScroll: true });
  };

  const flashRejected = () => {
    setRejected(true);
    window.setTimeout(() => setRejected(false), 1200);
  };

  const commit = () => {
    const parsed = parseDateInput(text, fromIso(value) || today);
    setEditing(false);
    if (parsed === null) { flashRejected(); return; }       // leave the old value alone
    if (parsed === '') { onChange(''); return; }
    const d = fromIso(parsed)!;
    if (outOfRange(d)) { flashRejected(); return; }
    if (parsed !== value) onChange(parsed);
  };

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'F4') { e.preventDefault(); openCalendar(); }
    else if (e.key === 'Enter') { e.preventDefault(); commit(); }
    else if (e.key === 'Escape' && editing) {
      e.preventDefault();
      e.stopPropagation();
      setEditing(false);
      setText('');
    }
  };

  /** Steps the header: a month, a year, or a block of twelve years. */
  const shift = (n: number) => {
    if (level === 'day') setView(addMonths(view, n));
    else if (level === 'month') setView(new Date(view.getFullYear() + n, view.getMonth(), 1));
    else setView(new Date(view.getFullYear() + n * 12, view.getMonth(), 1));
  };

  const chooseMonth = (monthIndex: number) => {
    const next = new Date(view.getFullYear(), monthIndex, 1);
    setView(next);
    setCursor(new Date(next.getFullYear(), next.getMonth(),
      Math.min(cursor.getDate(), new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate())));
    setLevel('day');
  };

  const chooseYear = (year: number) => {
    setView(new Date(year, view.getMonth(), 1));
    setLevel('month');
  };

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    const go = (fn: () => void) => { e.preventDefault(); fn(); };

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      // Step back down a level before giving up the popover altogether.
      if (level === 'year') setLevel('month');
      else if (level === 'month') setLevel('day');
      else { setOpen(false); inputRef.current?.focus({ preventScroll: true }); }
      return;
    }

    if (level === 'month') {
      const m = view.getMonth();
      const toMonth = (i: number) => go(() => setView(new Date(view.getFullYear(), Math.max(0, Math.min(11, i)), 1)));
      if (e.key === 'ArrowLeft') toMonth(m - 1);
      else if (e.key === 'ArrowRight') toMonth(m + 1);
      else if (e.key === 'ArrowUp') toMonth(m - 3);
      else if (e.key === 'ArrowDown') toMonth(m + 3);
      else if (e.key === 'PageUp') go(() => shift(-1));
      else if (e.key === 'PageDown') go(() => shift(1));
      else if (e.key === 'Enter' || e.key === ' ') go(() => chooseMonth(m));
      return;
    }

    if (level === 'year') {
      const y = view.getFullYear();
      const toYear = (n: number) => go(() => setView(new Date(n, view.getMonth(), 1)));
      if (e.key === 'ArrowLeft') toYear(y - 1);
      else if (e.key === 'ArrowRight') toYear(y + 1);
      else if (e.key === 'ArrowUp') toYear(y - 4);
      else if (e.key === 'ArrowDown') toYear(y + 4);
      else if (e.key === 'PageUp') go(() => shift(-1));
      else if (e.key === 'PageDown') go(() => shift(1));
      else if (e.key === 'Enter' || e.key === ' ') go(() => chooseYear(y));
      return;
    }

    const step = (d: Date) => go(() => { setCursor(d); setView(d); });
    if (e.key === 'ArrowLeft') step(addDays(cursor, -1));
    else if (e.key === 'ArrowRight') step(addDays(cursor, 1));
    else if (e.key === 'ArrowUp') step(addDays(cursor, -7));
    else if (e.key === 'ArrowDown') step(addDays(cursor, 7));
    else if (e.key === 'PageUp') step(addMonths(cursor, e.shiftKey ? -12 : -1));
    else if (e.key === 'PageDown') step(addMonths(cursor, e.shiftKey ? 12 : 1));
    else if (e.key === 'Home') step(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
    else if (e.key === 'End') step(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0));
    else if (e.key === 'Enter' || e.key === ' ') go(() => pick(cursor));
  };

  const shown = editing ? text : (selected ? fmtDate(toIso(selected)) : '');
  const cells = monthCells(view);
  const yearBlock = Math.floor(view.getFullYear() / 12) * 12;
  const monthOff = (i: number) =>
    outOfRange(new Date(view.getFullYear(), i + 1, 0)) && outOfRange(new Date(view.getFullYear(), i, 1));
  const yearOff = (y: number) =>
    outOfRange(new Date(y, 11, 31)) && outOfRange(new Date(y, 0, 1));
  const headTitle = level === 'day'
    ? `${MONTHS[view.getMonth()]} ${view.getFullYear()}`
    : level === 'month'
      ? String(view.getFullYear())
      : `${yearBlock} - ${yearBlock + 11}`;

  return (
    <>
      <div
        ref={wrapRef}
        className={[
          'lt-datefield',
          size === 'sm' ? 'is-sm' : '',
          open ? 'is-open' : '',
          invalid || rejected ? 'is-invalid' : '',
          disabled ? 'is-disabled' : '',
        ].filter(Boolean).join(' ')}
        style={width ? { width } : undefined}
      >
        <input
          ref={inputRef}
          id={id || field?.id}
          className="lt-datefield-input"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          autoFocus={autoFocus}
          value={shown}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-describedby={field?.describedBy}
          aria-invalid={invalid || rejected || undefined}
          title={selected ? toIso(selected) : undefined}
          onFocus={(e) => {
            setEditing(true);
            setText(selected ? fmtDate(toIso(selected)) : '');
            requestAnimationFrame(() => e.target.select?.());
          }}
          onChange={(e) => { setText(e.target.value); setRejected(false); }}
          onBlur={() => { if (editing) commit(); }}
          onKeyDown={onInputKeyDown}
        />
        {clearable && selected && !disabled ? (
          <button
            type="button"
            className="lt-datefield-clear"
            tabIndex={-1}
            aria-label="Clear the date"
            title="Clear"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { setEditing(false); onChange(''); inputRef.current?.focus(); }}
          >
            <IconClose />
          </button>
        ) : null}
        <button
          type="button"
          className="lt-datefield-btn"
          tabIndex={-1}
          disabled={disabled}
          aria-label="Open the calendar"
          title="Open the calendar"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => (open ? setOpen(false) : openCalendar())}
        >
          <IconCalendar />
        </button>
      </div>

      {open && pos ? (
        <div
          ref={popRef}
          className="lt-cal"
          role="dialog"
          aria-label="Choose a date"
          tabIndex={-1}
          onKeyDown={onGridKeyDown}
          style={{ top: pos.top, bottom: pos.bottom, left: pos.left }}
        >
          <div className="lt-cal-head">
            <button
              type="button"
              className="lt-cal-nav"
              aria-label={level === 'day' ? 'Previous month' : level === 'month' ? 'Previous year' : 'Earlier years'}
              onClick={() => shift(-1)}
            >
              <IconChevronRight />
            </button>
            <button
              type="button"
              className="lt-cal-title"
              disabled={level === 'year'}
              aria-label={level === 'day' ? 'Choose a month' : 'Choose a year'}
              title={level === 'day' ? 'Choose a month' : level === 'month' ? 'Choose a year' : undefined}
              onClick={() => setLevel(level === 'day' ? 'month' : 'year')}
            >
              <span>{headTitle}</span>
              {level !== 'year' ? <IconChevronDown /> : null}
            </button>
            <button
              type="button"
              className="lt-cal-nav is-next"
              aria-label={level === 'day' ? 'Next month' : level === 'month' ? 'Next year' : 'Later years'}
              onClick={() => shift(1)}
            >
              <IconChevronRight />
            </button>
          </div>

          {level === 'day' ? (
            <>
              <div className="lt-cal-week" aria-hidden="true">
                {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
              </div>
              <div className="lt-cal-grid" role="grid" id={gridId}>
                {cells.map((d) => {
                  const other = d.getMonth() !== view.getMonth();
                  const off = outOfRange(d);
                  return (
                    <button
                      key={toIso(d)}
                      type="button"
                      role="gridcell"
                      tabIndex={-1}
                      disabled={off}
                      aria-selected={!!selected && sameDay(d, selected)}
                      aria-label={fmtDate(toIso(d))}
                      className={[
                        'lt-cal-day',
                        other ? 'is-other' : '',
                        sameDay(d, today) ? 'is-today' : '',
                        selected && sameDay(d, selected) ? 'is-selected' : '',
                        sameDay(d, cursor) ? 'is-cursor' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => pick(d)}
                      onMouseEnter={() => setCursor(d)}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            </>
          ) : level === 'month' ? (
            <div className="lt-cal-months" role="grid">
              {MONTHS.map((name, i) => {
                const isSel = !!selected
                  && selected.getFullYear() === view.getFullYear() && selected.getMonth() === i;
                return (
                  <button
                    key={name}
                    type="button"
                    role="gridcell"
                    tabIndex={-1}
                    disabled={monthOff(i)}
                    aria-selected={isSel}
                    className={[
                      'lt-cal-cell',
                      i === view.getMonth() ? 'is-cursor' : '',
                      isSel ? 'is-selected' : '',
                      today.getFullYear() === view.getFullYear() && today.getMonth() === i ? 'is-today' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => chooseMonth(i)}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="lt-cal-years" role="grid">
              {Array.from({ length: 12 }, (_, i) => yearBlock + i).map((y) => {
                const isSel = !!selected && selected.getFullYear() === y;
                return (
                  <button
                    key={y}
                    type="button"
                    role="gridcell"
                    tabIndex={-1}
                    disabled={yearOff(y)}
                    aria-selected={isSel}
                    className={[
                      'lt-cal-cell',
                      y === view.getFullYear() ? 'is-cursor' : '',
                      isSel ? 'is-selected' : '',
                      today.getFullYear() === y ? 'is-today' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => chooseYear(y)}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          )}

          <div className="lt-cal-foot">
            <button
              type="button"
              className="lt-check"
              disabled={outOfRange(today)}
              onClick={() => pick(today)}
            >
              Today
            </button>
            {clearable ? (
              <button
                type="button"
                className="lt-check"
                onClick={() => { onChange(''); setOpen(false); inputRef.current?.focus(); }}
              >
                Clear
              </button>
            ) : null}
            <span className="lt-cal-hint">
              {level === 'day' ? 'Type 21-4-26, 21apr or t' : level === 'month' ? 'Pick a month' : 'Pick a year'}
            </span>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function DateField({
  label, value, onChange, hint, error, min, max, disabled, required, autoFocus, width,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (iso: string) => void;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  width?: number;
}) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      <DateInput
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        disabled={disabled}
        invalid={!!error}
        autoFocus={autoFocus}
        width={width || 168}
      />
    </Field>
  );
}

export function SelectField({
  label, value, onChange, options, hint, error, disabled, allowBlank,
  blankLabel = 'Not Applicable', width, required,
}: {
  label: string;
  value: string | number | null;
  onChange: (v: string) => void;
  options: DropdownOption[];
  hint?: React.ReactNode;
  error?: React.ReactNode;
  disabled?: boolean;
  allowBlank?: boolean;
  blankLabel?: string;
  width?: number;
  required?: boolean;
}) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      <Dropdown
        value={value}
        onChange={onChange}
        options={options}
        disabled={disabled}
        allowBlank={allowBlank}
        blankLabel={blankLabel}
        invalid={!!error}
        width={width || 320}
      />
    </Field>
  );
}

/** Two states read better as a segmented control than as a dropdown. */
export function YesNoField({
  label, value, onChange, hint,
}: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: React.ReactNode }) {
  return (
    <Field label={label} hint={hint}>
      <YesNo value={value} onChange={onChange} label={label} />
    </Field>
  );
}

export function YesNo({
  value, onChange, label, small,
}: { value: boolean; onChange: (v: boolean) => void; label?: string; small?: boolean }) {
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); onChange(false); }
    if (e.key === 'ArrowRight') { e.preventDefault(); onChange(true); }
  };
  return (
    <div
      className={`lt-segmented ${small ? 'lt-segmented-sm' : ''}`}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        role="radio"
        className={!value ? 'is-on' : ''}
        aria-checked={!value}
        tabIndex={value ? -1 : 0}
        onClick={() => onChange(false)}
      >
        No
      </button>
      <button
        type="button"
        role="radio"
        className={value ? 'is-on' : ''}
        aria-checked={value}
        tabIndex={value ? 0 : -1}
        onClick={() => onChange(true)}
      >
        Yes
      </button>
    </div>
  );
}

/* ----------------------------------------------------------------- picker */

export interface PickerOption {
  value: number | string;
  label: string;
  note?: string;
  /** Groups the results under a heading. */
  section?: string;
  /** Extra words the filter matches on, never shown. */
  keywords?: string;
}

/** Subsequence match, so "bsh" finds "Balance Sheet". */
function fuzzyScore(label: string, query: string): number {
  if (!query) return 1;
  const l = label.toLowerCase();
  const q = query.toLowerCase();
  const direct = l.indexOf(q);
  if (direct === 0) return 1000;
  if (direct > 0) return 800 - direct;
  let li = 0;
  let hits = 0;
  let streak = 0;
  let score = 0;
  for (const ch of q) {
    const at = l.indexOf(ch, li);
    if (at < 0) return 0;
    streak = at === li ? streak + 1 : 0;
    score += 10 + streak * 4 - Math.min(at - li, 8);
    li = at + 1;
    hits++;
  }
  return hits === q.length ? score : 0;
}

/**
 * The quick-jump palette, also used wherever a long list needs picking from.
 */
export function Picker({
  title, options, onPick, onClose, allowCreate, onCreate, placeholder,
}: {
  title: string;
  options: PickerOption[];
  onPick: (o: PickerOption) => void;
  onClose: () => void;
  allowCreate?: boolean;
  onCreate?: (name: string) => void;
  placeholder?: string;
}) {
  useOverlay();
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const s = search.trim();
    if (!s) return options;
    return options
      .map((o) => ({
        o,
        score: Math.max(
          fuzzyScore(o.label, s),
          fuzzyScore(`${o.keywords || ''} ${o.note || ''}`.trim(), s) * 0.5,
        ),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.o);
  }, [options, search]);

  const rows = useMemo(() => (
    allowCreate && search.trim()
      ? [{ value: '__create__', label: `Create "${search.trim()}"`, note: 'new' } as PickerOption, ...filtered]
      : filtered
  ), [allowCreate, search, filtered]);

  useEffect(() => setCursor(0), [search]);
  useEffect(() => {
    listRef.current?.querySelector('.is-selected')?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const pick = (o: PickerOption) => {
    if (o.value === '__create__') onCreate?.(search.trim());
    else onPick(o);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(rows.length - 1, c + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setCursor(0); }
    else if (e.key === 'End') { e.preventDefault(); setCursor(rows.length - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (rows[cursor]) pick(rows[cursor]); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
  };

  let lastSection: string | undefined;

  return (
    <div
      className="lt-palette-wrap"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="lt-palette" role="dialog" aria-modal="true" aria-label={title}>
        <div className="lt-palette-search">
          <IconSearch />
          <input
            autoFocus
            value={search}
            placeholder={placeholder || `${title} - type to filter`}
            aria-label={title}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <kbd className="lt-key">Esc</kbd>
        </div>
        <div className="lt-palette-list" ref={listRef} role="listbox" aria-label={title}>
          {rows.length === 0 ? (
            <EmptyState title="No matches" note={`Nothing here is called "${search}".`} />
          ) : null}
          {rows.map((o, i) => {
            const head = o.section && o.section !== lastSection ? o.section : null;
            if (o.section) lastSection = o.section;
            return (
              <React.Fragment key={`${o.value}`}>
                {head ? <div className="lt-palette-section">{head}</div> : null}
                <div
                  role="option"
                  aria-selected={i === cursor}
                  className={`lt-palette-item ${i === cursor ? 'is-selected' : ''}`}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => pick(o)}
                >
                  <span><Highlight text={o.label} query={search} /></span>
                  {o.note ? <span className="lt-palette-note">{o.note}</span> : null}
                </div>
              </React.Fragment>
            );
          })}
        </div>
        <div className="lt-palette-foot">
          <span><kbd className="lt-key">&uarr;</kbd><kbd className="lt-key">&darr;</kbd> move</span>
          <span><kbd className="lt-key">Enter</kbd> open</span>
          <span><kbd className="lt-key">Esc</kbd> close</span>
          <span style={{ marginLeft: 'auto' }}>{rows.length} of {options.length}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- dialogs */

const FOCUSABLE = 'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';

export function Dialog({
  title, children, onClose, footer, width,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  width?: number;
}) {
  useOverlay();
  const boxRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = boxRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus({ preventScroll: true });
    return () => previous?.focus?.({ preventScroll: true });
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab' || !boxRef.current) return;
      // Keep Tab inside the dialog while it owns the screen.
      const items = Array.from(boxRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [onClose]);

  return (
    <div className="lt-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="lt-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={boxRef}
        style={width ? { width } : undefined}
      >
        <div className="lt-panel-title">
          <div className="lt-title-main"><span id={titleId}>{title}</span></div>
          <button type="button" className="lt-tool" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </div>
        <div className="lt-dialog-body">{children}</div>
        {footer ? <div className="lt-dialog-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

/**
 * The "Accept?" confirmation strip. Y / Enter confirms, N / Esc cancels, and
 * the confirming button takes focus so the choice is obvious without a mouse.
 */
export function AcceptBar({
  question = 'Accept?', detail, onYes, onNo, yesLabel = 'Yes', noLabel = 'No', tone = 'primary',
}: {
  question?: string;
  detail?: React.ReactNode;
  onYes: () => void;
  onNo: () => void;
  yesLabel?: string;
  noLabel?: string;
  tone?: 'primary' | 'danger';
}) {
  useOverlay();
  const yesRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { yesRef.current?.focus({ preventScroll: true }); }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'y' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onYes(); }
      else if (k === 'n' || e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onNo(); }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [onYes, onNo]);

  const Glyph = tone === 'danger' ? IconAlert : IconCheckCircle;

  return (
    <div
      className={`lt-confirm ${tone === 'danger' ? 'is-danger' : ''}`}
      role="alertdialog"
      aria-label={question}
    >
      <div className="lt-confirm-head">
        <span className="lt-confirm-icon"><Glyph /></span>
        <div>
          <div className="lt-confirm-q">{question}</div>
          {detail ? <div className="lt-confirm-sub">{detail}</div> : null}
        </div>
      </div>
      <div className="lt-confirm-row">
        <button
          ref={yesRef}
          type="button"
          className={`lt-btn ${tone === 'danger' ? 'lt-btn-danger' : 'lt-btn-strong'}`}
          onClick={onYes}
        >
          <kbd className="lt-key">Y</kbd><span>{yesLabel}</span>
        </button>
        <button type="button" className="lt-btn" onClick={onNo}>
          <kbd className="lt-key">N</kbd><span>{noLabel}</span>
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- report cells */

/**
 * The Particulars cell of a drill-down report. The disclosure arrow sits in a
 * fixed-width slot so group names and ledger names line up at every depth,
 * whether or not a row can be expanded.
 */
export function TreeCell({
  depth, hasChildren, expanded, children,
}: {
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className="lt-tree" style={{ paddingLeft: depth * 20 }}>
      <span className={`lt-tree-toggle ${expanded ? 'is-open' : ''}`}>
        {hasChildren ? <IconChevronRight /> : null}
      </span>
      <span className="lt-tree-label">{children}</span>
    </span>
  );
}

/**
 * A right-aligned money cell. The Dr/Cr marker lives in its own fixed slot so
 * the decimal points stay in a straight line down the column.
 */
export function Amount({
  value, dc, blankZero = true, zero = '',
}: {
  value: number | null | undefined;
  /** 'auto' derives Dr/Cr from the sign; a literal string is used as given. */
  dc?: 'auto' | 'Dr' | 'Cr' | null;
  blankZero?: boolean;
  zero?: React.ReactNode;
}) {
  const v = Number(value ?? 0);
  if (blankZero && Math.abs(v) < 0.005) return <>{zero}</>;
  const marker = dc === 'auto' ? (v >= 0 ? 'Dr' : 'Cr') : dc || null;
  const text = Math.abs(v).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (
    <span className="lt-amt">
      <span className="lt-amt-v">{text}</span>
      {dc !== undefined && dc !== null ? <span className="lt-amt-dc">{marker}</span> : null}
    </span>
  );
}

export function ActionPill({ action }: { action: string }) {
  return <span className={`lt-pill ${action.toLowerCase()}`}>{action}</span>;
}

export function Pill({ tone = 'neutral', children }: { tone?: string; children: React.ReactNode }) {
  return <span className={`lt-pill ${tone}`}>{children}</span>;
}
