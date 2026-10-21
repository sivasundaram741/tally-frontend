import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, type EditLogEntry, type EditLogEntityRow, type EditLogChange } from '../api';
import { useApp, useScreen, useDebounced, fmtAmount, fmtDate, fmtDateTime } from '../state';
import {
  Panel, DataTable, ActionPill, Dropdown, Amount, SearchInput, CheckChip, StatTile,
  DateInput, EmptyState, Loading, Pill, IconClose, type Column,
} from '../ui';
import { MASTER_FORMS } from '../masterForms';

const ACTIONS = ['Created', 'Altered', 'Deleted', 'Cancelled', 'Restored'];

function entityTitle(type: string) {
  if (type === 'voucher') return 'Voucher';
  if (type === 'company') return 'Company';
  return MASTER_FORMS[type]?.label || type;
}

const EMPTY_FILTERS = { from: '', to: '', action: '', kind: '', user: '', search: '' };

/* ========================================================== Edit Log report */

export function EditLogReport() {
  const app = useApp();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const [rows, setRows] = useState<EditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<{ username: string; events: number }[]>([]);
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState<EditLogEntry | null>(null);
  const [filters, setFilters] = useState({
    ...EMPTY_FILTERS,
    kind: sp.get('kind') || '',
    action: sp.get('action') || '',
  });

  const search = useDebounced(filters.search);
  const query = useMemo(() => ({ ...filters, search }), [filters, search]);

  useEffect(() => {
    if (!app.company) return;
    setLoading(true);
    api.editLog({ ...query, limit: 500 })
      .then(setRows)
      .catch((e) => app.setError(e instanceof Error ? e.message : 'Could not load the edit log'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.company?.id, query]);

  useEffect(() => {
    if (app.company) api.editLogUsers().then(setUsers).catch(() => setUsers([]));
  }, [app.company?.id]);

  const dirty = useMemo(
    () => (Object.keys(EMPTY_FILTERS) as (keyof typeof EMPTY_FILTERS)[]).some((k) => filters[k]),
    [filters],
  );
  const set = (patch: Partial<typeof EMPTY_FILTERS>) => setFilters((f) => ({ ...f, ...patch }));

  useScreen('Edit Log', [
    { keys: 'F5', label: 'Summary', onClick: () => navigate('/edit-log/summary'), group: 'Report' },
    { keys: 'F6', label: 'Vouchers', onClick: () => navigate('/edit-log/entities?kind=Voucher'), group: 'Report' },
    { keys: 'F7', label: 'Masters', onClick: () => navigate('/edit-log/entities?kind=Master'), group: 'Report' },
    {
      keys: 'Enter', label: 'Version History',
      onClick: () => selected && navigate(`/edit-log/${selected.entity_type}/${selected.entity_id}`),
      disabled: !selected, group: 'Action', strong: true,
    },
    {
      keys: 'F12', label: 'Clear Filters',
      onClick: () => setFilters({ ...EMPTY_FILTERS }),
      disabled: !dirty, group: 'View',
    },
    { keys: 'Ctrl+P', label: 'Print', onClick: () => window.print(), group: 'Report' },
    { keys: 'Esc', label: 'Quit', onClick: () => navigate('/'), group: 'Action' },
  ], [selected?.id, dirty]);

  const columns: Column<EditLogEntry>[] = [
    {
      key: 'when', header: 'Date & Time', width: 155,
      sortValue: (r) => r.logged_at, cell: (r) => fmtDateTime(r.logged_at),
    },
    { key: 'user', header: 'User', width: 90, sortValue: (r) => r.username, cell: (r) => r.username },
    {
      key: 'action', header: 'Action', width: 100,
      sortValue: (r) => r.action, cell: (r) => <ActionPill action={r.action} />,
    },
    {
      key: 'type', header: 'Type', width: 130,
      sortValue: (r) => entityTitle(r.entity_type), cell: (r) => entityTitle(r.entity_type),
    },
    { key: 'label', header: 'Particulars', sortValue: (r) => r.entity_label, cell: (r) => r.entity_label },
    {
      key: 'vdate', header: 'Vch Date', width: 100,
      sortValue: (r) => r.voucher_date, cell: (r) => fmtDate(r.voucher_date),
    },
    {
      key: 'ver', header: 'Ver.', num: true, width: 58,
      sortValue: (r) => r.version_no, cell: (r) => r.version_no,
    },
    {
      key: 'changes', header: 'Changes', num: true, width: 80,
      sortValue: (r) => r.changeCount || r.changes?.length || 0,
      cell: (r) => (r.changeCount || r.changes?.length || '') as React.ReactNode,
    },
    {
      key: 'amount', header: 'Amount', num: true, width: 130,
      sortValue: (r) => r.amount, cell: (r) => <Amount value={r.amount} />,
    },
    { key: 'machine', header: 'Machine', width: 110, sortValue: (r) => r.machine, cell: (r) => r.machine },
  ];

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const r of rows) out[r.action] = (out[r.action] || 0) + 1;
    return out;
  }, [rows]);

  return (
    <div className="lt-stack">
      <div className="lt-filters">
        <label className="lt-fl">
          <span>From</span>
          <DateInput
            size="sm"
            value={filters.from}
            max={filters.to || undefined}
            ariaLabel="From date"
            placeholder="Any"
            onChange={(v) => set({ from: v })}
          />
        </label>
        <label className="lt-fl">
          <span>To</span>
          <DateInput
            size="sm"
            value={filters.to}
            min={filters.from || undefined}
            ariaLabel="To date"
            placeholder="Any"
            onChange={(v) => set({ to: v })}
          />
        </label>
        <span className="lt-sep" />
        <label className="lt-fl">
          <span>Action</span>
          <Dropdown
            value={filters.action}
            size="sm"
            options={ACTIONS.map((a) => ({ value: a, label: a }))}
            allowBlank
            blankLabel="All actions"
            ariaLabel="Filter by action"
            onChange={(v) => set({ action: v })}
          />
        </label>
        <label className="lt-fl">
          <span>Kind</span>
          <Dropdown
            value={filters.kind}
            size="sm"
            options={[{ value: 'Voucher', label: 'Vouchers' }, { value: 'Master', label: 'Masters' }]}
            allowBlank
            blankLabel="All kinds"
            ariaLabel="Filter by kind"
            onChange={(v) => set({ kind: v })}
          />
        </label>
        <label className="lt-fl">
          <span>User</span>
          <Dropdown
            value={filters.user}
            size="sm"
            options={users.map((u) => ({ value: u.username, label: u.username, note: String(u.events) }))}
            allowBlank
            blankLabel="Everyone"
            ariaLabel="Filter by user"
            onChange={(v) => set({ user: v })}
          />
        </label>
        <SearchInput
          value={filters.search}
          onChange={(v) => set({ search: v })}
          placeholder="Search particulars"
          ariaLabel="Search the edit log"
        />
        {dirty ? (
          <button type="button" className="lt-check" onClick={() => setFilters({ ...EMPTY_FILTERS })}>
            <IconClose /> Clear filters
          </button>
        ) : null}
        <span className="lt-meta">{rows.length} entries</span>
      </div>

      <div className="lt-tiles">
        {ACTIONS.map((a) => (
          <StatTile
            key={a}
            label={a}
            value={counts[a] || 0}
            note={filters.action === a ? 'filtered to this' : 'in this view'}
            onClick={() => set({ action: filters.action === a ? '' : a })}
          />
        ))}
      </div>

      <Panel
        title="Edit Log"
        sub={app.company?.name}
        footer={
          <>
            <span><kbd className="lt-key">Enter</kbd> opens the full version history of the highlighted record</span>
            <span>{selected ? <strong>{selected.entity_label}</strong> : 'Nothing selected'}</span>
          </>
        }
      >
        <DataTable
          rows={rows}
          loading={loading}
          rowKey={(r) => r.id}
          columns={columns}
          selectedIndex={cursor}
          onSelectedIndexChange={setCursor}
          onSelectedRowChange={setSelected}
          onRowClick={(r) => navigate(`/edit-log/${r.entity_type}/${r.entity_id}`)}
          empty={
            <EmptyState
              title={dirty ? 'No entries match these filters' : 'Nothing has been recorded yet'}
              note={dirty
                ? 'Widen the dates, or clear the filters.'
                : 'Create, alter, delete or cancel anything and it will show up here.'}
              action={dirty ? (
                <button type="button" className="lt-btn lt-inline-btn" onClick={() => setFilters({ ...EMPTY_FILTERS })}>
                  <kbd className="lt-key">F12</kbd><span>Clear the filters</span>
                </button>
              ) : undefined}
            />
          }
        />
      </Panel>
    </div>
  );
}

