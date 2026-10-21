import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useApp, useScreen, fmtDate } from '../state';
import {
  Panel, DataTable, Dropdown, AcceptBar, Field, SearchInput, EmptyState, Alert, Spinner,
  StatTile, Pill, IconCheckCircle, IconInbox,
} from '../ui';
import { GO_TO_TARGETS } from '../nav';

/** Downloads a server response without leaving the screen. */
function download(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* A card that reads as one action: title, one line of why, one button. */
function ActionCard({
  title, note, button, onClick, keys, disabled, tone,
}: {
  title: string;
  note: React.ReactNode;
  button: string;
  onClick: () => void;
  keys?: string;
  disabled?: boolean;
  tone?: 'strong';
}) {
  return (
    <div className="lt-tile" style={{ gap: 8 }}>
      <span className="lt-tile-label">{title}</span>
      <span className="lt-tile-note" style={{ whiteSpace: 'normal', lineHeight: 1.5 }}>{note}</span>
      <span>
        <button
          type="button"
          className={`lt-btn lt-inline-btn ${tone === 'strong' ? 'lt-btn-strong' : ''}`}
          onClick={onClick}
          disabled={disabled}
        >
          <span>{button}</span>
          {keys ? <kbd className="lt-key">{keys}</kbd> : null}
        </button>
      </span>
    </div>
  );
}

/* ============================================================== Data menu */

export function DataMenu() {
  const app = useApp();
  const navigate = useNavigate();
  const [busy, setBusy] = useState('');
  const [confirmRepair, setConfirmRepair] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const backup = () => {
    if (!app.company) return;
    download(api.backupUrl());
    app.setNotice('Backup downloaded. It contains every master, voucher and edit-log version.');
  };

  const onFile = async (file: File) => {
    setBusy('restore');
    try {
      const text = await file.text();
      const dump = JSON.parse(text);
      const out = await api.restore(dump);
      await app.reloadCompanies();
      await app.selectCompany(out.company.id);
      app.setNotice(`Restored "${out.company.name}" with its full edit-log history.`);
      navigate('/');
    } catch (e) {
      app.setError(e instanceof Error ? e.message : 'Restore failed');
    } finally {
      setBusy('');
    }
  };

  useScreen('Data', [
    { keys: 'Alt+B', label: 'Backup', onClick: backup, disabled: !app.company, group: 'Data', strong: true },
    { keys: 'Alt+R', label: 'Restore', onClick: () => fileRef.current?.click(), group: 'Data' },
    { keys: 'Alt+P', label: 'Repair', onClick: () => setConfirmRepair(true), group: 'Maintenance' },
    { keys: 'Alt+E', label: 'Exchange', onClick: () => navigate('/exchange'), group: 'Maintenance' },
    { keys: 'Esc', label: 'Quit', onClick: () => navigate('/'), group: 'Action' },
  ], [app.company?.id, busy]);

  return (
    <div className="lt-stack">
      <div className="lt-tiles">
        <ActionCard
          title="Backup"
          note="One JSON file holding this company, every master, every voucher and the complete edit log."
          button="Download a backup"
          keys="Alt+B"
          tone="strong"
          disabled={!app.company}
          onClick={backup}
        />
        <ActionCard
          title="Restore"
          note="Creates a new company from a backup file and carries the version history across."
          button={busy === 'restore' ? 'Restoring...' : 'Choose a backup file'}
          keys="Alt+R"
          disabled={busy === 'restore'}
          onClick={() => fileRef.current?.click()}
        />
        <ActionCard
          title="Repair"
          note="Asks SQL Server to rebuild its query statistics. It changes no data."
          button="Rebuild statistics"
          keys="Alt+P"
          onClick={() => setConfirmRepair(true)}
        />
      </div>

      <Panel title="Restore from a file" sub={app.company?.name}>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onFile(f);
          }}
          style={{
            margin: '12px 16px 16px',
            padding: '28px 18px',
            border: `1.5px dashed ${dragging ? 'var(--primary)' : 'var(--border-strong)'}`,
            borderRadius: 'var(--radius)',
            background: dragging ? 'var(--primary-50)' : 'var(--surface-2)',
            textAlign: 'center',
            transition: 'background .12s, border-color .12s',
          }}
        >
          {busy === 'restore' ? (
            <div className="lt-loading"><Spinner /><span>Restoring the backup...</span></div>
          ) : (
            <>
              <IconInbox />
              <div style={{ fontWeight: 600, marginTop: 6 }}>Drop a LedgerTrail backup here</div>
              <div className="lt-muted lt-small" style={{ marginTop: 4 }}>
                A restore never touches the company you have open - it creates a new one.
              </div>
              <div style={{ marginTop: 12 }}>
                <button type="button" className="lt-btn lt-inline-btn" onClick={() => fileRef.current?.click()}>
                  <span>Choose a file</span><kbd className="lt-key">Alt+R</kbd>
                </button>
              </div>
            </>
          )}
        </div>
      </Panel>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onFile(f);
        }}
      />

      {confirmRepair ? (
        <AcceptBar
          question="Rebuild database statistics?"
          detail="This only refreshes SQL Server's query planning data. No record changes."
          yesLabel="Repair"
          onYes={async () => {
            setConfirmRepair(false);
            try {
              const out = await api.repair();
              app.setNotice(out.message);
            } catch (e) {
              app.setError(e instanceof Error ? e.message : 'Repair failed');
            }
          }}
          onNo={() => setConfirmRepair(false)}
        />
      ) : null}
    </div>
  );
}

