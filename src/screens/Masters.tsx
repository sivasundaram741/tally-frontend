import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, type MasterRow } from '../api';
import { useApp, useScreen, useDebounced, fmtAmount, fmtQty } from '../state';
import {
  Panel, NavMenu, DataTable, AcceptBar, Field, TextField, SelectField, YesNoField,
  SearchInput, CheckChip, Alert, EmptyState, Loading, Pill,
  type MenuEntry, type Column,
} from '../ui';
import { MASTER_FORMS, MASTER_MENU, type FormField } from '../masterForms';

/* The lookups payload key that backs each reference field. */
const REF_TO_TYPE: Record<string, string> = {
  groups: 'group',
  ledgers: 'ledger',
  stockGroups: 'stock-group',
  stockCategories: 'stock-category',
  units: 'unit',
  godowns: 'godown',
  costCentres: 'cost-centre',
  costCategories: 'cost-category',
  budgets: 'budget',
  currencies: 'currency',
  voucherTypes: 'voucher-type',
};

/* =========================================================== List of Masters */

export function MastersMenu({ mode }: { mode: 'create' | 'alter' | 'chart' }) {
  const app = useApp();
  const navigate = useNavigate();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    if (!app.company) { navigate('/companies'); return; }
    api.masterCounts().then(setCounts).catch(() => setCounts({}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.company?.id]);

  const title = mode === 'chart' ? 'Chart of Accounts' : mode === 'create' ? 'Create Master' : 'Alter Master';

  useScreen(title, [
    { keys: 'Alt+C', label: 'Create', onClick: () => navigate('/masters/create'), group: 'Mode', strong: mode !== 'create' },
    { keys: 'Alt+A', label: 'Alter', onClick: () => navigate('/masters/alter'), group: 'Mode' },
    { keys: 'Alt+H', label: 'Chart of Accounts', onClick: () => navigate('/masters/chart'), group: 'Mode' },
    {
      keys: 'Alt+F1',
      label: expanded ? 'Show Less' : 'Expand All',
      onClick: () => setExpanded((v) => !v),
      group: 'View',
      title: 'Show the advanced masters as well',
    },
    {
      keys: 'Ctrl+I',
      label: showInactive ? 'Hide Inactive' : 'Show Inactive',
      onClick: () => setShowInactive((v) => !v),
      group: 'View',
    },
    { keys: 'F3', label: 'Change Company', onClick: () => navigate('/companies'), group: 'View' },
    { keys: 'Ctrl+E', label: 'Edit Log', onClick: () => navigate('/edit-log?kind=Master'), group: 'Audit' },
    { keys: 'Esc', label: 'Quit', onClick: () => navigate('/'), group: 'Action' },
  ], [expanded, showInactive, mode]);

  const entries = useMemo<MenuEntry[]>(() => {
    const out: MenuEntry[] = [];
    for (const group of MASTER_MENU) {
      const items = group.items.filter((i) => expanded || !i.advanced);
      if (!items.length) continue;
      out.push({ kind: 'section', label: group.section });
      for (const item of items) {
        const count = item.key ? counts[item.key] : undefined;
        out.push({
          label: item.label,
          keywords: group.section,
          note: mode !== 'create' && count !== undefined ? count : undefined,
          onSelect: () => {
            if (item.to) { navigate(item.to); return; }
            if (!item.key) return;
            navigate(mode === 'create'
              ? `/masters/${item.key}/new`
              : `/masters/${item.key}${showInactive ? '?inactive=1' : ''}`);
          },
        });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, showInactive, counts, mode]);

  const total = Object.values(counts).reduce((s, n) => s + Number(n || 0), 0);

  return (
    <div className="lt-stack">
      <div className="lt-filters">
        <CheckChip checked={expanded} onChange={setExpanded}>Show advanced masters</CheckChip>
        <CheckChip checked={showInactive} onChange={setShowInactive}>Include inactive</CheckChip>
        <span className="lt-sep" />
        <button type="button" className={`lt-check ${mode === 'create' ? 'is-on' : ''}`} onClick={() => navigate('/masters/create')}>
          Create
        </button>
        <button type="button" className={`lt-check ${mode === 'alter' ? 'is-on' : ''}`} onClick={() => navigate('/masters/alter')}>
          Alter
        </button>
        <button type="button" className={`lt-check ${mode === 'chart' ? 'is-on' : ''}`} onClick={() => navigate('/masters/chart')}>
          Chart of Accounts
        </button>
        <span className="lt-meta">{total} records in this company</span>
      </div>

      <div className="lt-row" style={{ alignItems: 'stretch' }}>
        <Panel
          title={title}
          className="lt-menu-panel"
          footer={
            <>
              <span>{mode === 'create' ? 'Choose what to create' : 'Choose a master to open its list'}</span>
              <span><kbd className="lt-key">Enter</kbd></span>
            </>
          }
        >
          <NavMenu entries={entries} filterLabel="Filter masters" />
        </Panel>

        {mode === 'chart' ? (
          <div className="lt-grow">
            <Panel title="Masters in this company" sub={app.company?.name}>
              <DataTable
                rows={Object.entries(MASTER_FORMS)}
                rowKey={([k]) => k}
                columns={[
                  { key: 'label', header: 'Master', sortValue: ([, d]) => d.label, cell: ([, d]) => d.label },
                  { key: 'group', header: 'Classification', sortValue: ([, d]) => d.group, cell: ([, d]) => d.group },
                  {
                    key: 'count', header: 'Count', num: true, width: 90,
                    sortValue: ([k]) => counts[k] ?? 0,
                    cell: ([k]) => counts[k] ?? <span className="lt-muted">0</span>,
                  },
                ] as Column<[string, (typeof MASTER_FORMS)[string]]>[]}
                onRowClick={([k]) => navigate(`/masters/${k}`)}
                tall
              />
            </Panel>
          </div>
        ) : (
          <div className="lt-grow">
            <Panel title={mode === 'create' ? 'Creating masters' : 'Altering masters'}>
              <div className="lt-prose">
                <p>
                  {mode === 'create'
                    ? 'Pick a master type to open a blank creation screen. Accept with Ctrl+A; the new record lands in the Edit Log as version 1.'
                    : 'Pick a master type to list what exists. From the list, Enter alters the highlighted record, Alt+D deletes it and Ctrl+E opens its version history.'}
                </p>
                <p>
                  Cost Category and Cost Centre appear once <strong>Show advanced masters</strong> is on.
                </p>
              </div>
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================ Master list */

export function MasterList() {
  const app = useApp();
  const navigate = useNavigate();
  const { type = '' } = useParams();
  const [sp] = useSearchParams();
  const def = MASTER_FORMS[type];

  const [rows, setRows] = useState<MasterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(sp.get('inactive') === '1');
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState<MasterRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MasterRow | null>(null);

  const query = useDebounced(search);

  const load = async () => {
    if (!def) return;
    try {
      const list = await api.masters(type, { search: query, includeInactive: includeInactive ? 1 : '' });
      setRows(list);
      setCursor((c) => Math.min(c, Math.max(0, list.length - 1)));
    } catch (e) {
      app.setError(e instanceof Error ? e.message : 'Could not load masters');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setLoading(true); load(); /* eslint-disable-next-line */ },
    [type, query, includeInactive, app.company?.id]);

  useScreen(def ? `List of ${def.plural}` : 'Masters', [
    { keys: 'Alt+C', label: `Create ${def?.label || ''}`.trim(), onClick: () => navigate(`/masters/${type}/new`), group: 'Action', strong: true },
    {
      keys: 'Enter', label: 'Alter',
      onClick: () => selected && navigate(`/masters/${type}/${selected.id}`),
      disabled: !selected, group: 'Action',
      title: selected ? `Alter "${selected._display}"` : 'Nothing is selected',
    },
    {
      keys: 'Alt+D', label: 'Delete',
      onClick: () => selected && setConfirmDelete(selected),
      disabled: !selected, danger: true, group: 'Action',
      title: selected ? `Delete "${selected._display}"` : 'Nothing is selected',
    },
    {
      keys: 'Ctrl+I', label: includeInactive ? 'Hide Inactive' : 'Show Inactive',
      onClick: () => setIncludeInactive((v) => !v), group: 'View',
    },
    {
      keys: 'F12', label: 'Clear Search', onClick: () => setSearch(''),
      disabled: !search, group: 'View',
    },
    {
      keys: 'Ctrl+E', label: 'Edit Log',
      onClick: () => selected && navigate(`/edit-log/${type}/${selected.id}`),
      disabled: !selected, group: 'Audit',
    },
    { keys: 'Esc', label: 'Quit', onClick: () => navigate('/masters/alter'), group: 'Action' },
  ], [type, selected?.id, includeInactive, search]);

  if (!def) {
    return (
      <Panel title="Masters">
        <EmptyState title="Unknown master type" note={`There is no master called "${type}".`} />
      </Panel>
    );
  }

  const columns: Column<MasterRow>[] = def.list.map((c) => ({
    key: c.col,
    header: c.label,
    num: c.num,
    sortValue: (row) => row[c.col] as string | number,
    cell: (row) => {
      const v = row[c.col];
      if (v === undefined || v === null || v === '') return <span className="lt-muted">--</span>;
      if (c.num) return typeof v === 'number' ? fmtAmount(v, { blankZero: true }) : String(v);
      return String(v);
    },
  }));
  columns.push({
    key: '_status',
    header: 'Status',
    width: 96,
    sortValue: (row) => (row.is_inactive ? 1 : 0),
    cell: (row) => (row.is_inactive
      ? <Pill tone="inactive">Inactive</Pill>
      : row.is_reserved ? <Pill tone="neutral">Built-in</Pill> : ''),
  });

  const inactiveCount = rows.filter((r) => r.is_inactive).length;

  return (
    <div className="lt-stack">
      <div className="lt-filters">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={`Search ${def.plural.toLowerCase()}`}
          ariaLabel={`Search ${def.plural}`}
          autoFocus
        />
        <CheckChip checked={includeInactive} onChange={setIncludeInactive}>
          Include inactive{inactiveCount ? ` (${inactiveCount})` : ''}
        </CheckChip>
        <span className="lt-sep" />
        <button
          type="button"
          className="lt-btn lt-inline-btn lt-btn-strong"
          onClick={() => navigate(`/masters/${type}/new`)}
        >
          <kbd className="lt-key">Alt+C</kbd><span>Create</span>
        </button>
        <span className="lt-meta">
          {rows.length} {rows.length === 1 ? def.label.toLowerCase() : def.plural.toLowerCase()}
          {search ? ' matching' : ''}
        </span>
      </div>

      <Panel
        title={`List of ${def.plural}`}
        sub={app.company?.name}
        footer={
          <>
            <span>
              <kbd className="lt-key">Enter</kbd> alter &middot;{' '}
              <kbd className="lt-key">Alt+D</kbd> delete &middot;{' '}
              <kbd className="lt-key">Ctrl+E</kbd> version history
            </span>
            <span>{selected ? <strong>{selected._display}</strong> : 'Nothing selected'}</span>
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
          onRowClick={(r) => navigate(`/masters/${type}/${r.id}`)}
          rowClass={(r) => (r.is_inactive ? 'is-muted' : '')}
          empty={
            <EmptyState
              title={search ? `No ${def.plural.toLowerCase()} match "${search}"` : `No ${def.plural.toLowerCase()} yet`}
              note={search ? 'Try a shorter search, or clear it.' : 'Create the first one to get started.'}
              action={
                <button
                  type="button"
                  className="lt-btn lt-inline-btn lt-btn-strong"
                  onClick={() => (search ? setSearch('') : navigate(`/masters/${type}/new`))}
                >
                  <span>{search ? 'Clear the search' : `Create a ${def.label}`}</span>
                </button>
              }
            />
          }
        />
      </Panel>

      {confirmDelete ? (
        <AcceptBar
          question={`Delete ${def.label.toLowerCase()} "${confirmDelete._display}"?`}
          detail="The deletion itself is recorded in the Edit Log, with the last version kept."
          yesLabel="Delete"
          noLabel="Keep"
          tone="danger"
          onYes={async () => {
            try {
              await api.deleteMaster(type, confirmDelete.id);
              app.setNotice(`${def.label} "${confirmDelete._display}" deleted. The deletion is recorded in the Edit Log.`);
              await app.reloadLookups();
              await load();
            } catch (e) {
              app.setError(e instanceof Error ? e.message : 'Delete failed');
            } finally {
              setConfirmDelete(null);
            }
          }}
          onNo={() => setConfirmDelete(null)}
        />
      ) : null}
    </div>
  );
}

/* ================================================================ Master form */

export function MasterForm() {
  const app = useApp();
  const navigate = useNavigate();
  const { type = '', id } = useParams();
  const def = MASTER_FORMS[type];
  const isNew = !id || id === 'new';

  const [form, setForm] = useState<Record<string, unknown>>({});
  const [ready, setReady] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [touched, setTouched] = useState(false);
  const [extraLookups, setExtraLookups] = useState<Record<string, MasterRow[]>>({});
  const [reserved, setReserved] = useState(false);

  useEffect(() => {
    (async () => {
      if (!def) return;
      setReady(false);
      setTouched(false);
      if (isNew) {
        const blank: Record<string, unknown> = {};
        for (const f of def.fields) {
          blank[f.col] = f.type === 'yesno' ? false
            : f.type === 'number' ? 0
              : f.type === 'select' ? (f.options?.[0] ?? '')
                : f.type === 'ref' ? ''
                  : '';
        }
        if (type === 'ledger') blank.opening_balance_type = 'Dr';
        if (type === 'unit') { blank.unit_type = 'Simple'; blank.conversion = 1; }
        if (type === 'currency') { blank.decimal_places = 2; blank.space_between = true; }
        if (type === 'voucher-type') { blank.starting_number = 1; blank.use_common_narration = true; }
        if (type === 'stock-group') blank.quantities_added = true;
        if (type === 'godown') blank.allow_storage = true;
        if (type === 'cost-category') blank.allocate_revenue = true;
        setForm(blank);
        setReserved(false);
      } else {
        const row = await api.master(type, Number(id));
        const next: Record<string, unknown> = {};
        for (const f of def.fields) {
          const v = row[f.col];
          next[f.col] = f.type === 'yesno' ? !!v : (v ?? '');
        }
        setForm(next);
        setReserved(!!row.is_reserved);
      }
      setReady(true);
    })().catch((e) => app.setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, id]);

  // Reference lists that the shared lookups payload does not carry.
  useEffect(() => {
    if (!def) return;
    const needed = new Set(def.fields.filter((f) => f.type === 'ref' && f.ref).map((f) => f.ref!));
    for (const ref of needed) {
      if (app.lookups[ref] || extraLookups[ref]) continue;
      const masterType = REF_TO_TYPE[ref];
      if (!masterType) continue;
      api.masters(masterType).then((rows) => setExtraLookups((m) => ({ ...m, [ref]: rows }))).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, app.lookups]);

  const optionsFor = (f: FormField): { value: string | number; label: string }[] => {
    const rows = (f.ref && (app.lookups[f.ref] || extraLookups[f.ref])) || [];
    return rows
      .filter((r) => !(type === f.ref && Number(r.id) === Number(id)))
      .map((r) => ({ value: r.id, label: r._display || String(r.name ?? r.symbol ?? r.id) }));
  };

  const nameValue = def ? String(form[def.nameCol] ?? '').trim() : '';
  const canSave = !!nameValue;
  const nameError = touched && !canSave ? 'This field cannot be blank.' : undefined;

  const tryAccept = () => {
    setTouched(true);
    if (!canSave) {
      app.setError(`Enter a ${def?.label.toLowerCase() || 'record'} name before accepting.`);
      return;
    }
    setConfirm(true);
  };

  const save = async () => {
    try {
      const payload: Record<string, unknown> = {};
      for (const f of def.fields) {
        if (f.showIf && !f.showIf(form)) continue;
        payload[f.col] = f.type === 'yesno' ? (form[f.col] ? 1 : 0) : form[f.col];
      }
      if (isNew) {
        const row = await api.createMaster(type, payload);
        app.setNotice(`${def.label} "${row._display}" created.`);
      } else {
        const row = await api.updateMaster(type, Number(id), payload);
        app.setNotice(`${def.label} "${row._display}" altered. The change is recorded in the Edit Log.`);
      }
      await app.reloadLookups();
      navigate(`/masters/${type}`);
    } catch (e) {
      app.setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setConfirm(false);
    }
  };

  const title = def ? `${def.label} ${isNew ? 'Creation' : 'Alteration'}` : 'Master';

  useScreen(title, [
    { keys: 'Ctrl+A', label: 'Accept', onClick: tryAccept, strong: true, group: 'Save' },
    { keys: 'Esc', label: 'Quit', onClick: () => navigate(`/masters/${type}`), group: 'Save' },
    {
      keys: 'Ctrl+E', label: 'Edit Log',
      onClick: () => navigate(`/edit-log/${type}/${id}`),
      disabled: isNew, group: 'Audit',
      title: isNew ? 'Available once the record is saved' : 'Every version of this record',
    },
  ], [type, id, form, canSave]);

  if (!def) {
    return (
      <Panel title="Master">
        <EmptyState title="Unknown master type" note={`There is no master called "${type}".`} />
      </Panel>
    );
  }
  if (!ready) return <Loading what={`Loading the ${def.label.toLowerCase()}`} />;

  const set = (col: string) => (v: unknown) => setForm((f) => ({ ...f, [col]: v }));

  let lastSection = '';
  return (
    <>
      <Panel
        title={title}
        sub={isNew ? app.company?.name : nameValue || app.company?.name}
        style={{ maxWidth: 1000 }}
        footer={
          <>
            <span>
              {isNew
                ? 'Saved as version 1 in the Edit Log.'
                : 'Saved as a new version; the previous one stays readable.'}
            </span>
            <span style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="lt-btn lt-inline-btn" onClick={() => navigate(`/masters/${type}`)}>
                <kbd className="lt-key">Esc</kbd><span>Cancel</span>
              </button>
              <button
                type="button"
                className="lt-btn lt-inline-btn lt-btn-strong"
                onClick={tryAccept}
                disabled={!canSave}
              >
                <kbd className="lt-key">Ctrl+A</kbd><span>Accept</span>
              </button>
            </span>
          </>
        }
      >
        {reserved ? (
          <div style={{ padding: '10px 18px 2px' }}>
            <Alert tone="info">
              This is a built-in master. It can be altered but not renamed or deleted.
            </Alert>
          </div>
        ) : null}

        <div className="lt-form lt-form-2col">
          {def.fields.map((f) => {
            if (f.showIf && !f.showIf(form)) return null;
            const section = f.section && f.section !== lastSection ? f.section : null;
            if (section) lastSection = f.section!;
            const isName = f.col === def.nameCol;
            const control = (() => {
              switch (f.type) {
                case 'yesno':
                  return (
                    <YesNoField
                      label={f.label}
                      value={!!form[f.col]}
                      onChange={set(f.col)}
                      hint={f.hint}
                    />
                  );
                case 'select':
                  return (
                    <SelectField
                      label={f.label}
                      value={(form[f.col] as string) ?? ''}
                      onChange={set(f.col)}
                      options={(f.options || []).map((o) => ({ value: o, label: o || 'None' }))}
                      hint={f.hint}
                    />
                  );
                case 'ref':
                  return (
                    <SelectField
                      label={f.label}
                      value={(form[f.col] as string) ?? ''}
                      onChange={(v) => set(f.col)(v === '' ? '' : Number(v))}
                      options={optionsFor(f)}
                      allowBlank
                      blankLabel="Primary"
                      hint={f.hint}
                    />
                  );
                case 'textarea':
                  return (
                    <Field label={f.label} hint={f.hint} wide>
                      <textarea
                        value={(form[f.col] as string) ?? ''}
                        onChange={(e) => set(f.col)(e.target.value)}
                      />
                    </Field>
                  );
                case 'number':
                  return (
                    <TextField
                      label={f.label}
                      type="number"
                      value={(form[f.col] as number) ?? 0}
                      onChange={(v) => set(f.col)(v === '' ? 0 : Number(v))}
                      hint={f.hint}
                      maxWidth={f.width}
                      disabled={reserved && isName}
                    />
                  );
                case 'date':
                  return (
                    <TextField
                      label={f.label}
                      type="date"
                      value={(form[f.col] as string) ?? ''}
                      onChange={set(f.col)}
                      hint={f.hint}
                      maxWidth={f.width || 200}
                    />
                  );
                default:
                  return (
                    <TextField
                      label={f.label}
                      value={(form[f.col] as string) ?? ''}
                      onChange={set(f.col)}
                      onBlur={isName ? () => setTouched(true) : undefined}
                      hint={f.hint}
                      error={isName ? nameError : undefined}
                      required={isName}
                      maxWidth={f.width}
                      autoFocus={isName}
                      disabled={reserved && isName}
                    />
                  );
              }
            })();
            const wide = f.type === 'textarea';
            return (
              <React.Fragment key={f.col}>
                {section ? <div className="lt-form-section">{section}</div> : null}
                {wide ? <div className="lt-field-span">{control}</div> : control}
              </React.Fragment>
            );
          })}
        </div>
      </Panel>

      {confirm ? (
        <AcceptBar
          detail={isNew ? `Create ${def.label.toLowerCase()} "${nameValue}".` : `Save the changes to "${nameValue}".`}
          onYes={save}
          onNo={() => setConfirm(false)}
        />
      ) : null}
    </>
  );
}

/* ======================================================= Credit limits screen */

export function CreditLimits() {
  const app = useApp();
  const navigate = useNavigate();
  const [rows, setRows] = useState<MasterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const query = useDebounced(search);

  useEffect(() => {
    setLoading(true);
    api.masters('ledger').then((all) => {
      setRows(all.filter((l) => ['Sundry Debtors', 'Sundry Creditors'].includes(String(l.group_id_name || ''))));
    }).catch((e) => app.setError(e.message)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.company?.id]);

  useScreen('Credit Limits', [
    { keys: 'Esc', label: 'Quit', onClick: () => navigate(-1), group: 'Action' },
  ], []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => r._display.toLowerCase().includes(q)) : rows;
  }, [rows, query]);

  const withLimit = shown.filter((r) => Number(r.credit_limit) > 0).length;

  return (
    <div className="lt-stack">
      <div className="lt-filters">
        <SearchInput value={search} onChange={setSearch} placeholder="Search parties" />
        <span className="lt-meta">{shown.length} parties &middot; {withLimit} with a limit set</span>
      </div>
      <Panel title="Credit Limits" sub="Sundry Debtors and Creditors">
        <DataTable
          rows={shown}
          loading={loading}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(`/masters/ledger/${r.id}`)}
          columns={[
            { key: 'party', header: 'Party', sortValue: (r) => r._display, cell: (r) => r._display },
            {
              key: 'under', header: 'Under', width: 180,
              sortValue: (r) => String(r.group_id_name || ''),
              cell: (r) => String(r.group_id_name || ''),
            },
            {
              key: 'days', header: 'Credit Period (days)', num: true, width: 160,
              sortValue: (r) => Number(r.credit_period_days) || 0,
              cell: (r) => fmtQty(Number(r.credit_period_days)) || <span className="lt-muted">--</span>,
            },
            {
              key: 'limit', header: 'Credit Limit', num: true, width: 160,
              sortValue: (r) => Number(r.credit_limit) || 0,
              cell: (r) => fmtAmount(Number(r.credit_limit), { blankZero: true }) || <span className="lt-muted">No limit</span>,
            },
          ]}
          empty={<EmptyState title="No party ledgers yet" note="Create a ledger under Sundry Debtors or Sundry Creditors first." />}
        />
      </Panel>
    </div>
  );
}