/* ========================================================= Edit Log summary */

export function EditLogSummary() {
  const app = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!app.company) return;
    setLoading(true);
    api.editLogSummary()
      .then(setData)
      .catch((e) => app.setError(e.message))
      .finally(() => setLoading(false));
  }, [app.company?.id]);

  useScreen('Edit Log Summary', [
    { keys: 'F5', label: 'Full Edit Log', onClick: () => navigate('/edit-log'), group: 'Report' },
    { keys: 'F6', label: 'Vouchers', onClick: () => navigate('/edit-log/entities?kind=Voucher'), group: 'Report' },
    { keys: 'F7', label: 'Masters', onClick: () => navigate('/edit-log/entities?kind=Master'), group: 'Report' },
    { keys: 'Ctrl+P', label: 'Print', onClick: () => window.print(), group: 'Report' },
    { keys: 'Esc', label: 'Quit', onClick: () => navigate('/'), group: 'Action' },
  ], []);

  if (loading && !data) return <Loading what="Summarising the edit log" />;
  if (!data) return <EmptyState title="The summary is not available" />;

  return (
    <div className="lt-stack">
      <div className="lt-tiles">
        <StatTile label="Created" value={data.totals.created} onClick={() => navigate('/edit-log?action=Created')} />
        <StatTile label="Altered" value={data.totals.altered} onClick={() => navigate('/edit-log')} />
        <StatTile label="Deleted" value={data.totals.deleted} tone={data.totals.deleted ? 'bad' : undefined} />
        <StatTile label="Cancelled" value={data.totals.cancelled} />
        <StatTile label="Total events" value={data.totals.totalEvents} onClick={() => navigate('/edit-log')} />
      </div>

      <Panel
        title="Edit Log Summary"
        sub={app.company?.name}
        footer={<><span>Click a row to list the records of that kind</span><span /></>}
      >
        <DataTable
          rows={data.rows}
          rowKey={(r: any) => `${r.kind}-${r.name}`}
          onRowClick={(r: any) => navigate(
            `/edit-log/entities?kind=${r.kind}${r.kind === 'Voucher' ? `&voucherType=${encodeURIComponent(r.name)}` : `&entityType=${r.entityType}`}`,
          )}
          columns={[
            {
              key: 'kind', header: 'Kind', width: 110,
              sortValue: (r: any) => r.kind,
              cell: (r: any) => <Pill tone="neutral">{r.kind}</Pill>,
            },
            { key: 'name', header: 'Particulars', sortValue: (r: any) => r.name, cell: (r: any) => r.name },
            { key: 'created', header: 'Created', num: true, width: 100, sortValue: (r: any) => r.created, cell: (r: any) => r.created || '' },
            { key: 'altered', header: 'Altered', num: true, width: 100, sortValue: (r: any) => r.altered, cell: (r: any) => r.altered || '' },
            { key: 'deleted', header: 'Deleted', num: true, width: 100, sortValue: (r: any) => r.deleted, cell: (r: any) => r.deleted || '' },
            { key: 'cancelled', header: 'Cancelled', num: true, width: 110, sortValue: (r: any) => r.cancelled, cell: (r: any) => r.cancelled || '' },
            {
              key: 'total', header: 'Total Events', num: true, width: 130,
              sortValue: (r: any) => r.totalEvents, cell: (r: any) => r.totalEvents,
            },
          ]}
          footer={
            <tr>
              <td colSpan={2}>Total</td>
              <td className="num">{data.totals.created}</td>
              <td className="num">{data.totals.altered}</td>
              <td className="num">{data.totals.deleted}</td>
              <td className="num">{data.totals.cancelled}</td>
              <td className="num">{data.totals.totalEvents}</td>
            </tr>
          }
          empty={<EmptyState title="The edit log is empty" note="Nothing has been created or changed yet." />}
        />
      </Panel>
    </div>
  );
}