/* ========================================================== Exchange menu */

export function ExchangeMenu() {
  const app = useApp();
  const navigate = useNavigate();

  useScreen('Exchange', [
    { keys: 'Alt+O', label: 'Import', onClick: () => navigate('/import'), group: 'Exchange' },
    { keys: 'Alt+E', label: 'Export', onClick: () => navigate('/export'), group: 'Exchange' },
    { keys: 'Alt+M', label: 'E-mail a report', onClick: () => navigate('/email'), group: 'Exchange' },
    { keys: 'Alt+B', label: 'Backup and Restore', onClick: () => navigate('/data'), group: 'Exchange' },
    { keys: 'Esc', label: 'Quit', onClick: () => navigate('/'), group: 'Action' },
  ], []);

  return (
    <div className="lt-stack">
      <div className="lt-tiles">
        <ActionCard
          title="Import"
          note="Read CSV or JSON rows through the normal validation path. Each row lands in the Edit Log."
          button="Open Import"
          keys="Alt+O"
          tone="strong"
          onClick={() => navigate('/import')}
        />
        <ActionCard
          title="Export"
          note="Write ledgers, vouchers, reports or the edit log out as CSV or JSON, with a live preview."
          button="Open Export"
          keys="Alt+E"
          onClick={() => navigate('/export')}
        />
        <ActionCard
          title="E-mail a report"
          note="Composes a report into your own mail client. LedgerTrail does not send mail itself."
          button="Compose"
          keys="Alt+M"
          onClick={() => navigate('/email')}
        />
        <ActionCard
          title="Backup and Restore"
          note="A whole-company JSON file, history included."
          button="Open Data"
          keys="Alt+B"
          onClick={() => navigate('/data')}
        />
      </div>
      <Panel title="Exchange" sub={app.company?.name}>
        <div className="lt-prose">
          <p>
            Import and Export move records in and out of the company you have open. Both go
            through the same validation as hand entry, so an imported ledger is indistinguishable
            from one you typed - including its place in the Edit Log.
          </p>
        </div>
      </Panel>
    </div>
  );
}

/* ============================================================== Export */

