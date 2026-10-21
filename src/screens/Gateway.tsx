import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type EditLogEntry } from '../api';
import { useApp, useScreen, fmtAmount, fmtCompact, fmtDate, fmtDateTime, fmtPeriod } from '../state';
import {
  Panel, NavMenu, StatTile, Pill, Alert, ActionPill, EmptyState, SkeletonTable,
  type MenuEntry,
} from '../ui';
import { PeriodDialog, DateDialog } from '../dialogs';

/* Re-exported so the report screens can keep importing them from here. */
export { PeriodDialog, DateDialog };

const QUICK = [
  { keys: 'F5', label: 'Payment', to: '/vouchers/new/Payment' },
  { keys: 'F6', label: 'Receipt', to: '/vouchers/new/Receipt' },
  { keys: 'F8', label: 'Sales', to: '/vouchers/new/Sales' },
  { keys: 'F9', label: 'Purchase', to: '/vouchers/new/Purchase' },
  { keys: 'F7', label: 'Journal', to: '/vouchers/new/Journal' },
  { keys: 'F4', label: 'Contra', to: '/vouchers/new/Contra' },
];

export default function Gateway() {
  const app = useApp();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [recent, setRecent] = useState<EditLogEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPeriod, setShowPeriod] = useState(false);
  const [showDate, setShowDate] = useState(false);

  useEffect(() => {
    if (!app.company) { navigate('/companies'); return; }
    setLoading(true);
    api.dashboard({ from: app.period?.from, to: app.period?.to })
      .then(setStats)
      .catch((e) => app.setError(e.message))
      .finally(() => setLoading(false));
    api.editLog({ limit: 8 }).then(setRecent).catch(() => setRecent([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.company?.id, app.period?.from, app.period?.to]);

  useScreen('Gateway', [
    { keys: 'F2', label: 'Date', onClick: () => setShowDate(true), group: 'Period' },
    { keys: 'Alt+F2', label: 'Period', onClick: () => setShowPeriod(true), group: 'Period' },
    { keys: 'F3', label: 'Company', onClick: () => navigate('/companies'), group: 'Period' },
    { keys: 'F4', label: 'Contra', onClick: () => navigate('/vouchers/new/Contra'), group: 'Voucher' },
    { keys: 'F5', label: 'Payment', onClick: () => navigate('/vouchers/new/Payment'), group: 'Voucher' },
    { keys: 'F6', label: 'Receipt', onClick: () => navigate('/vouchers/new/Receipt'), group: 'Voucher' },
    { keys: 'F7', label: 'Journal', onClick: () => navigate('/vouchers/new/Journal'), group: 'Voucher' },
    { keys: 'F8', label: 'Sales', onClick: () => navigate('/vouchers/new/Sales'), group: 'Voucher' },
    { keys: 'F9', label: 'Purchase', onClick: () => navigate('/vouchers/new/Purchase'), group: 'Voucher' },
    { keys: 'Ctrl+E', label: 'Edit Log', onClick: () => navigate('/edit-log'), group: 'Audit', strong: true },
    { keys: 'Ctrl+L', label: 'Edit Log Summary', onClick: () => navigate('/edit-log/summary'), group: 'Audit' },
  ], [app.company?.id]);

  const entries = useMemo<MenuEntry[]>(() => [
    { kind: 'section', label: 'MASTERS' },
    { label: 'Create', onSelect: () => navigate('/masters/create'), keywords: 'new ledger group' },
    { label: 'Alter', onSelect: () => navigate('/masters/alter'), keywords: 'edit change' },
    { label: 'Chart of Accounts', onSelect: () => navigate('/masters/chart') },
    { kind: 'section', label: 'TRANSACTIONS' },
    { label: 'Vouchers', onSelect: () => navigate('/vouchers') },
    { label: 'Day Book', onSelect: () => navigate('/day-book') },
    { kind: 'section', label: 'UTILITIES' },
    { label: 'Banking', onSelect: () => navigate('/reports/cash-bank') },
    { kind: 'section', label: 'REPORTS' },
    { label: 'Balance Sheet', onSelect: () => navigate('/reports/balance-sheet') },
    { label: 'Profit & Loss A/c', onSelect: () => navigate('/reports/profit-loss') },
    { label: 'Stock Summary', onSelect: () => navigate('/reports/stock-summary') },
    { label: 'Ratio Analysis', onSelect: () => navigate('/reports/ratio-analysis') },
    { label: 'Display More Reports', onSelect: () => navigate('/reports') },
    { kind: 'rule' },
    { kind: 'section', label: 'AUDIT' },
    { label: 'Edit Log', onSelect: () => navigate('/edit-log') },
    { label: 'Edit Log Summary', onSelect: () => navigate('/edit-log/summary') },
    { kind: 'rule' },
    { label: 'Quit', align: 'right', onSelect: () => navigate('/companies') },
  ], [navigate]);

  if (!app.company) return null;

  const balanced = stats && Math.abs(stats.difference) < 0.01;

  return (
    <div className="lt-stack">
      {stats && !balanced ? (
        <Alert tone="warn">
          The Balance Sheet is out by <strong>{fmtAmount(stats.difference)}</strong>. Open it to
          find the group that does not tie up.
        </Alert>
      ) : null}

      {loading ? (
        <div className="lt-tiles">
          {Array.from({ length: 5 }, (_, i) => (
            <div className="lt-tile" key={i}>
              <div className="lt-skeleton" style={{ width: '55%', height: 9 }} />
              <div className="lt-skeleton" style={{ width: '75%', height: 18, marginTop: 6 }} />
            </div>
          ))}
        </div>
      ) : stats ? (
        <div className="lt-tiles">
          <StatTile
            label="Sales"
            value={fmtCompact(stats.sales)}
            note={fmtPeriod(app.period)}
            onClick={() => navigate('/day-book?type=Sales')}
          />
          <StatTile
            label="Purchases"
            value={fmtCompact(stats.purchases)}
            note="this period"
            onClick={() => navigate('/day-book?type=Purchase')}
          />
          <StatTile
            label={stats.netProfit >= 0 ? 'Net Profit' : 'Net Loss'}
            value={`${fmtCompact(stats.netProfit)} ${stats.netProfit >= 0 ? 'Cr' : 'Dr'}`}
            note="Profit & Loss A/c"
            tone={stats.netProfit >= 0 ? 'good' : 'bad'}
            onClick={() => navigate('/reports/profit-loss')}
          />
          <StatTile
            label="Closing Stock"
            value={fmtCompact(stats.closingStock)}
            note="at average cost"
            onClick={() => navigate('/reports/stock-summary')}
          />
          <StatTile
            label="Vouchers"
            value={stats.vouchers}
            note={`${stats.cancelledVouchers} cancelled, ${stats.deletedVouchers} deleted`}
            onClick={() => navigate('/day-book')}
          />
          <StatTile
            label="Edit Log"
            value={stats.editLogEntries}
            note={`${stats.alteredEntries} alterations recorded`}
            onClick={() => navigate('/edit-log')}
          />
        </div>
      ) : null}

      <div className="lt-row" style={{ alignItems: 'stretch' }}>
        <Panel
          title="Gateway"
          className="lt-menu-panel"
          footer={<><span>Arrow keys, or the highlighted letter</span><span><kbd className="lt-key">Enter</kbd> to open</span></>}
        >
          <NavMenu entries={entries} filterAfter={99} />
        </Panel>

        <div className="lt-grow lt-stack">
          <Panel
            title="Quick entry"
            sub={<span className="lt-muted">press the key anywhere</span>}
          >
            <div className="lt-quick">
              {QUICK.map((q) => (
                <button key={q.keys} type="button" onClick={() => navigate(q.to)}>
                  <span>{q.label}</span>
                  <kbd className="lt-key">{q.keys}</kbd>
                </button>
              ))}
            </div>
          </Panel>

          <Panel
            title="Current Status"
            sub={app.company.name}
          >
            <dl className="lt-kv">
              <dt>Current Period</dt>
              <dd>
                <button type="button" className="lt-period-btn" onClick={() => setShowPeriod(true)}>
                  <b>{fmtPeriod(app.period)}</b>
                </button>
              </dd>
              <dt>Current Date</dt>
              <dd>
                <button type="button" className="lt-period-btn" onClick={() => setShowDate(true)}>
                  <b>{fmtDate(app.currentDate)}</b>
                </button>
              </dd>
              <dt>Books begin from</dt><dd>{fmtDate(app.company.books_begin_from)}</dd>
              <dt>Maintain</dt><dd>{app.company.maintain}</dd>
              <dt>GSTIN/UIN</dt><dd>{app.company.gstin || <span className="lt-muted">Not set</span>}</dd>
              <dt>Edit Log</dt>
              <dd>
                {app.company.edit_log_enabled ? (
                  <>
                    <Pill tone="good">Enabled</Pill>{' '}
                    <span className="lt-muted lt-small">every change is recorded</span>
                  </>
                ) : (
                  <>
                    <Pill tone="bad">Disabled</Pill>{' '}
                    <span className="lt-muted lt-small">alterations leave no trail</span>
                  </>
                )}
              </dd>
              {stats ? (
                <>
                  <dt>Difference in Balance Sheet</dt>
                  <dd>
                    {balanced
                      ? <Pill tone="good">Nil</Pill>
                      : <Pill tone="bad">{fmtAmount(stats.difference)}</Pill>}
                  </dd>
                </>
              ) : null}
            </dl>
          </Panel>

          <Panel
            title="Recent changes"
            sub={<button type="button" className="lt-check" onClick={() => navigate('/edit-log')}>Open the Edit Log</button>}
          >
            {recent === null ? (
              <SkeletonTable rows={4} cols={3} />
            ) : recent.length === 0 ? (
              <EmptyState title="Nothing recorded yet" note="Create or alter anything and it appears here." />
            ) : (
              <div className="lt-table-wrap">
                <table className="lt-table is-zebra">
                  <tbody>
                    {recent.slice(0, 8).map((r) => (
                      <tr
                        key={r.id}
                        className="is-clickable"
                        onClick={() => navigate(`/edit-log/${r.entity_type}/${r.entity_id}`)}
                      >
                        <td style={{ width: 92 }}><ActionPill action={r.action} /></td>
                        <td>{r.entity_label}</td>
                        <td className="lt-muted" style={{ width: 150, textAlign: 'right' }}>
                          {fmtDateTime(r.logged_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      </div>

      {showPeriod ? (
        <PeriodDialog
          from={app.period?.from || ''}
          to={app.period?.to || ''}
          onClose={() => setShowPeriod(false)}
          onApply={(f, t) => { app.setPeriodRange(f, t); setShowPeriod(false); }}
        />
      ) : null}

      {showDate ? (
        <DateDialog
          value={app.currentDate}
          onClose={() => setShowDate(false)}
          onApply={(d) => { app.setCurrentDate(d); setShowDate(false); }}
        />
      ) : null}
    </div>
  );
}