/* ======================================================== Entities with log */

export function EditLogEntities() {
  const app = useApp();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const [rows, setRows] = useState<EditLogEntityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState<EditLogEntityRow | null>(null);
  const [onlyAltered, setOnlyAltered] = useState(false);
  const [search, setSearch] = useState('');
  const query = useDebounced(search);

  const kind = sp.get('kind') || '';
  const entityType = sp.get('entityType') || '';
  const voucherType = sp.get('voucherType') || '';

  useEffect(() => {
    if (!app.company) return;
    setLoading(true);
    api.editLogEntities({ kind, entityType, voucherType, onlyAltered: onlyAltered ? 1 : '' })
      .then(setRows)
      .catch((e) => app.setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.company?.id, kind, entityType, voucherType, onlyAltered]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => r.entity_label.toLowerCase().includes(q)) : rows;
  }, [rows, query]);

  const title = voucherType
    ? `Edit Log - ${voucherType}`
    : kind === 'Master' ? 'Edit Log - Masters' : kind === 'Voucher' ? 'Edit Log - Vouchers' : 'Edit Log - All';

  useScreen(title, [
    {
      keys: 'Enter', label: 'Version History',
      onClick: () => selected && navigate(`/edit-log/${selected.entity_type}/${selected.entity_id}`),
      disabled: !selected, group: 'Action', strong: true,
    },
    {
      keys: 'F12', label: onlyAltered ? 'Show All' : 'Only Altered',
      onClick: () => setOnlyAltered((v) => !v), group: 'View',
    },
    { keys: 'F5', label: 'Summary', onClick: () => navigate('/edit-log/summary'), group: 'Report' },
    { keys: 'Esc', label: 'Quit', onClick: () => navigate('/edit-log'), group: 'Action' },
  ], [selected?.entity_id, onlyAltered]);

  return (
    <div className="lt-stack">
      <div className="lt-filters">
        <SearchInput value={search} onChange={setSearch} placeholder="Search particulars" />
        <CheckChip checked={onlyAltered} onChange={setOnlyAltered}>Only records that were altered</CheckChip>
        <span className="lt-meta">{shown.length} records</span>
      </div>

      <Panel
        title={title}
        sub={app.company?.name}
        footer={
          <>
            <span><kbd className="lt-key">Enter</kbd> opens every version of the highlighted record</span>
            <span>{selected ? <strong>{selected.entity_label}</strong> : 'Nothing selected'}</span>
          </>
        }
      >
        <DataTable
          rows={shown}
          loading={loading}
          rowKey={(r) => `${r.entity_type}-${r.entity_id}`}
          selectedIndex={cursor}
          onSelectedIndexChange={setCursor}
          onSelectedRowChange={setSelected}
          onRowClick={(r) => navigate(`/edit-log/${r.entity_type}/${r.entity_id}`)}
          columns={[
            {
              key: 'type', header: 'Type', width: 130,
              sortValue: (r) => entityTitle(r.entity_type), cell: (r) => entityTitle(r.entity_type),
            },
            { key: 'label', header: 'Particulars', sortValue: (r) => r.entity_label, cell: (r) => r.entity_label },
            { key: 'vdate', header: 'Vch Date', width: 100, sortValue: (r) => r.voucher_date, cell: (r) => fmtDate(r.voucher_date) },
            {
              key: 'amount', header: 'Amount', num: true, width: 130,
              sortValue: (r) => r.amount, cell: (r) => <Amount value={r.amount} />,
            },
            { key: 'versions', header: 'Versions', num: true, width: 90, sortValue: (r) => r.versions, cell: (r) => r.versions },
            {
              key: 'alterations', header: 'Alterations', num: true, width: 100,
              sortValue: (r) => r.alterations,
              cell: (r) => (r.alterations ? <strong>{r.alterations}</strong> : ''),
            },
            {
              key: 'last', header: 'Last Action', width: 110,
              sortValue: (r) => r.lastAction?.action || '',
              cell: (r) => (r.lastAction ? <ActionPill action={r.lastAction.action} /> : null),
            },
            {
              key: 'lastat', header: 'Last Changed', width: 155,
              sortValue: (r) => r.last_at, cell: (r) => fmtDateTime(r.last_at),
            },
            { key: 'by', header: 'By', width: 90, sortValue: (r) => r.lastAction?.username || '', cell: (r) => r.lastAction?.username || '' },
          ]}
          empty={<EmptyState title="Nothing recorded for this selection" note="Try clearing the Only-altered filter." />}
        />
      </Panel>
    </div>
  );
}