export function ExportScreen() {
  const app = useApp();
  const navigate = useNavigate();
  const [kinds, setKinds] = useState<{ key: string; label: string }[]>([]);
  const [kind, setKind] = useState('ledgers');
  const [format, setFormat] = useState('csv');
  const [preview, setPreview] = useState<{ headers: string[]; rows: unknown[][]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.dataCatalogue().then((c) => setKinds(c.exports)).catch(() => setKinds([]));
  }, []);

  useEffect(() => {
    if (!app.company) return;
    setPreview(null);
    setLoading(true);
    api.exportPreview(kind, { from: app.period?.from, to: app.period?.to })
      .then(setPreview)
      .catch((e) => app.setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, app.company?.id, app.period?.from, app.period?.to]);

  const label = kinds.find((k) => k.key === kind)?.label || kind;

  const doExport = () => {
    download(api.exportUrl(kind, { format, from: app.period?.from, to: app.period?.to }));
    app.setNotice(`${label} exported as ${format.toUpperCase()}.`);
  };

  useScreen('Export', [
    { keys: 'Ctrl+A', label: 'Export', onClick: doExport, strong: true, group: 'Action', disabled: !preview?.total },
    { keys: 'Alt+I', label: 'Go to Import', onClick: () => navigate('/import'), group: 'Action' },
    { keys: 'Esc', label: 'Quit', onClick: () => navigate(-1), group: 'Action' },
  ], [kind, format, app.period?.from, preview?.total]);

  return (
    <div className="lt-stack">
      <div className="lt-filters">
        <label className="lt-fl">
          <span>Data set</span>
          <Dropdown
            value={kind}
            size="sm"
            width={210}
            ariaLabel="Data set to export"
            options={kinds.map((k) => ({ value: k.key, label: k.label }))}
            onChange={setKind}
          />
        </label>
        <label className="lt-fl">
          <span>Format</span>
          <div className="lt-segmented lt-segmented-sm" role="radiogroup" aria-label="Export format">
            <button type="button" role="radio" aria-checked={format === 'csv'} className={format === 'csv' ? 'is-on' : ''} onClick={() => setFormat('csv')}>CSV</button>
            <button type="button" role="radio" aria-checked={format === 'json'} className={format === 'json' ? 'is-on' : ''} onClick={() => setFormat('json')}>JSON</button>
          </div>
        </label>
        <span className="lt-sep" />
        <button
          type="button"
          className="lt-btn lt-inline-btn lt-btn-strong"
          onClick={doExport}
          disabled={!preview?.total}
        >
          <span>Export {format.toUpperCase()}</span><kbd className="lt-key">Ctrl+A</kbd>
        </button>
        <span className="lt-meta">
          {loading ? 'Reading...' : preview ? `${preview.total} rows` : 'No preview'}
        </span>
      </div>

      <Panel
        title={`Preview - ${label}`}
        sub={preview ? `first ${Math.min(50, preview.total)} of ${preview.total} rows` : ''}
      >
        <DataTable
          rows={preview?.rows || []}
          loading={loading}
          rowKey={(_r, i) => i}
          columns={(preview?.headers || []).map((h, ci) => ({
            key: h,
            header: h,
            num: /amount|value|rate|qty|balance|debit|credit|total|version|level/i.test(h),
            sortValue: (row: unknown[]) => row[ci] as string | number,
            cell: (row: unknown[]) => String(row[ci] ?? ''),
          }))}
          empty={
            <EmptyState
              title="This data set is empty for the current period"
              note="Change the period in the bar at the top, or pick another data set."
            />
          }
        />
      </Panel>
    </div>
  );
}

/* ============================================================== Import */

