import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type ReportNode } from '../api';
import { useApp, useScreen, useDebounced, fmtAmount, fmtCompact, fmtDate, fmtQty, fmtPeriod } from '../state';
import {
  Panel, NavMenu, DataTable, TreeCell, Amount, Alert, EmptyState, Loading, SearchInput,
  StatTile, Pill, type MenuEntry, type Column,
} from '../ui';
import { PeriodDialog } from '../dialogs';

/* --------------------------------------------------------------- helpers */

function usePeriodButton() {
  const app = useApp();
  const [open, setOpen] = useState(false);
  const dialog = open ? (
    <PeriodDialog
      from={app.period?.from || ''}
      to={app.period?.to || ''}
      onClose={() => setOpen(false)}
      onApply={(f, t) => { app.setPeriodRange(f, t); setOpen(false); }}
    />
  ) : null;
  return { open: () => setOpen(true), dialog };
}

interface FlatRow {
  node: ReportNode;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  key: string;
}

const keyOf = (n: ReportNode, prefix = '') => `${prefix}/${n.type}-${n.id}-${n.name}`;

function flattenWithKeys(nodes: ReportNode[], expanded: Set<string>, depth = 0, prefix = ''): FlatRow[] {
  const out: FlatRow[] = [];
  for (const n of nodes) {
    const key = keyOf(n, prefix);
    const hasChildren = (n.children?.length ?? 0) > 0;
    const isOpen = expanded.has(key);
    out.push({ node: n, depth, hasChildren, expanded: isOpen, key });
    if (hasChildren && isOpen) out.push(...flattenWithKeys(n.children, expanded, depth + 1, key));
  }
  return out;
}

function allKeys(nodes: ReportNode[], prefix = ''): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    const key = keyOf(n, prefix);
    if (n.children?.length) {
      out.push(key);
      out.push(...allKeys(n.children, key));
    }
  }
  return out;
}

/** Expansion state plus the Expand-all / Collapse-all pair every tree needs. */
function useTreeState(nodes: ReportNode[]) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  // Read the nodes through a ref, so expandAll keeps one identity for the life
  // of the screen; the side-button list is rebuilt whenever it changes.
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const toggle = useCallback((k: string) => {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  }, []);
  const expandAll = useCallback(() => setExpanded(new Set(allKeys(nodesRef.current))), []);
  const collapseAll = useCallback(() => setExpanded(new Set()), []);
  const rows = useMemo(() => flattenWithKeys(nodes, expanded), [nodes, expanded]);
  const total = useMemo(() => allKeys(nodes).length, [nodes]);
  return { expanded, toggle, expandAll, collapseAll, rows, allOpen: expanded.size >= total && total > 0 };
}

function TreeControls({
  onExpand, onCollapse, allOpen,
}: { onExpand: () => void; onCollapse: () => void; allOpen: boolean }) {
  return (
    <button
      type="button"
      className="lt-check"
      onClick={allOpen ? onCollapse : onExpand}
      title="Alt+F1"
    >
      {allOpen ? 'Collapse all' : 'Expand all'}
    </button>
  );
}

/** Quantity cell: number right-aligned with its unit in a fixed slot. */
function Qty({ value, unit }: { value: number; unit?: string }) {
  if (!value) return null;
  return (
    <span className="lt-amt">
      <span className="lt-amt-v">{fmtQty(value)}</span>
      <span className="lt-amt-dc lt-amt-unit">{unit || ''}</span>
    </span>
  );
}