/* ========================================================= Version history */

export function EditLogHistory() {
  const app = useApp();
  const navigate = useNavigate();
  const { entityType = '', entityId = '' } = useParams();
  const [rows, setRows] = useState<EditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(0);
  const [compareWith, setCompareWith] = useState<number | null>(null);
  const [diff, setDiff] = useState<EditLogChange[] | null>(null);
  const [showBlanks, setShowBlanks] = useState(false);

  useEffect(() => {
    if (!app.company) return;
    setLoading(true);
    api.editLogHistory(entityType, Number(entityId))
      .then((list) => {
        setRows(list);
        setSelected(Math.max(0, list.length - 1));
        setCompareWith(list.length > 1 ? list[list.length - 2].version_no : null);
      })
      .catch((e) => app.setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.company?.id, entityType, entityId]);

  const current = rows[selected];

  useEffect(() => {
    if (!current || compareWith === null) { setDiff(null); return; }
    api.editLogCompare(entityType, Number(entityId), compareWith, current.version_no)
      .then((r) => setDiff(r.changes))
      .catch(() => setDiff(null));
  }, [current?.version_no, compareWith, entityType, entityId]);

  const openEntity = () => {
    if (entityType === 'voucher') navigate(`/vouchers/${entityId}`);
    else if (entityType === 'company') navigate('/companies/alter');
    else if (MASTER_FORMS[entityType]) navigate(`/masters/${entityType}/${entityId}`);
  };

  useScreen(
    current ? `Edit Log: ${current.entity_label}` : 'Edit Log',
    [
      { keys: 'Enter', label: 'Open Record', onClick: openEntity, group: 'Action', strong: true },
      {
        keys: 'Alt+Up', label: 'Newer Version',
        onClick: () => setSelected((i) => Math.min(rows.length - 1, i + 1)),
        disabled: selected >= rows.length - 1, group: 'Versions',
      },
      {
        keys: 'Alt+Down', label: 'Older Version',
        onClick: () => setSelected((i) => Math.max(0, i - 1)),
        disabled: selected <= 0, group: 'Versions',
      },
      { keys: 'F5', label: 'Full Edit Log', onClick: () => navigate('/edit-log'), group: 'Report' },
      { keys: 'Ctrl+P', label: 'Print', onClick: () => window.print(), group: 'Report' },
      { keys: 'Esc', label: 'Quit', onClick: () => navigate(-1), group: 'Action' },
    ],
    [entityType, entityId, current?.version_no, selected, rows.length],
  );

  if (loading) return <Loading what="Reading the version history" />;
  if (!rows.length) {
    return (
      <Panel title="Edit Log">
        <EmptyState
          title="No versions recorded for this record"
          note="It may pre-date the Edit Log, or the log may have been switched off when it was saved."
        />
      </Panel>
    );
  }

  return (
    <div className="lt-row" style={{ alignItems: 'stretch' }}>
      <Panel
        title="Versions"
        sub={`${rows.length} recorded`}
        style={{ flex: '1 1 300px', maxWidth: 360 }}
        footer={<><span>Newest at the bottom</span><span><kbd className="lt-key">Alt+&uarr;</kbd><kbd className="lt-key">Alt+&darr;</kbd></span></>}
      >
        <div className="lt-version-list">
          {rows.map((r, i) => (
            <button
              type="button"
              key={r.id}
              className={`lt-version ${selected === i ? 'is-selected' : ''}`}
              aria-current={selected === i}
              onClick={() => {
                setSelected(i);
                setCompareWith(i > 0 ? rows[i - 1].version_no : null);
              }}
            >
              <span className="lt-v">v{r.version_no}</span>
              <span className="lt-version-meta">
                <div><ActionPill action={r.action} /></div>
                <div className="lt-small lt-muted">{fmtDateTime(r.logged_at)} &middot; {r.username}</div>
              </span>
              <span className="lt-small lt-muted">
                {r.changes?.length ? `${r.changes.length} field${r.changes.length === 1 ? '' : 's'}` : ''}
              </span>
            </button>
          ))}
        </div>
      </Panel>

      <div className="lt-grow lt-stack">
        <Panel
          title={`Version ${current.version_no}`}
          sub={<ActionPill action={current.action} />}
          actions={
            <button type="button" className="lt-check" onClick={openEntity}>
              Open the record
            </button>
          }
        >
          <dl className="lt-kv">
            <dt>Record</dt><dd>{entityTitle(current.entity_type)} &middot; {current.entity_label}</dd>
            <dt>Changed by</dt><dd>{current.username}</dd>
            <dt>Changed on</dt><dd>{fmtDateTime(current.logged_at)}</dd>
            <dt>Machine / IP</dt>
            <dd>{current.machine}{current.ip_address ? ` (${current.ip_address})` : ''}</dd>
            {current.voucher_type ? (
              <>
                <dt>Voucher</dt>
                <dd>{current.voucher_type} No. {current.voucher_number} dated {fmtDate(current.voucher_date)}</dd>
                <dt>Amount</dt><dd>{fmtAmount(current.amount)}</dd>
              </>
            ) : null}
          </dl>
        </Panel>

        <Panel
          title={compareWith === null ? 'What changed in this version' : `Differences against v${compareWith}`}
          sub={
            <Dropdown
              value={compareWith ?? ''}
              size="sm"
              width={230}
              allowBlank
              blankLabel="Changes in this version"
              ariaLabel="Compare with another version"
              options={rows
                .filter((r) => r.version_no !== current.version_no)
                .map((r) => ({ value: r.version_no, label: `Compare with v${r.version_no}`, note: r.action }))}
              onChange={(v) => setCompareWith(v ? Number(v) : null)}
            />
          }
        >
          <ChangeTable changes={diff ?? current.changes ?? []} />
        </Panel>

        <Panel
          title="Full snapshot of this version"
          actions={
            <CheckChip checked={showBlanks} onChange={setShowBlanks}>Show blank fields</CheckChip>
          }
        >
          <SnapshotView snapshot={current.snapshot ?? {}} showBlanks={showBlanks} />
        </Panel>
      </div>
    </div>
  );
}

const MONEY_FIELD = /amount|rate|value|balance|cost|price|limit|total/i;

/** Renders a changed value, grouping money-like numbers the Indian way. */
function changeValue(field: string, raw: string) {
  if (!raw) return <span className="lt-muted">(blank)</span>;
  if (MONEY_FIELD.test(field) && /^-?\d+(\.\d+)?$/.test(raw)) {
    return Number(raw).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return raw;
}

function ChangeTable({ changes }: { changes: EditLogChange[] }) {
  if (!changes.length) {
    return (
      <EmptyState
        title="No field differences"
        note="These two versions hold exactly the same values."
      />
    );
  }
  return (
    <div className="lt-table-wrap">
      <table className="lt-diff">
        <thead>
          <tr>
            <th scope="col">Field</th>
            <th scope="col">Previous value</th>
            <th scope="col">New value</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((c, i) => (
            <tr key={i} className={c.kind}>
              <td className="field">{c.field}</td>
              <td className="from">{changeValue(c.field, c.from)}</td>
              <td className="to">{changeValue(c.field, c.to)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SnapshotView({ snapshot, showBlanks }: { snapshot: Record<string, any>; showBlanks: boolean }) {
  const scalars = Object.entries(snapshot)
    .filter(([, v]) => !Array.isArray(v))
    .filter(([k, v]) => showBlanks || snapshotValue(k, v) !== null);
  const arrays = Object.entries(snapshot).filter(([, v]) => Array.isArray(v)) as [string, any[]][];
  const hidden = Object.entries(snapshot).filter(([, v]) => !Array.isArray(v)).length - scalars.length;

  return (
    <div style={{ paddingBottom: 10 }}>
      {scalars.length ? (
        <dl className="lt-kv">
          {scalars.map(([k, v]) => {
            const shown = snapshotValue(k, v);
            return (
              <React.Fragment key={k}>
                <dt>{humanise(k)}</dt>
                <dd>{shown ?? <span className="lt-muted">(blank)</span>}</dd>
              </React.Fragment>
            );
          })}
        </dl>
      ) : (
        <EmptyState title="Every field in this snapshot is blank" />
      )}

      {hidden > 0 && !showBlanks ? (
        <div className="lt-hint">{hidden} blank field{hidden === 1 ? '' : 's'} hidden.</div>
      ) : null}

      {arrays.filter(([, v]) => v.length).map(([k, v]) => (
        <div key={k} style={{ marginTop: 6 }}>
          <div className="lt-form-section">{humanise(k)}</div>
          <div className="lt-table-wrap">
            <table className="lt-table is-zebra">
              <thead>
                <tr>
                  {Object.keys(v[0]).map((c) => (
                    <th key={c} scope="col" className={typeof v[0][c] === 'number' ? 'num' : ''}>{humanise(c)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {v.map((row, i) => (
                  <tr key={i}>
                    {Object.keys(v[0]).map((c) => (
                      <td key={c} className={typeof row[c] === 'number' ? 'num' : ''}>
                        {typeof row[c] === 'number' ? fmtAmount(row[c], { blankZero: true }) : String(row[c] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Snapshot keys are column names; show readable captions. */
const SNAPSHOT_LABELS: Record<string, string> = {
  name: 'Name', alias: 'Alias', parent_id: 'Under', group_id: 'Under',
  stock_group_id: 'Under', category_id: 'Category', unit_id: 'Units',
  nature: 'Nature of Group', opening_balance: 'Opening Balance',
  opening_balance_type: 'Opening Balance Dr/Cr', opening_qty: 'Opening Quantity',
  opening_rate: 'Opening Rate', opening_value: 'Opening Value',
  mailing_name: 'Mailing Name', pincode: 'Pincode', email: 'E-Mail',
  contact_person: 'Contact Person', pan: 'PAN/IT No.', gstin: 'GSTIN/UIN',
  registration_type: 'Registration Type', gst_applicable: 'GST Applicability',
  hsn_sac: 'HSN/SAC', tax_type: 'Type of Duty/Tax', tax_rate: 'Tax Rate',
  cess_rate: 'Cess Rate', taxability: 'Taxability',
  bank_account_no: 'A/c No.', bank_ifsc: 'IFS Code', bank_name: 'Bank Name',
  bank_branch: 'Branch', is_bill_wise: 'Maintain balances bill-by-bill',
  is_cost_centre: 'Cost centres are applicable', credit_period_days: 'Credit Period',
  credit_limit: 'Credit Limit', is_inactive: 'Is Inactive', symbol: 'Symbol',
  formal_name: 'Formal Name', decimal_places: 'Number of Decimal Places',
  unit_type: 'Type', conversion: 'Conversion', parent_type: 'Type of Voucher',
  abbreviation: 'Abbreviation', numbering_method: 'Method of Voucher Numbering',
  affects_stock: 'Affects Stock', standard_cost: 'Standard Cost',
  standard_price: 'Standard Price', costing_method: 'Costing Method',
  reorder_level: 'Re-order Level', part_number: 'Part No.',
  date: 'Date', voucher_number: 'Voucher No.', voucher_type: 'Voucher Type',
  reference_no: 'Reference No.', reference_date: 'Reference Date',
  narration: 'Narration', party_ledger_id: 'Party A/c Name',
  place_of_supply: 'Place of Supply', total_amount: 'Amount',
  is_optional: 'Optional', is_post_dated: 'Post-Dated', is_cancelled: 'Cancelled',
  mode: 'Mode', entries: 'Ledger Entries', inventory: 'Inventory Entries',
  bills: 'Bill-wise Details', ledger: 'Particulars', dr_cr: 'Dr/Cr',
  stock_item: 'Name of Item', godown: 'Godown', quantity: 'Quantity',
  rate: 'Rate', amount: 'Amount', direction: 'In/Out', unit: 'Unit',
  discount_pct: 'Discount %', bill_name: 'Bill Reference', bill_type: 'Type of Ref',
  due_date: 'Due Date', cost_centre: 'Cost Centre',
  financial_year_from: 'Financial year beginning from',
  books_begin_from: 'Books beginning from', base_currency: 'Base Currency Symbol',
  currency_name: 'Formal Name', edit_log_enabled: 'Maintain Edit Log',
  gst_enabled: 'Enable GST', tds_enabled: 'Enable TDS', maintain: 'Maintain',
};

const DATE_KEYS = new Set([
  'date', 'reference_date', 'due_date', 'applicable_from', 'period_from',
  'period_to', 'financial_year_from', 'books_begin_from',
]);

function humanise(s: string) {
  return SNAPSHOT_LABELS[s]
    || s.replace(/_id$/, '').replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function snapshotValue(key: string, v: unknown) {
  if (v === '' || v === null || v === undefined) return null;
  if (DATE_KEYS.has(key) && /^\d{4}-\d{2}-\d{2}/.test(String(v))) return fmtDate(String(v));
  return String(v);
}