export function ImportScreen() {
  const app = useApp();
  const navigate = useNavigate();
  const [kinds, setKinds] = useState<{ key: string; label: string }[]>([]);
  const [kind, setKind] = useState('ledgers');
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ imported: number; total: number; failed: { line: number; error: string }[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.dataCatalogue().then((c) => setKinds(c.imports)).catch(() => setKinds([]));
  }, []);

  const parse = (): unknown[] => {
    const trimmed = text.trim();
    if (!trimmed) throw new Error('Paste some rows, or choose a file');
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [parsed];
    }
    return parseCsv(trimmed);
  };

  /* Count the rows up front, so the button can say what it is about to do. */
  const rowCount = useMemo(() => {
    try { return text.trim() ? parse().length : 0; } catch { return -1; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const run = async () => {
    setResult(null);
    setRunning(true);
    try {
      const rows = parse();
      const out = await api.importRows(kind, rows);
      setResult(out);
      await app.reloadLookups();
      if (out.imported) {
        app.setNotice(`${out.imported} of ${out.total} rows imported. Each one is recorded in the Edit Log.`);
      } else {
        app.setError('No rows could be imported. See the result table for the reason on each row.');
      }
    } catch (e) {
      app.setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setRunning(false);
    }
  };

  const takeFile = async (f: File) => {
    setFileName(f.name);
    setResult(null);
    setText(await f.text());
  };

  useScreen('Import', [
    {
      keys: 'Ctrl+A', label: running ? 'Importing...' : 'Import', onClick: run,
      strong: true, group: 'Action', disabled: running || rowCount <= 0,
      title: rowCount < 0 ? 'The text below is not valid CSV or JSON' : undefined,
    },
    { keys: 'Alt+F', label: 'Choose File', onClick: () => fileRef.current?.click(), group: 'Action' },
    {
      keys: 'Alt+S', label: 'Paste Sample', onClick: () => { setText(SAMPLES[kind] || ''); setFileName(''); },
      group: 'Action',
    },
    {
      keys: 'F12', label: 'Clear', onClick: () => { setText(''); setFileName(''); setResult(null); },
      disabled: !text, group: 'Action',
    },
    { keys: 'Alt+E', label: 'Go to Export', onClick: () => navigate('/export'), group: 'Action' },
    { keys: 'Esc', label: 'Quit', onClick: () => navigate(-1), group: 'Action' },
  ], [kind, text, running, rowCount]);

  const sample = SAMPLES[kind] || '';

  return (
    <div className="lt-stack">
      <div className="lt-filters">
        <label className="lt-fl">
          <span>Import into</span>
          <Dropdown
            value={kind}
            size="sm"
            width={190}
            ariaLabel="What to import into"
            options={kinds.map((k) => ({ value: k.key, label: k.label }))}
            onChange={(v) => { setKind(v); setResult(null); }}
          />
        </label>
        <button type="button" className="lt-btn lt-inline-btn" onClick={() => fileRef.current?.click()}>
          <span>Choose file</span><kbd className="lt-key">Alt+F</kbd>
        </button>
        <button
          type="button"
          className="lt-btn lt-inline-btn"
          onClick={() => { setText(sample); setFileName(''); }}
        >
          <span>Paste sample</span><kbd className="lt-key">Alt+S</kbd>
        </button>
        <button
          type="button"
          className="lt-btn lt-inline-btn lt-btn-strong"
          onClick={run}
          disabled={running || rowCount <= 0}
        >
          <span>{running ? 'Importing...' : rowCount > 0 ? `Import ${rowCount} row${rowCount === 1 ? '' : 's'}` : 'Import'}</span>
          <kbd className="lt-key">Ctrl+A</kbd>
        </button>
        <span className="lt-meta">
          {fileName ? <Pill tone="neutral">{fileName}</Pill> : null}
        </span>
      </div>

      {rowCount < 0 ? (
        <Alert tone="error">
          That text is neither a CSV with a header row nor a JSON array. Fix it, or choose a file.
        </Alert>
      ) : null}

      <Panel
        title="Rows to import"
        sub="CSV with a header row, or a JSON array"
        actions={rowCount > 0 ? <Pill tone="good">{rowCount} rows ready</Pill> : null}
      >
        <div
          style={{ padding: '12px 18px 4px' }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) takeFile(f);
          }}
        >
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setFileName(''); }}
            spellCheck={false}
            aria-label="Rows to import"
            placeholder={`Paste rows here, or drop a file.\n\n${sample}`}
            style={{
              width: '100%', minHeight: 230, fontFamily: 'var(--mono)', fontSize: 12.5,
              border: `1px solid ${dragging ? 'var(--primary)' : 'var(--border-strong)'}`,
              background: dragging ? 'var(--primary-50)' : 'var(--surface)',
              color: 'var(--text)',
              borderRadius: 'var(--radius-sm)',
              padding: 10, outline: 'none', resize: 'vertical',
            }}
          />
        </div>
        <div className="lt-hint">
          Columns may refer to other masters by name - a ledger&apos;s <code>under</code> is a
          group name, a stock item&apos;s <code>units</code> is a unit symbol. Every imported
          row goes through the same validation as hand entry and is written to the Edit Log.
        </div>
      </Panel>

      {result ? (
        <Panel
          title="Result"
          sub={`${result.imported} of ${result.total} imported`}
          actions={
            result.failed.length
              ? <Pill tone="bad">{result.failed.length} rejected</Pill>
              : <Pill tone="good">All rows accepted</Pill>
          }
        >
          {result.failed.length ? (
            <DataTable
              rows={result.failed}
              rowKey={(r) => r.line}
              columns={[
                { key: 'line', header: 'Row', num: true, width: 80, sortValue: (r) => r.line, cell: (r) => r.line },
                { key: 'error', header: 'Problem', cell: (r) => r.error, className: 'wrap' },
              ]}
            />
          ) : (
            <EmptyState
              icon={<IconCheckCircle />}
              title="Every row imported cleanly"
              note={`${result.imported} record${result.imported === 1 ? '' : 's'} created, each one recorded in the Edit Log.`}
            />
          )}
        </Panel>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept=".csv,.json,text/csv,application/json"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) takeFile(f);
        }}
      />
    </div>
  );
}