/** Renders a group/ledger tree with indentation. */
function TreeTable({
  tree, amountOf, amountLabel = 'Closing Balance', onLeafClick, total, totalLabel = 'Total',
}: {
  tree: ReturnType<typeof useTreeState>;
  amountOf: (n: ReportNode) => number;
  amountLabel?: string;
  onLeafClick?: (n: ReportNode) => void;
  total?: number;
  totalLabel?: string;
}) {
  if (!tree.rows.length) {
    return <EmptyState title="Nothing to show" note="No balances fall under this heading for the period." />;
  }
  return (
    <div className="lt-table-wrap">
      <table className="lt-table">
        <thead>
          <tr>
            <th scope="col">Particulars</th>
            <th scope="col" className="num" style={{ width: 180 }}>{amountLabel}</th>
          </tr>
        </thead>
        <tbody>
          {tree.rows.map((r) => (
            <tr
              key={r.key}
              className={`${r.node.type === 'ledger' ? 'lt-ledger-row' : 'lt-group-row'} is-clickable`}
              title={r.hasChildren ? (r.expanded ? 'Collapse' : 'Expand') : 'Open the ledger'}
              onClick={() => {
                if (r.hasChildren) tree.toggle(r.key);
                else onLeafClick?.(r.node);
              }}
            >
              <td>
                <TreeCell depth={r.depth} hasChildren={r.hasChildren} expanded={r.expanded}>
                  {r.node.name}
                </TreeCell>
              </td>
              <td className="num"><Amount value={amountOf(r.node)} /></td>
            </tr>
          ))}
        </tbody>
        {total !== undefined ? (
          <tfoot>
            <tr>
              <td>{totalLabel}</td>
              <td className="num"><Amount value={total} blankZero={false} /></td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

/* --------------------------------------------------------- reports menu */

export function ReportsMenu() {
  const navigate = useNavigate();
  const app = useApp();

  useScreen('Display More Reports', [
    { keys: 'F6', label: 'Balance Sheet', onClick: () => navigate('/reports/balance-sheet'), group: 'Report' },
    { keys: 'F7', label: 'Profit & Loss', onClick: () => navigate('/reports/profit-loss'), group: 'Report' },
    { keys: 'F8', label: 'Trial Balance', onClick: () => navigate('/reports/trial-balance'), group: 'Report' },
    { keys: 'Esc', label: 'Quit', onClick: () => navigate('/'), group: 'Action' },
  ], []);

  const entries = useMemo<MenuEntry[]>(() => [
    { kind: 'section', label: 'FINANCIAL STATEMENTS' },
    { label: 'Balance Sheet', note: 'F6', onSelect: () => navigate('/reports/balance-sheet'), keywords: 'assets liabilities' },
    { label: 'Profit & Loss A/c', note: 'F7', onSelect: () => navigate('/reports/profit-loss'), keywords: 'income expense' },
    { label: 'Trial Balance', note: 'F8', onSelect: () => navigate('/reports/trial-balance') },
    { label: 'Ratio Analysis', onSelect: () => navigate('/reports/ratio-analysis') },
    { kind: 'section', label: 'ACCOUNT BOOKS' },
    { label: 'Day Book', onSelect: () => navigate('/day-book') },
    { label: 'Ledger Vouchers', onSelect: () => navigate('/reports/ledgers'), keywords: 'statement' },
    { label: 'Cash/Bank Books', onSelect: () => navigate('/reports/cash-bank'), keywords: 'banking' },
    { kind: 'section', label: 'STATEMENTS OF INVENTORY' },
    { label: 'Stock Summary', onSelect: () => navigate('/reports/stock-summary') },
    { kind: 'section', label: 'OUTSTANDINGS' },
    { label: 'Bills Receivable', onSelect: () => navigate('/reports/outstandings/receivable'), keywords: 'debtors' },
    { label: 'Bills Payable', onSelect: () => navigate('/reports/outstandings/payable'), keywords: 'creditors' },
    { kind: 'section', label: 'AUDIT' },
    { label: 'Edit Log', onSelect: () => navigate('/edit-log') },
    { label: 'Edit Log Summary', onSelect: () => navigate('/edit-log/summary') },
  ], [navigate]);

  return (
    <div className="lt-row" style={{ alignItems: 'stretch' }}>
      <Panel
        title="Display More Reports"
        className="lt-menu-panel"
        sub={app.company?.name}
        footer={<><span>Arrow keys or the highlighted letter</span><span><kbd className="lt-key">Enter</kbd></span></>}
      >
        <NavMenu entries={entries} filterLabel="Filter reports" />
      </Panel>
      <div className="lt-grow">
        <Panel title="About these reports" sub={fmtPeriod(app.period)}>
          <div className="lt-prose">
            <p>
              Every report honours the period in the bar at the top. Change it
              with <kbd className="lt-key">Alt+F2</kbd> and the figures follow.
            </p>
            <p>
              Group rows expand to their ledgers; a ledger row opens its statement of
              vouchers, and from there <kbd className="lt-key">Ctrl+E</kbd> shows the full
              version history of any record.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- balance sheet */

export function BalanceSheet() {
  const app = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const period = usePeriodButton();

  useEffect(() => {
    if (!app.company) return;
    setLoading(true);
    api.balanceSheet({ from: app.period?.from, to: app.period?.to })
      .then(setData)
      .catch((e) => app.setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.company?.id, app.period?.from, app.period?.to]);

  const liabilities = useTreeState(data?.liabilities || []);
  const assets = useTreeState(data?.assets || []);
  const bothOpen = liabilities.allOpen && assets.allOpen;

  useScreen('Balance Sheet', [
    { keys: 'Alt+F2', label: 'Period', onClick: period.open, group: 'View' },
    {
      keys: 'Alt+F1', label: bothOpen ? 'Collapse All' : 'Expand All',
      onClick: () => {
        if (bothOpen) { liabilities.collapseAll(); assets.collapseAll(); }
        else { liabilities.expandAll(); assets.expandAll(); }
      },
      group: 'View',
    },
    { keys: 'F7', label: 'Profit & Loss', onClick: () => navigate('/reports/profit-loss'), group: 'Report' },
    { keys: 'F8', label: 'Trial Balance', onClick: () => navigate('/reports/trial-balance'), group: 'Report' },
    { keys: 'Ctrl+P', label: 'Print', onClick: () => window.print(), group: 'Report' },
    { keys: 'Esc', label: 'Quit', onClick: () => navigate('/'), group: 'Action' },
  ], [bothOpen]);

  if (loading && !data) return <Loading what="Building the Balance Sheet" />;
  if (!data) return <EmptyState title="The Balance Sheet is not available" />;

  const off = Math.abs(data.totals.difference) > 0.009;

  return (
    <div className="lt-stack">
      {off ? (
        <Alert tone="error">
          Difference in Balance Sheet: <strong>{fmtAmount(data.totals.difference)}</strong>.
          Expand the groups below to find the side that does not tie up.
        </Alert>
      ) : null}

      <div className="lt-split">
        <Panel
          title="Liabilities"
          sub={`as at ${fmtDate(data.period.to)}`}
          actions={<TreeControls allOpen={liabilities.allOpen} onExpand={liabilities.expandAll} onCollapse={liabilities.collapseAll} />}
        >
          <TreeTable
            tree={liabilities}
            amountOf={(n) => (n.amount !== undefined ? n.amount : -n.closing)}
            total={data.totals.liabilities}
            onLeafClick={(n) => n.type === 'ledger' && navigate(`/reports/ledger/${n.id}`)}
          />
        </Panel>
        <Panel
          title="Assets"
          sub={`as at ${fmtDate(data.period.to)}`}
          actions={<TreeControls allOpen={assets.allOpen} onExpand={assets.expandAll} onCollapse={assets.collapseAll} />}
        >
          <TreeTable
            tree={assets}
            amountOf={(n) => (n.amount !== undefined ? n.amount : n.closing)}
            total={data.totals.assets}
            onLeafClick={(n) => n.type === 'ledger' && navigate(`/reports/ledger/${n.id}`)}
          />
        </Panel>
      </div>
      {period.dialog}
    </div>
  );
}

/* --------------------------------------------------------- profit & loss */

export function ProfitLoss() {
  const app = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const period = usePeriodButton();

  useEffect(() => {
    if (!app.company) return;
    setLoading(true);
    api.profitLoss({ from: app.period?.from, to: app.period?.to })
      .then(setData)
      .catch((e) => app.setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.company?.id, app.period?.from, app.period?.to]);

  useScreen('Profit & Loss A/c', [
    { keys: 'Alt+F2', label: 'Period', onClick: period.open, group: 'View' },
    { keys: 'F6', label: 'Balance Sheet', onClick: () => navigate('/reports/balance-sheet'), group: 'Report' },
    { keys: 'F8', label: 'Trial Balance', onClick: () => navigate('/reports/trial-balance'), group: 'Report' },
    { keys: 'Ctrl+P', label: 'Print', onClick: () => window.print(), group: 'Report' },
    { keys: 'Esc', label: 'Quit', onClick: () => navigate('/'), group: 'Action' },
  ], []);

  if (loading && !data) return <Loading what="Building the Profit & Loss A/c" />;
  if (!data) return <EmptyState title="The Profit & Loss A/c is not available" />;

  const side = (rows: any[], extra?: { label: string; amount: number }) => (
    <div className="lt-table-wrap">
      <table className="lt-table is-zebra">
        <thead>
          <tr><th scope="col">Particulars</th><th scope="col" className="num" style={{ width: 170 }}>Amount</th></tr>
        </thead>
        <tbody>
          {rows.length === 0 && !extra ? (
            <tr><td colSpan={2}><span className="lt-muted">Nothing on this side.</span></td></tr>
          ) : null}
          {rows.map((r, i) => (
            <tr key={i} className="lt-group-row">
              <td>{r.name}</td>
              <td className="num"><Amount value={r.amount} /></td>
            </tr>
          ))}
          {extra ? (
            <tr className="lt-group-row">
              <td className="lt-total-row">{extra.label}</td>
              <td className="num lt-total-row"><Amount value={extra.amount} blankZero={false} /></td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );

  const gp = data.trading.grossProfit;
  const np = data.profitLoss.netProfit;

  return (
    <>
      <div className="lt-stack">
        <div className="lt-tiles">
          <StatTile label="Sales" value={fmtCompact(data.summary.sales)} note={fmtPeriod(app.period)} />
          <StatTile label="Purchases" value={fmtCompact(data.summary.purchases)} />
          <StatTile label="Opening Stock" value={fmtCompact(data.summary.openingStock)} />
          <StatTile label="Closing Stock" value={fmtCompact(data.summary.closingStock)} />
          <StatTile
            label={gp >= 0 ? 'Gross Profit' : 'Gross Loss'}
            value={fmtCompact(gp)}
            tone={gp >= 0 ? 'good' : 'bad'}
          />
          <StatTile
            label={np >= 0 ? 'Nett Profit' : 'Nett Loss'}
            value={fmtCompact(np)}
            tone={np >= 0 ? 'good' : 'bad'}
          />
        </div>

        <div className="lt-split">
          <Panel title="Trading Account" sub="Debit">
            {side(data.trading.debitSide, gp >= 0 ? { label: 'Gross Profit c/o', amount: gp } : undefined)}
          </Panel>
          <Panel title="Trading Account" sub="Credit">
            {side(data.trading.creditSide, gp < 0 ? { label: 'Gross Loss c/o', amount: -gp } : undefined)}
          </Panel>
        </div>

        <div className="lt-split">
          <Panel title="Profit & Loss A/c" sub="Debit">
            {side(
              [
                ...(gp < 0 ? [{ name: 'Gross Loss b/f', amount: -gp }] : []),
                ...data.profitLoss.debitSide,
              ],
              np >= 0 ? { label: 'Nett Profit', amount: np } : undefined,
            )}
          </Panel>
          <Panel title="Profit & Loss A/c" sub="Credit">
            {side(
              [
                ...(gp >= 0 ? [{ name: 'Gross Profit b/f', amount: gp }] : []),
                ...data.profitLoss.creditSide,
              ],
              np < 0 ? { label: 'Nett Loss', amount: -np } : undefined,
            )}
          </Panel>
        </div>
      </div>
      {period.dialog}
    </>
  );
}

/* --------------------------------------------------------- trial balance */

export function TrialBalance() {
  const app = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const period = usePeriodButton();

  useEffect(() => {
    if (!app.company) return;
    setLoading(true);
    api.trialBalance({ from: app.period?.from, to: app.period?.to })
      .then(setData)
      .catch((e) => app.setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.company?.id, app.period?.from, app.period?.to]);

  const tree = useTreeState(data?.rows || []);

  useScreen('Trial Balance', [
    { keys: 'Alt+F2', label: 'Period', onClick: period.open, group: 'View' },
    {
      keys: 'Alt+F1', label: tree.allOpen ? 'Collapse All' : 'Expand All',
      onClick: () => (tree.allOpen ? tree.collapseAll() : tree.expandAll()),
      group: 'View',
    },
    { keys: 'F6', label: 'Balance Sheet', onClick: () => navigate('/reports/balance-sheet'), group: 'Report' },
    { keys: 'F7', label: 'Profit & Loss', onClick: () => navigate('/reports/profit-loss'), group: 'Report' },
    { keys: 'Ctrl+P', label: 'Print', onClick: () => window.print(), group: 'Report' },
    { keys: 'Esc', label: 'Quit', onClick: () => navigate('/'), group: 'Action' },
  ], [tree.allOpen]);

  if (loading && !data) return <Loading what="Building the Trial Balance" />;
  if (!data) return <EmptyState title="The Trial Balance is not available" />;

  /* This statement sums the closing balance of each top-level group, which
     leaves stock and the P&L result outside it - so the two columns are not
     expected to tie, and the footer reports the gap without calling it an
     error. */
  const gap = data.totals.debit - data.totals.credit;

  return (
    <>
      <Panel
        title="Trial Balance"
        sub={fmtPeriod(app.period)}
        actions={<TreeControls allOpen={tree.allOpen} onExpand={tree.expandAll} onCollapse={tree.collapseAll} />}
        footer={
          <>
            <span>Click a group to expand it; click a ledger to open its vouchers.</span>
            <span>
              Debit <strong>{fmtAmount(data.totals.debit)}</strong>
              {'   '}&middot;{'   '}
              Credit <strong>{fmtAmount(data.totals.credit)}</strong>
              {Math.abs(gap) > 0.009 ? (
                <>
                  {'   '}&middot;{'   '}
                  Difference <strong>{fmtAmount(gap)} {gap > 0 ? 'Dr' : 'Cr'}</strong>
                </>
              ) : null}
            </span>
          </>
        }
      >
        <div className="lt-table-wrap">
          <table className="lt-table">
            <thead>
              <tr>
                <th scope="col">Particulars</th>
                <th scope="col" className="num" style={{ width: 150 }}>Debit</th>
                <th scope="col" className="num" style={{ width: 150 }}>Credit</th>
              </tr>
            </thead>
            <tbody>
              {tree.rows.map((r) => (
                <tr
                  key={r.key}
                  className={`${r.node.type === 'ledger' ? 'lt-ledger-row' : 'lt-group-row'} is-clickable`}
                  onClick={() => (r.hasChildren
                    ? tree.toggle(r.key)
                    : r.node.type === 'ledger' && navigate(`/reports/ledger/${r.node.id}`))}
                >
                  <td>
                    <TreeCell depth={r.depth} hasChildren={r.hasChildren} expanded={r.expanded}>
                      {r.node.name}
                    </TreeCell>
                  </td>
                  <td className="num">{r.node.closing >= 0 ? <Amount value={r.node.closing} /> : null}</td>
                  <td className="num">{r.node.closing < 0 ? <Amount value={-r.node.closing} /> : null}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Grand Total</td>
                <td className="num"><Amount value={data.totals.debit} blankZero={false} /></td>
                <td className="num"><Amount value={data.totals.credit} blankZero={false} /></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>
      {period.dialog}
    </>
  );
}

/* --------------------------------------------------------- stock summary */

export function StockSummary() {
  const app = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const query = useDebounced(search);
  const period = usePeriodButton();

  useEffect(() => {
    if (!app.company) return;
    setLoading(true);
    api.stockSummary({ from: app.period?.from, to: app.period?.to })
      .then(setData)
      .catch((e) => app.setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.company?.id, app.period?.from, app.period?.to]);

  useScreen('Stock Summary', [
    { keys: 'Alt+F2', label: 'Period', onClick: period.open, group: 'View' },
    { keys: 'F12', label: 'Clear Search', onClick: () => setSearch(''), disabled: !search, group: 'View' },
    { keys: 'Ctrl+P', label: 'Print', onClick: () => window.print(), group: 'Report' },
    { keys: 'Esc', label: 'Quit', onClick: () => navigate('/'), group: 'Action' },
  ], [search]);

  const rows = useMemo(() => {
    const all = data?.rows || [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((r: any) => `${r.name} ${r.stock_group_name || ''}`.toLowerCase().includes(q));
  }, [data, query]);

  if (loading && !data) return <Loading what="Valuing the stock" />;
  if (!data) return <EmptyState title="The Stock Summary is not available" />;

  const shownClosing = rows.reduce((s: number, r: any) => s + Number(r.closingValue || 0), 0);
  const negatives = rows.filter((r: any) => Number(r.closingQty) < 0).length;

  return (
    <div className="lt-stack">
      <div className="lt-filters">
        <SearchInput value={search} onChange={setSearch} placeholder="Search items or groups" />
        <span className="lt-meta">
          {rows.length} items &middot; closing value {fmtAmount(shownClosing)}
        </span>
      </div>

      {negatives ? (
        <Alert tone="warn">
          {negatives} item{negatives === 1 ? '' : 's'} show a negative closing quantity - more has gone
          out than came in.
        </Alert>
      ) : null}

      <Panel title="Stock Summary" sub={fmtPeriod(app.period)}>
        <DataTable
          rows={rows}
          rowKey={(r: any) => r.id}
          onRowClick={(r: any) => navigate(`/masters/stock-item/${r.id}`)}
          rowClass={(r: any) => (Number(r.closingQty) < 0 ? 'is-deleted' : '')}
          columns={[
            { key: 'name', header: 'Particulars', sortValue: (r: any) => r.name, cell: (r: any) => r.name },
            {
              key: 'group', header: 'Under', width: 150,
              sortValue: (r: any) => r.stock_group_name,
              cell: (r: any) => r.stock_group_name,
            },
            {
              key: 'oq', header: 'Opening Qty', num: true, width: 110,
              sortValue: (r: any) => r.openingQty,
              cell: (r: any) => <Qty value={r.openingQty} unit={r.unit_name} />,
            },
            {
              key: 'ov', header: 'Opening Value', num: true, width: 130,
              sortValue: (r: any) => r.openingValue,
              cell: (r: any) => <Amount value={r.openingValue} />,
            },
            {
              key: 'iq', header: 'Inwards Qty', num: true, width: 110,
              sortValue: (r: any) => r.inwardQty,
              cell: (r: any) => <Qty value={r.inwardQty} unit={r.unit_name} />,
            },
            {
              key: 'wq', header: 'Outwards Qty', num: true, width: 110,
              sortValue: (r: any) => r.outwardQty,
              cell: (r: any) => <Qty value={r.outwardQty} unit={r.unit_name} />,
            },
            {
              key: 'cq', header: 'Closing Qty', num: true, width: 110,
              sortValue: (r: any) => r.closingQty,
              cell: (r: any) => <Qty value={r.closingQty} unit={r.unit_name} />,
            },
            {
              key: 'cr', header: 'Closing Rate', num: true, width: 120,
              sortValue: (r: any) => r.closingRate,
              cell: (r: any) => <Amount value={r.closingRate} />,
            },
            {
              key: 'cv', header: 'Closing Value', num: true, width: 130,
              sortValue: (r: any) => r.closingValue,
              cell: (r: any) => <Amount value={r.closingValue} />,
            },
          ]}
          footer={
            <tr>
              <td colSpan={3}>Grand Total</td>
              <td className="num"><Amount value={data.totals.openingValue} blankZero={false} /></td>
              <td colSpan={4} />
              <td className="num"><Amount value={data.totals.closingValue} blankZero={false} /></td>
            </tr>
          }
          empty={
            <EmptyState
              title={search ? `No stock items match "${search}"` : 'No stock items yet'}
              note={search ? 'Try a shorter search.' : 'Create a stock item to see it valued here.'}
            />
          }
        />
      </Panel>
      {period.dialog}
    </div>
  );
}

/* -------------------------------------------------------- ratio analysis */

export function RatioAnalysis() {
  const app = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!app.company) return;
    setLoading(true);
    api.ratioAnalysis({ from: app.period?.from, to: app.period?.to })
      .then(setData)
      .catch((e) => app.setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.company?.id, app.period?.from, app.period?.to]);

  useScreen('Ratio Analysis', [
    { keys: 'F6', label: 'Balance Sheet', onClick: () => navigate('/reports/balance-sheet'), group: 'Report' },
    { keys: 'Ctrl+P', label: 'Print', onClick: () => window.print(), group: 'Report' },
    { keys: 'Esc', label: 'Quit', onClick: () => navigate('/'), group: 'Action' },
  ], []);

  if (loading && !data) return <Loading what="Working out the ratios" />;
  if (!data) return <EmptyState title="Ratio Analysis is not available" />;

  const headline = (data.ratios || []).slice(0, 4);

  return (
    <div className="lt-stack">
      {headline.length ? (
        <div className="lt-tiles">
          {headline.map((r: any) => (
            <StatTile
              key={r.name}
              label={r.name}
              value={Number(r.value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              note={r.note}
            />
          ))}
        </div>
      ) : null}

      <div className="lt-split">
        <Panel title="Principal Groups" sub={fmtPeriod(app.period)}>
          <DataTable
            rows={data.principal}
            rowKey={(r: any) => r.name}
            columns={[
              { key: 'name', header: 'Particulars', sortValue: (r: any) => r.name, cell: (r: any) => r.name },
              {
                key: 'value', header: 'Value', num: true, width: 150,
                sortValue: (r: any) => r.value,
                cell: (r: any) => <Amount value={r.value} blankZero={false} />,
              },
            ]}
          />
        </Panel>
        <Panel title="Principal Ratios">
          <DataTable
            rows={data.ratios}
            rowKey={(r: any) => r.name}
            columns={[
              { key: 'name', header: 'Ratio', width: 190, sortValue: (r: any) => r.name, cell: (r: any) => r.name },
              {
                key: 'value', header: 'Value', num: true, width: 90,
                sortValue: (r: any) => r.value,
                cell: (r: any) => r.value.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
              },
              { key: 'note', header: 'Basis', cell: (r: any) => <span className="lt-muted">{r.note || ''}</span> },
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- outstandings */

export function Outstandings() {
  const app = useApp();
  const navigate = useNavigate();
  const { kind = 'receivable' } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [search, setSearch] = useState('');
  const query = useDebounced(search);

  useEffect(() => {
    if (!app.company) return;
    setLoading(true);
    api.outstandings(kind, { from: app.period?.from, to: app.period?.to })
      .then(setData)
      .catch((e) => app.setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.company?.id, kind, app.period?.from, app.period?.to]);

  const title = kind === 'payable' ? 'Bills Payable' : 'Bills Receivable';
  const other = kind === 'payable' ? 'receivable' : 'payable';

  useScreen(title, [
    {
      keys: 'F4',
      label: kind === 'payable' ? 'Receivables' : 'Payables',
      onClick: () => navigate(`/reports/outstandings/${other}`),
      group: 'Report',
    },
    {
      keys: 'F12', label: onlyOverdue ? 'Show All' : 'Only Overdue',
      onClick: () => setOnlyOverdue((v) => !v), group: 'View',
    },
    { keys: 'Ctrl+P', label: 'Print', onClick: () => window.print(), group: 'Report' },
    { keys: 'Esc', label: 'Quit', onClick: () => navigate('/'), group: 'Action' },
  ], [kind, onlyOverdue]);

  const rows = useMemo(() => {
    let list = (data?.bills || []) as any[];
    if (onlyOverdue) list = list.filter((b) => Number(b.overdueDays) > 0);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((b) => `${b.ledger_name} ${b.bill_name}`.toLowerCase().includes(q));
    return list;
  }, [data, onlyOverdue, query]);

  if (loading && !data) return <Loading what={`Collecting ${title.toLowerCase()}`} />;
  if (!data) return <EmptyState title={`${title} is not available`} />;

  const shownTotal = rows.reduce((s, r: any) => s + Number(r.pending || 0), 0);
  const overdue = (data.bills || []).filter((b: any) => Number(b.overdueDays) > 0);
  const overdueTotal = overdue.reduce((s: number, r: any) => s + Number(r.pending || 0), 0);

  return (
    <div className="lt-stack">
      <div className="lt-tiles">
        <StatTile label="Total outstanding" value={fmtCompact(data.total)} note={`as at ${fmtDate(data.period.to)}`} />
        <StatTile
          label="Overdue"
          value={fmtCompact(overdueTotal)}
          note={`${overdue.length} bill${overdue.length === 1 ? '' : 's'} past the due date`}
          tone={overdue.length ? 'bad' : undefined}
        />
        <StatTile label="Bills" value={(data.bills || []).length} note={title} />
      </div>

      <div className="lt-filters">
        <SearchInput value={search} onChange={setSearch} placeholder="Search party or reference" />
        <button
          type="button"
          className={`lt-check ${onlyOverdue ? 'is-on' : ''}`}
          onClick={() => setOnlyOverdue((v) => !v)}
        >
          Only overdue
        </button>
        <span className="lt-sep" />
        <button type="button" className="lt-check" onClick={() => navigate(`/reports/outstandings/${other}`)}>
          Switch to {other === 'payable' ? 'Bills Payable' : 'Bills Receivable'}
        </button>
        <span className="lt-meta">{rows.length} bills &middot; {fmtAmount(shownTotal)}</span>
      </div>

      <Panel title={title} sub={`as at ${fmtDate(data.period.to)}`}>
        <DataTable
          rows={rows}
          rowKey={(r: any, i) => `${r.ledger_id}-${r.bill_name}-${i}`}
          onRowClick={(r: any) => navigate(`/reports/ledger/${r.ledger_id}`)}
          columns={[
            { key: 'date', header: 'Date', width: 110, sortValue: (r: any) => r.date, cell: (r: any) => fmtDate(r.date) },
            { key: 'ref', header: 'Ref. No.', width: 130, sortValue: (r: any) => r.bill_name, cell: (r: any) => r.bill_name },
            { key: 'party', header: 'Party’s Name', sortValue: (r: any) => r.ledger_name, cell: (r: any) => r.ledger_name },
            {
              key: 'pending', header: 'Pending Amount', num: true, width: 150,
              sortValue: (r: any) => r.pending,
              cell: (r: any) => <Amount value={r.pending} blankZero={false} />,
            },
            { key: 'due', header: 'Due On', width: 110, sortValue: (r: any) => r.due_date, cell: (r: any) => fmtDate(r.due_date) },
            {
              key: 'overdue', header: 'Overdue by days', num: true, width: 140,
              sortValue: (r: any) => Number(r.overdueDays) || 0,
              cell: (r: any) => (Number(r.overdueDays) > 0
                ? <Pill tone="bad">{r.overdueDays} days</Pill>
                : <span className="lt-muted">--</span>),
            },
          ]}
          footer={
            <tr>
              <td colSpan={3}>Total</td>
              <td className="num"><Amount value={shownTotal} blankZero={false} /></td>
              <td colSpan={2} />
            </tr>
          }
          empty={<EmptyState title="Nothing is outstanding" note="Every bill in this period has been settled." />}
        />
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------- cash/bank books */

export function CashBank() {
  const app = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!app.company) return;
    setLoading(true);
    api.cashBank({ from: app.period?.from, to: app.period?.to })
      .then(setData)
      .catch((e) => app.setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.company?.id, app.period?.from, app.period?.to]);

  useScreen('Cash/Bank Books', [
    { keys: 'Ctrl+P', label: 'Print', onClick: () => window.print(), group: 'Report' },
    { keys: 'Esc', label: 'Quit', onClick: () => navigate('/'), group: 'Action' },
  ], []);

  if (loading && !data) return <Loading what="Reading the cash and bank books" />;
  if (!data) return <EmptyState title="Cash/Bank Books are not available" />;

  const closing = (data.rows || []).reduce((s: number, r: any) => s + Number(r.closing || 0), 0);

  return (
    <div className="lt-stack">
      <div className="lt-tiles">
        <StatTile label="Accounts" value={(data.rows || []).length} note="cash and bank ledgers" />
        <StatTile
          label="Total closing"
          value={`${fmtCompact(closing)} ${closing >= 0 ? 'Dr' : 'Cr'}`}
          note={fmtPeriod(app.period)}
          tone={closing >= 0 ? 'good' : 'bad'}
        />
      </div>

      <Panel title="Cash/Bank Summary" sub={fmtPeriod(app.period)}>
        <DataTable
          rows={data.rows}
          rowKey={(r: any) => r.id}
          onRowClick={(r: any) => navigate(`/reports/ledger/${r.id}`)}
          columns={[
            { key: 'name', header: 'Particulars', sortValue: (r: any) => r.name, cell: (r: any) => r.name },
            { key: 'group', header: 'Under', width: 170, sortValue: (r: any) => r.group_name, cell: (r: any) => r.group_name },
            {
              key: 'opening', header: 'Opening', num: true, width: 140,
              sortValue: (r: any) => r.opening,
              cell: (r: any) => <Amount value={r.opening} dc="auto" />,
            },
            { key: 'debit', header: 'Debit', num: true, width: 130, sortValue: (r: any) => r.debit, cell: (r: any) => <Amount value={r.debit} /> },
            { key: 'credit', header: 'Credit', num: true, width: 130, sortValue: (r: any) => r.credit, cell: (r: any) => <Amount value={r.credit} /> },
            {
              key: 'closing', header: 'Closing', num: true, width: 140,
              sortValue: (r: any) => r.closing,
              cell: (r: any) => <Amount value={r.closing} dc="auto" blankZero={false} />,
            },
          ]}
          empty={<EmptyState title="No cash or bank ledgers yet" note="Create a ledger under Cash-in-Hand or Bank Accounts." />}
        />
      </Panel>
    </div>
  );
}

/* --------------------------------------------------------- ledger picker */

export function LedgerIndex() {
  const app = useApp();
  const navigate = useNavigate();
  const ledgers = app.lookups.ledgers || [];

  useScreen('Ledger Vouchers', [
    { keys: 'Esc', label: 'Quit', onClick: () => navigate('/reports'), group: 'Action' },
  ], []);

  return (
    <div className="lt-row" style={{ alignItems: 'stretch' }}>
      <Panel
        title="Select a Ledger"
        className="lt-menu-panel lt-wide"
        sub={`${ledgers.length} ledgers`}
        footer={<><span>Type to filter, Enter to open</span><span>{app.company?.name}</span></>}
      >
        <NavMenu
          filterLabel="Filter ledgers"
          filterAfter={8}
          entries={ledgers.map((l) => ({
            label: l._display,
            note: String(l.group_id_name || ''),
            keywords: String(l.group_id_name || ''),
            onSelect: () => navigate(`/reports/ledger/${l.id}`),
          }))}
        />
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------ ledger statement */

export function LedgerStatement() {
  const app = useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const period = usePeriodButton();

  useEffect(() => {
    if (!app.company || !id) return;
    setLoading(true);
    api.ledgerStatement(Number(id), { from: app.period?.from, to: app.period?.to })
      .then(setData)
      .catch((e) => app.setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.company?.id, id, app.period?.from, app.period?.to]);

  useScreen(data ? `Ledger: ${data.ledger.name}` : 'Ledger Vouchers', [
    { keys: 'Alt+F2', label: 'Period', onClick: period.open, group: 'View' },
    { keys: 'F4', label: 'Another Ledger', onClick: () => navigate('/reports/ledgers'), group: 'Report' },
    {
      keys: 'Alt+A', label: 'Alter Ledger',
      onClick: () => navigate(`/masters/ledger/${id}`), group: 'Report',
    },
    { keys: 'Ctrl+E', label: 'Edit Log', onClick: () => navigate(`/edit-log/ledger/${id}`), group: 'Audit' },
    { keys: 'Ctrl+P', label: 'Print', onClick: () => window.print(), group: 'Report' },
    { keys: 'Esc', label: 'Quit', onClick: () => navigate(-1), group: 'Action' },
  ], [id, data?.ledger?.name]);

  if (loading && !data) return <Loading what="Reading the ledger" />;
  if (!data) return <EmptyState title="That ledger is not available" />;

  return (
    <div className="lt-stack">
      <div className="lt-tiles">
        <StatTile
          label="Opening balance"
          value={`${fmtCompact(data.opening)} ${data.opening >= 0 ? 'Dr' : 'Cr'}`}
          note={fmtDate(app.period?.from)}
        />
        <StatTile label="Debit this period" value={fmtCompact(data.totals.debit)} />
        <StatTile label="Credit this period" value={fmtCompact(data.totals.credit)} />
        <StatTile
          label="Closing balance"
          value={`${fmtCompact(data.closing)} ${data.closing >= 0 ? 'Dr' : 'Cr'}`}
          note={fmtDate(app.period?.to)}
          tone={data.closing >= 0 ? 'good' : 'bad'}
        />
      </div>

      <Panel
        title={data.ledger.name}
        sub={`${data.ledger.group_name}  |  ${fmtPeriod(app.period)}`}
        footer={
          <>
            <span>
              Opening: <strong>{fmtAmount(data.opening)} {data.opening >= 0 ? 'Dr' : 'Cr'}</strong>
            </span>
            <span>
              Closing: <strong>{fmtAmount(data.closing)} {data.closing >= 0 ? 'Dr' : 'Cr'}</strong>
            </span>
          </>
        }
      >
        <DataTable
          rows={data.lines}
          rowKey={(r: any) => r.entry_id}
          onRowClick={(r: any) => navigate(`/vouchers/${r.id}`)}
          rowClass={(r: any) => (r.is_cancelled ? 'is-muted' : '')}
          columns={[
            { key: 'date', header: 'Date', width: 110, cell: (r: any) => fmtDate(r.date) },
            { key: 'particulars', header: 'Particulars', cell: (r: any) => r.particulars },
            { key: 'vtype', header: 'Vch Type', width: 130, cell: (r: any) => r.voucher_type_name },
            { key: 'vno', header: 'Vch No.', width: 90, cell: (r: any) => r.voucher_number },
            { key: 'debit', header: 'Debit', num: true, width: 130, cell: (r: any) => <Amount value={r.debit} /> },
            { key: 'credit', header: 'Credit', num: true, width: 130, cell: (r: any) => <Amount value={r.credit} /> },
            {
              key: 'balance', header: 'Balance', num: true, width: 150,
              cell: (r: any) => <Amount value={r.running} dc="auto" blankZero={false} />,
            },
          ]}
          footer={
            <tr>
              <td colSpan={4}>Current Total</td>
              <td className="num"><Amount value={data.totals.debit} blankZero={false} /></td>
              <td className="num"><Amount value={data.totals.credit} blankZero={false} /></td>
              <td className="num"><Amount value={data.closing} dc="auto" blankZero={false} /></td>
            </tr>
          }
          empty={
            <EmptyState
              title="No transactions in this period"
              note="Widen the period from the bar at the top, or post a voucher against this ledger."
            />
          }
        />
      </Panel>
      {period.dialog}
    </div>
  );
}