/** Minimal CSV reader: header row, comma separated, quotes honoured. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }

  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

const SAMPLES: Record<string, string> = {
  ledgers: 'name,under,opening_balance,opening_balance_type\nAcme Supplies,Sundry Creditors,0,Cr\nCity Power Ltd,Indirect Expenses,0,Dr',
  groups: 'name,under,nature\nFreight Charges,Indirect Expenses,Expenses',
  'stock-items': 'name,under,units,opening_qty,opening_rate,hsn_sac\nUSB-C Hub,Hardware,Nos,25,900,85176290',
  units: 'symbol,formal_name,decimal_places\nBox,Boxes,0',
  godowns: 'name,address\nGodown - Madurai,Ring Road',
  vouchers: '[\n  {\n    "voucher_type": "Payment",\n    "date": "2026-07-01",\n    "narration": "Imported payment",\n    "entries": [\n      { "ledger": "Rent", "dr_cr": "Dr", "amount": 20000 },\n      { "ledger": "Cash", "dr_cr": "Cr", "amount": 20000 }\n    ]\n  }\n]',
};

/* =============================================================== E-mail */

export function EmailScreen() {
  const app = useApp();
  const navigate = useNavigate();
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [kind, setKind] = useState('trial-balance');
  const [body, setBody] = useState('');
  const [touched, setTouched] = useState(false);
  const [preview, setPreview] = useState<{ headers: string[]; rows: unknown[][]; total: number } | null>(null);

  useEffect(() => {
    if (!app.company) return;
    api.exportPreview(kind, { from: app.period?.from, to: app.period?.to })
      .then(setPreview)
      .catch(() => setPreview(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, app.company?.id, app.period?.from, app.period?.to]);

  useEffect(() => {
    if (!app.company || !preview) return;
    setSubject(`${app.company.name} - ${kind.replace(/-/g, ' ')} to ${fmtDate(app.period?.to)}`);
    const lines = preview.rows.slice(0, 20).map((r) => (r as unknown[]).join('  |  '));
    setBody(
      `${app.company.name}\n${fmtDate(app.period?.from)} to ${fmtDate(app.period?.to)}\n\n`
      + `${preview.headers.join('  |  ')}\n${'-'.repeat(60)}\n${lines.join('\n')}\n\n`
      + (preview.total > 20 ? `... and ${preview.total - 20} more rows.\n\n` : '')
      + 'Sent from LedgerTrail.',
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, kind, app.company?.id]);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim());
  const toError = touched && !emailOk ? 'Enter one valid e-mail address.' : undefined;

  const send = () => {
    setTouched(true);
    if (!emailOk) { app.setError('Enter the recipient’s e-mail address first.'); return; }
    const url = `mailto:${encodeURIComponent(to)}`
      + `?subject=${encodeURIComponent(subject)}`
      + `&body=${encodeURIComponent(body)}`;
    window.location.href = url;
    app.setNotice('Your mail client should now be open with the report in the message body.');
  };

  useScreen('E-mail', [
    { keys: 'Ctrl+A', label: 'Open in Mail', onClick: send, strong: true, group: 'Action' },
    {
      keys: 'Alt+E', label: 'Download instead',
      onClick: () => download(api.exportUrl(kind, { format: 'csv', from: app.period?.from, to: app.period?.to })),
      group: 'Action',
      title: 'Get a CSV you can attach yourself',
    },
    { keys: 'Esc', label: 'Quit', onClick: () => navigate(-1), group: 'Action' },
  ], [to, subject, body, kind]);

  return (
    <div className="lt-stack">
      {preview ? (
        <div className="lt-tiles">
          <StatTile label="Report" value={kind.replace(/-/g, ' ')} />
          <StatTile label="Rows" value={preview.total} note="first 20 go into the message" />
          <StatTile label="Period" value={fmtDate(app.period?.to)} note={`from ${fmtDate(app.period?.from)}`} />
        </div>
      ) : null}

      <Panel
        title="E-mail a report"
        sub={app.company?.name}
        style={{ maxWidth: 940 }}
        footer={
          <>
            <span>LedgerTrail does not send mail itself - this opens your own client.</span>
            <span style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="lt-btn lt-inline-btn"
                onClick={() => download(api.exportUrl(kind, { format: 'csv', from: app.period?.from, to: app.period?.to }))}
              >
                <kbd className="lt-key">Alt+E</kbd><span>Download CSV</span>
              </button>
              <button type="button" className="lt-btn lt-inline-btn lt-btn-strong" onClick={send}>
                <kbd className="lt-key">Ctrl+A</kbd><span>Open in Mail</span>
              </button>
            </span>
          </>
        }
      >
        <div className="lt-form">
          <Field label="Report">
            <Dropdown
              value={kind}
              width={240}
              ariaLabel="Report to send"
              options={[
                { value: 'trial-balance', label: 'Trial Balance' },
                { value: 'day-book', label: 'Day Book' },
                { value: 'ledgers', label: 'Ledgers' },
                { value: 'stock-summary', label: 'Stock Summary' },
                { value: 'edit-log', label: 'Edit Log' },
              ]}
              onChange={setKind}
            />
          </Field>
          <Field label="To" error={toError} required>
            <input
              type="email"
              value={to}
              placeholder="name@example.com"
              aria-label="Recipient"
              className={toError ? 'is-invalid' : ''}
              onBlur={() => setTouched(true)}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
          <Field label="Subject">
            <input value={subject} aria-label="Subject" onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field label="Message" wide>
            <textarea
              value={body}
              aria-label="Message body"
              onChange={(e) => setBody(e.target.value)}
              style={{ minHeight: 250, fontFamily: 'var(--mono)', fontSize: 12 }}
            />
          </Field>
        </div>
        <div className="lt-hint">
          For a spreadsheet attachment use <strong>Download CSV</strong> and attach the file yourself.
        </div>
      </Panel>
    </div>
  );
}

/* ================================================================= Help */

const SHORTCUTS: { group: string; items: [string, string][] }[] = [
  {
    group: 'Everywhere',
    items: [
      ['Alt+G', 'Go To - jump to any screen'],
      ['Ctrl+K', 'Go To - the same palette'],
      ['Alt+F3', 'Select or change company'],
      ['Ctrl+B', 'Show or hide the button panel'],
      ['Esc', 'Go back one screen'],
      ['Ctrl+A', 'Accept and save the current screen'],
      ['F1', 'This help'],
      ['Ctrl+P', 'Print the current screen'],
    ],
  },
  {
    group: 'Vouchers',
    items: [
      ['F4', 'Contra'], ['F5', 'Payment'], ['F6', 'Receipt'], ['F7', 'Journal'],
      ['F8', 'Sales'], ['F9', 'Purchase'],
      ['Ctrl+F8', 'Credit Note'], ['Ctrl+F9', 'Debit Note'],
      ['Alt+F7', 'Stock Journal'], ['Alt+F8', 'Delivery Note'], ['Alt+F9', 'Receipt Note'],
      ['Alt+B', 'Balance the voucher to the party ledger'],
      ['Alt+L', 'Add a ledger line'],
      ['Alt+I', 'Add an inventory line'],
    ],
  },
  {
    group: 'Lists and reports',
    items: [
      ['Alt+C', 'Create a new record'],
      ['Alt+D', 'Delete the selected record'],
      ['Alt+X', 'Cancel or un-cancel a voucher'],
      ['Ctrl+R', 'Restore a deleted voucher'],
      ['Ctrl+I', 'Show or hide inactive records'],
      ['Alt+F1', 'Expand or collapse every group'],
      ['F12', 'Show deleted / clear filters'],
      ['F2', 'Change the current date'],
      ['Alt+F2', 'Change the reporting period'],
      ['Arrow keys', 'Move the selection'],
      ['Home / End', 'Jump to the first or last row'],
      ['Enter', 'Open the selected row'],
    ],
  },
  {
    group: 'Audit',
    items: [
      ['Ctrl+E', 'Edit Log for the selected record'],
      ['Ctrl+L', 'Edit Log Summary'],
      ['Alt+Up', 'Newer version'],
      ['Alt+Down', 'Older version'],
    ],
  },
];

export function HelpScreen() {
  const app = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  useScreen('Help', [
    { keys: 'Alt+G', label: 'Go To', onClick: () => {}, disabled: true, group: 'Help' },
    { keys: 'F12', label: 'Clear Search', onClick: () => setSearch(''), disabled: !search, group: 'Help' },
    { keys: 'Esc', label: 'Quit', onClick: () => navigate(-1), group: 'Action' },
  ], [search]);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return SHORTCUTS;
    return SHORTCUTS
      .map((g) => ({ ...g, items: g.items.filter(([k, w]) => `${k} ${w}`.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length);
  }, [search]);

  const screens = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return GO_TO_TARGETS;
    return GO_TO_TARGETS.filter((t) => `${t.label} ${t.keywords || ''} ${t.section}`.toLowerCase().includes(q));
  }, [search]);

  return (
    <div className="lt-stack">
      <div className="lt-filters">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search shortcuts and screens"
          autoFocus
          style={{ flex: '1 1 320px' }}
        />
        <span className="lt-meta">
          {groups.reduce((n, g) => n + g.items.length, 0)} shortcuts &middot; {screens.length} screens
        </span>
      </div>

      {!groups.length && !screens.length ? (
        <Panel title="Help">
          <EmptyState title={`Nothing matches "${search}"`} note="Try a key name such as Ctrl, or a word such as delete." />
        </Panel>
      ) : null}

      {groups.length ? (
        <div className="lt-split">
          {groups.map((s) => (
            <Panel key={s.group} title={s.group} sub={`${s.items.length}`}>
              <div className="lt-table-wrap">
                <table className="lt-table is-zebra">
                  <tbody>
                    {s.items.map(([key, what]) => (
                      <tr key={key}>
                        <td style={{ width: 130 }}><kbd className="lt-key">{key}</kbd></td>
                        <td className="wrap">{what}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ))}
        </div>
      ) : null}

      {screens.length ? (
        <Panel title="Screens" sub="everything reachable from Go To">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '12px 16px 14px' }}>
            {screens.map((t) => (
              <button
                key={t.to}
                type="button"
                className="lt-check"
                onClick={() => navigate(t.to)}
                title={t.section}
              >
                {t.label}
              </button>
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel title="About LedgerTrail">
        <div className="lt-prose">
          <p>
            A keyboard-driven accounting application built around an <strong>Edit Log</strong>:
            every create, alter, delete and cancel is stored as a versioned snapshot with the
            user, the time and the exact fields that changed. Nothing is overwritten silently,
            and a deleted voucher keeps its whole history.
          </p>
          <p>
            Data lives in SQL Server
            {app.company ? <> &middot; current company <strong>{app.company.name}</strong></> : null}.
          </p>
        </div>
      </Panel>
    </div>
  );
}
