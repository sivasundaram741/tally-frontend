import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, type Voucher, type VoucherEntry, type VoucherInventory } from '../api';
import { useApp, useScreen, useDebounced, fmtAmount, fmtDate, fmtPeriod } from '../state';
import {
  Panel, DataTable, AcceptBar, Dropdown, Amount, Alert, EmptyState, Loading, Pill,
  SearchInput, CheckChip, Field, FieldInput, FieldTextArea, DateInput,
  IconClose, IconCheckCircle, IconAlert, type Column,
} from '../ui';

/** Voucher types that bring stock in rather than send it out. */
const INWARD = new Set([
  'Purchase', 'Receipt Note', 'Credit Note', 'Rejections In', 'Material In',
  'Physical Stock', 'Stock Journal', 'Purchase Order',
]);

/** Voucher types that move stock but need no balanced ledger entries. */
const INVENTORY_ONLY = new Set([
  'Stock Journal', 'Physical Stock', 'Delivery Note', 'Receipt Note',
  'Rejections In', 'Rejections Out', 'Material In', 'Material Out',
  'Sales Order', 'Purchase Order', 'Job Work In Order', 'Job Work Out Order',
]);

const VOUCHER_KEYS: { keys: string; type: string; kind: 'accounting' | 'inventory' }[] = [
  { keys: 'F4', type: 'Contra', kind: 'accounting' },
  { keys: 'F5', type: 'Payment', kind: 'accounting' },
  { keys: 'F6', type: 'Receipt', kind: 'accounting' },
  { keys: 'F7', type: 'Journal', kind: 'accounting' },
  { keys: 'F8', type: 'Sales', kind: 'accounting' },
  { keys: 'F9', type: 'Purchase', kind: 'accounting' },
  { keys: 'Ctrl+F8', type: 'Credit Note', kind: 'accounting' },
  { keys: 'Ctrl+F9', type: 'Debit Note', kind: 'accounting' },
  { keys: 'Alt+F7', type: 'Stock Journal', kind: 'inventory' },
  { keys: 'Alt+F8', type: 'Delivery Note', kind: 'inventory' },
  { keys: 'Alt+F9', type: 'Receipt Note', kind: 'inventory' },
];

const blankEntry = (): VoucherEntry => ({ ledger_id: null, dr_cr: 'Dr', amount: 0 });
const blankInv = (dir: 'In' | 'Out'): VoucherInventory => ({
  stock_item_id: null, godown_id: null, quantity: 0, rate: 0, amount: 0, direction: dir, discount_pct: 0,
});

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/* ============================================================ Voucher menu */

export function VoucherMenu() {
  const navigate = useNavigate();
  const app = useApp();

  useScreen('Voucher Types', [
    ...VOUCHER_KEYS.map((v) => ({
      keys: v.keys,
      label: v.type,
      onClick: () => navigate(`/vouchers/new/${encodeURIComponent(v.type)}`),
      group: v.kind === 'accounting' ? 'Accounting' : 'Inventory',
    })),
    { keys: 'Alt+B', label: 'Day Book', onClick: () => navigate('/day-book'), group: 'Action' },
    { keys: 'Esc', label: 'Quit', onClick: () => navigate('/'), group: 'Action' },
  ], []);

  const tile = (v: typeof VOUCHER_KEYS[number]) => (
    <button key={v.type} type="button" onClick={() => navigate(`/vouchers/new/${encodeURIComponent(v.type)}`)}>
      <span>{v.type}</span>
      <kbd className="lt-key">{v.keys}</kbd>
    </button>
  );

  return (
    <div className="lt-stack">
      <Panel title="Accounting Vouchers" sub={app.company?.name}>
        <div className="lt-quick">
          {VOUCHER_KEYS.filter((v) => v.kind === 'accounting').map(tile)}
        </div>
      </Panel>

      <Panel title="Inventory Vouchers" sub="stock movement without a ledger effect">
        <div className="lt-quick">
          {VOUCHER_KEYS.filter((v) => v.kind === 'inventory').map(tile)}
        </div>
      </Panel>

      <Panel title="Where saved vouchers live">
        <div className="lt-prose">
          <p>
            Press the function key beside a voucher type to start entering it, anywhere in the
            application. Saved vouchers are altered, cancelled, deleted and restored from
            the <strong>Day Book</strong>; each change is stored as a new version in the Edit Log.
          </p>
          <p>
            <button type="button" className="lt-btn lt-inline-btn lt-btn-strong" onClick={() => navigate('/day-book')}>
              <kbd className="lt-key">Alt+B</kbd><span>Open the Day Book</span>
            </button>
          </p>
        </div>
      </Panel>
    </div>
  );
}

/* =========================================================== Voucher entry */

export function VoucherEntryScreen() {
  const app = useApp();
  const navigate = useNavigate();
  const { type: typeParam, id } = useParams();
  const isNew = !id;

  const ledgers = app.lookups.ledgers || [];
  const items = app.lookups.stockItems || [];
  const godowns = app.lookups.godowns || [];
  const units = app.lookups.units || [];

  const [voucherTypeId, setVoucherTypeId] = useState<number | null>(null);
  const [date, setDate] = useState(app.currentDate);
  const [number, setNumber] = useState('');
  const [reference, setReference] = useState('');
  const [referenceDate, setReferenceDate] = useState('');
  const [party, setParty] = useState<number | null>(null);
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [narration, setNarration] = useState('');
  const [isOptional, setIsOptional] = useState(false);
  const [entries, setEntries] = useState<VoucherEntry[]>([blankEntry(), blankEntry()]);
  const [inventory, setInventory] = useState<VoucherInventory[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [original, setOriginal] = useState<Voucher | null>(null);

  const voucherType = app.voucherTypes.find((v) => v.id === voucherTypeId) || null;
  const direction: 'In' | 'Out' = voucherType && INWARD.has(voucherType.parent_type) ? 'In' : 'Out';
  const mustBalance = !!voucherType && !INVENTORY_ONLY.has(voucherType.parent_type);

  /* ---- load ------------------------------------------------------------ */
  useEffect(() => {
    (async () => {
      if (!app.company) { navigate('/companies'); return; }
      setLoaded(false);
      if (isNew) {
        const wanted = decodeURIComponent(typeParam || 'Journal');
        const vt = app.voucherTypes.find((v) => v.name === wanted)
          || app.voucherTypes.find((v) => v.parent_type === wanted)
          || app.voucherTypes[0];
        if (!vt) return;
        setVoucherTypeId(vt.id);
        setDate(app.currentDate);
        setEntries([blankEntry(), blankEntry()]);
        setInventory(vt.affects_stock ? [blankInv(INWARD.has(vt.parent_type) ? 'In' : 'Out')] : []);
        setParty(null);
        setNarration('');
        setReference('');
        setReferenceDate('');
        setPlaceOfSupply('');
        setIsOptional(false);
        setOriginal(null);
        try {
          const n = await api.nextVoucherNumber(vt.id, app.currentDate);
          setNumber(n.voucher_number);
        } catch { setNumber(''); }
      } else {
        const v = await api.voucher(Number(id), { includeDeleted: 1 });
        setOriginal(v);
        setVoucherTypeId(v.voucher_type_id);
        setDate(v.date);
        setNumber(v.voucher_number);
        setReference(v.reference_no);
        setReferenceDate(v.reference_date);
        setParty(v.party_ledger_id);
        setPlaceOfSupply(v.place_of_supply);
        setNarration(v.narration);
        setIsOptional(!!v.is_optional);
        setEntries(v.entries.length ? v.entries.map((e) => ({ ...e })) : [blankEntry(), blankEntry()]);
        setInventory(v.inventory.map((i) => ({ ...i })));
      }
      setLoaded(true);
    })().catch((e) => app.setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeParam, id, app.company?.id, app.voucherTypes.length]);

  /* ---- automatic amounts ----------------------------------------------- */
  const invTotal = useMemo(
    () => round2(inventory.reduce((s, i) => s + Number(i.amount || 0), 0)),
    [inventory],
  );

  const revenueGroups = useMemo(() => new Set(['Sales Accounts', 'Purchase Accounts']), []);
  const lastInvTotal = useRef<number | null>(null);
  useEffect(() => {
    if (!loaded || !inventory.length) return;
    if (lastInvTotal.current === invTotal) return;
    lastInvTotal.current = invTotal;
    setEntries((rows) => {
      const idx = rows.findIndex((r) => {
        const led = ledgers.find((l) => Number(l.id) === Number(r.ledger_id));
        return led && revenueGroups.has(String(led.group_id_name || ''));
      });
      if (idx < 0) return rows;
      const next = [...rows];
      next[idx] = { ...next[idx], amount: invTotal };
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invTotal, loaded]);

  const totals = useMemo(() => {
    let dr = 0;
    let cr = 0;
    for (const e of entries) {
      const amt = Number(e.amount || 0);
      if (e.dr_cr === 'Dr') dr += amt;
      else cr += amt;
    }
    return { dr: round2(dr), cr: round2(cr), diff: round2(dr - cr) };
  }, [entries]);

  const filledEntries = entries.filter((e) => e.ledger_id && Number(e.amount) !== 0);
  const balanced = Math.abs(totals.diff) < 0.009;
  const blocked = mustBalance && filledEntries.length > 0 && !balanced;

  const balanceToParty = () => {
    if (!party) { app.setError('Choose a party ledger before balancing to it.'); return; }
    setEntries((rows) => {
      const others = rows.filter((r) => Number(r.ledger_id) !== Number(party));
      let dr = 0;
      let cr = 0;
      for (const e of others) {
        const amt = Number(e.amount || 0);
        if (e.dr_cr === 'Dr') dr += amt; else cr += amt;
      }
      const diff = round2(dr - cr);
      const idx = rows.findIndex((r) => Number(r.ledger_id) === Number(party));
      const row: VoucherEntry = {
        ledger_id: party,
        dr_cr: diff > 0 ? 'Cr' : 'Dr',
        amount: Math.abs(diff),
      };
      if (idx >= 0) {
        const next = [...rows];
        next[idx] = { ...next[idx], ...row };
        return next;
      }
      return [row, ...rows];
    });
  };

  /* ---- save ------------------------------------------------------------ */
  const tryAccept = () => {
    if (!filledEntries.length && !inventory.some((i) => i.stock_item_id)) {
      app.setError('Add at least one ledger entry before accepting.');
      return;
    }
    if (blocked) {
      app.setError(
        `Debit and Credit do not match. Difference ${fmtAmount(totals.diff)} ${totals.diff > 0 ? 'Dr' : 'Cr'}.`,
      );
      return;
    }
    setConfirm(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        voucher_type_id: voucherTypeId,
        date,
        voucher_number: number,
        reference_no: reference,
        reference_date: referenceDate,
        party_ledger_id: party,
        place_of_supply: placeOfSupply,
        narration,
        is_optional: isOptional ? 1 : 0,
        entries: filledEntries.map((e) => ({ ...e, amount: Number(e.amount) })),
        inventory: inventory
          .filter((i) => i.stock_item_id && Number(i.quantity) !== 0)
          .map((i) => ({ ...i, direction })),
        bills: [],
      };
      if (isNew) {
        const v = await api.createVoucher(payload);
        app.setNotice(`${v.voucher_type_name} No. ${v.voucher_number} saved.`);
      } else {
        const v = await api.updateVoucher(Number(id), payload);
        app.setNotice(
          `${v.voucher_type_name} No. ${v.voucher_number} altered - version ${v.version_no} recorded in the Edit Log.`,
        );
      }
      navigate('/day-book');
    } catch (e) {
      app.setError(e instanceof Error ? e.message : 'Could not save the voucher');
    } finally {
      setSaving(false);
      setConfirm(false);
    }
  };

  const switchType = async (name: string) => {
    if (!isNew) { navigate(`/vouchers/new/${encodeURIComponent(name)}`); return; }
    const vt = app.voucherTypes.find((v) => v.name === name);
    if (!vt) return;
    setVoucherTypeId(vt.id);
    setInventory(vt.affects_stock ? [blankInv(INWARD.has(vt.parent_type) ? 'In' : 'Out')] : []);
    try {
      const n = await api.nextVoucherNumber(vt.id, date);
      setNumber(n.voucher_number);
    } catch { /* manual numbering */ }
  };

  useScreen(
    `${voucherType?.name || 'Voucher'} ${isNew ? 'Creation' : 'Alteration'}`,
    [
      { keys: 'Ctrl+A', label: 'Accept', onClick: tryAccept, strong: true, group: 'Save', disabled: saving },
      { keys: 'Esc', label: 'Quit', onClick: () => navigate(-1), group: 'Save' },
      {
        keys: 'Alt+B', label: 'Balance to Party', onClick: balanceToParty, group: 'Entry',
        disabled: !party,
        title: party ? 'Put the difference on the party ledger' : 'Choose a party ledger first',
      },
      {
        keys: 'Alt+L', label: 'Add Ledger Line',
        onClick: () => setEntries((r) => [...r, blankEntry()]), group: 'Entry',
      },
      ...(voucherType?.affects_stock ? [{
        keys: 'Alt+I', label: 'Add Item Line',
        onClick: () => setInventory((r) => [...r, blankInv(direction)]), group: 'Entry',
      }] : []),
      ...VOUCHER_KEYS.map((v) => ({
        keys: v.keys,
        label: v.type,
        onClick: () => switchType(v.type),
        group: 'Voucher Type',
      })),
      {
        keys: 'Ctrl+E', label: 'Edit Log',
        onClick: () => navigate(`/edit-log/voucher/${id}`),
        disabled: isNew, group: 'Audit',
        title: isNew ? 'Available once the voucher is saved' : 'Every version of this voucher',
      },
    ],
    [voucherTypeId, isNew, id, party, entries, inventory, saving, totals.diff],
  );

  if (!loaded || !voucherType) return <Loading what="Opening the voucher" />;

  const ledgerOptions = ledgers.map((l) => ({
    value: Number(l.id),
    label: l._display,
    note: String(l.group_id_name || ''),
  }));

  const balanceChip = mustBalance ? (
    <span className={`lt-balance ${balanced ? 'is-ok' : 'is-off'}`}>
      {balanced ? <IconCheckCircle /> : <IconAlert />}
      {balanced ? (
        <span>Balanced</span>
      ) : (
        <>
          <span>Difference</span>
          <span className="lt-bal-v">{fmtAmount(totals.diff)} {totals.diff > 0 ? 'Dr' : 'Cr'}</span>
        </>
      )}
    </span>
  ) : (
    <span className="lt-balance is-ok"><IconCheckCircle /><span>No ledger posting needed</span></span>
  );

  return (
    <>
      <Panel
        title={`${voucherType.name} ${isNew ? 'Creation' : 'Alteration'}`}
        sub={
          original ? (
            <>
              <Pill tone="neutral">Version {original.version_no}</Pill>
              {original.is_deleted ? <Pill tone="deleted">Deleted</Pill> : null}
              {original.is_cancelled ? <Pill tone="cancelled">Cancelled</Pill> : null}
            </>
          ) : app.company?.name
        }
        actions={balanceChip}
        footer={
          <>
            <span>
              {mustBalance
                ? 'Debit and Credit must match before the voucher can be accepted.'
                : 'This voucher type records stock movement only.'}
            </span>
            <span style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="lt-btn lt-inline-btn" onClick={() => navigate(-1)}>
                <kbd className="lt-key">Esc</kbd><span>Cancel</span>
              </button>
              <button
                type="button"
                className="lt-btn lt-inline-btn lt-btn-strong"
                onClick={tryAccept}
                disabled={saving}
              >
                <kbd className="lt-key">Ctrl+A</kbd><span>{saving ? 'Saving...' : 'Accept'}</span>
              </button>
            </span>
          </>
        }
      >
        {original?.is_deleted ? (
          <div style={{ padding: '10px 18px 2px' }}>
            <Alert tone="error">
              This voucher is deleted. It stays readable, and every version remains in the Edit Log.
            </Alert>
          </div>
        ) : null}

        <div className="lt-form lt-form-2col">
          <Field label="Voucher Type">
            <Dropdown
              value={voucherTypeId}
              width={240}
              ariaLabel="Voucher type"
              options={app.voucherTypes.map((v) => ({ value: v.id, label: v.name, note: v.abbreviation }))}
              onChange={(v) => switchType(app.voucherTypes.find((t) => t.id === Number(v))?.name || '')}
            />
            <span className="lt-suffix">{voucherType.parent_type}</span>
          </Field>

          <Field label="No.">
            <FieldInput
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              style={{ maxWidth: 150 }}
            />
            <span className="lt-suffix">{voucherType.numbering_method}</span>
          </Field>

          <Field label="Date">
            <DateInput value={date} onChange={setDate} clearable={false} />
            <span className="lt-suffix">
              {new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long' })}
            </span>
          </Field>

          <Field label="Party A/c Name">
            <Dropdown
              value={party}
              width={320}
              allowBlank
              blankLabel="None"
              placeholder="Select a party"
              ariaLabel="Party account"
              options={ledgerOptions}
              onChange={(v) => setParty(v ? Number(v) : null)}
            />
          </Field>

          <Field label="Reference No." hint="The supplier's or customer's own document number, and its date.">
            <FieldInput
              value={reference}
              placeholder="Their document no."
              onChange={(e) => setReference(e.target.value)}
              style={{ maxWidth: 170 }}
            />
            <DateInput
              value={referenceDate}
              onChange={setReferenceDate}
              ariaLabel="Reference date"
              placeholder="Their date"
              width={150}
            />
          </Field>

          {voucherType.affects_stock ? (
            <Field label="Place of Supply">
              <FieldInput
                value={placeOfSupply}
                placeholder="State of the buyer"
                onChange={(e) => setPlaceOfSupply(e.target.value)}
                style={{ maxWidth: 250 }}
              />
            </Field>
          ) : null}

          <Field label="Optional">
            <div className="lt-segmented" role="group" aria-label="Optional voucher">
              <button type="button" className={!isOptional ? 'is-on' : ''} onClick={() => setIsOptional(false)}>No</button>
              <button type="button" className={isOptional ? 'is-on' : ''} onClick={() => setIsOptional(true)}>Yes</button>
            </div>
            <span className="lt-suffix">Optional vouchers do not affect the books</span>
          </Field>
        </div>

        {voucherType.affects_stock ? (
          <>
            <div className="lt-form-section">
              Inventory Allocations ({direction === 'In' ? 'Inwards' : 'Outwards'})
            </div>
            <div className="lt-entry-wrap">
              <table className="lt-entry">
                <thead>
                  <tr>
                    <th style={{ width: '28%' }}>Name of Item</th>
                    <th style={{ width: '16%' }}>Godown</th>
                    <th className="num" style={{ width: '11%' }}>Quantity</th>
                    <th style={{ width: '7%' }}>Unit</th>
                    <th className="num" style={{ width: '12%' }}>Rate</th>
                    <th className="num" style={{ width: '9%' }}>Disc %</th>
                    <th className="num" style={{ width: '14%' }}>Amount</th>
                    <th style={{ width: 42 }}><span className="lt-sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((row, i) => (
                    <tr key={i}>
                      <td>
                        <Dropdown
                          value={row.stock_item_id}
                          placeholder="Select item"
                          ariaLabel={`Item on line ${i + 1}`}
                          options={items.map((s) => ({ value: Number(s.id), label: s._display }))}
                          onChange={(v) => {
                            const itemId = v ? Number(v) : null;
                            const item = items.find((s) => Number(s.id) === itemId);
                            updateInv(setInventory, i, {
                              stock_item_id: itemId,
                              unit_id: item ? (item.unit_id as number) : null,
                              rate: Number(row.rate) || Number(item?.standard_price || 0),
                            });
                          }}
                        />
                      </td>
                      <td>
                        <Dropdown
                          value={row.godown_id ?? ''}
                          allowBlank
                          blankLabel="Any"
                          ariaLabel={`Godown on line ${i + 1}`}
                          options={godowns.map((g) => ({ value: Number(g.id), label: g._display }))}
                          onChange={(v) => updateInv(setInventory, i, { godown_id: v ? Number(v) : null })}
                        />
                      </td>
                      <td>
                        <input
                          className="num"
                          type="number"
                          aria-label={`Quantity on line ${i + 1}`}
                          value={row.quantity || ''}
                          onChange={(e) => updateInv(setInventory, i, { quantity: Number(e.target.value) })}
                        />
                      </td>
                      <td>
                        <span className="lt-cell-text">
                          {units.find((u) => Number(u.id) === Number(row.unit_id))?._display || '--'}
                        </span>
                      </td>
                      <td>
                        <input
                          className="num"
                          type="number"
                          aria-label={`Rate on line ${i + 1}`}
                          value={row.rate || ''}
                          onChange={(e) => updateInv(setInventory, i, { rate: Number(e.target.value) })}
                        />
                      </td>
                      <td>
                        <input
                          className="num"
                          type="number"
                          aria-label={`Discount percent on line ${i + 1}`}
                          value={row.discount_pct || ''}
                          onChange={(e) => updateInv(setInventory, i, { discount_pct: Number(e.target.value) })}
                        />
                      </td>
                      <td>
                        <input
                          className="num"
                          type="number"
                          aria-label={`Amount on line ${i + 1}`}
                          value={row.amount || ''}
                          onChange={(e) => updateInv(setInventory, i, { amount: Number(e.target.value) }, false)}
                        />
                      </td>
                      <td className="lt-row-action">
                        <button
                          type="button"
                          className="lt-icon-btn"
                          title="Remove this item line"
                          aria-label={`Remove item line ${i + 1}`}
                          disabled={inventory.length <= 1}
                          onClick={() => setInventory((r) => (r.length > 1 ? r.filter((_, x) => x !== i) : r))}
                        >
                          <IconClose />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="label" colSpan={6}>
                      <button
                        type="button"
                        className="lt-add-row"
                        onClick={() => setInventory((r) => [...r, blankInv(direction)])}
                      >
                        <span aria-hidden="true">+</span>
                        <span>Add item line</span>
                        <kbd className="lt-key">Alt+I</kbd>
                      </button>
                    </td>
                    <td className="num">{fmtAmount(invTotal)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        ) : null}

        <div className="lt-form-section">Ledger Entries</div>
        <div className="lt-entry-wrap">
          <table className="lt-entry">
            <thead>
              <tr>
                <th style={{ width: 86 }}>Dr/Cr</th>
                <th>Particulars</th>
                <th className="num" style={{ width: '19%' }}>Debit</th>
                <th className="num" style={{ width: '19%' }}>Credit</th>
                <th style={{ width: 42 }}><span className="lt-sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((row, i) => (
                <tr key={i}>
                  <td>
                    <Dropdown
                      value={row.dr_cr}
                      size="sm"
                      ariaLabel={`Debit or credit on line ${i + 1}`}
                      options={[{ value: 'Dr', label: 'Dr' }, { value: 'Cr', label: 'Cr' }]}
                      onChange={(v) => updateEntry(setEntries, i, { dr_cr: v as 'Dr' | 'Cr' })}
                    />
                  </td>
                  <td>
                    <Dropdown
                      value={row.ledger_id}
                      placeholder="Select ledger"
                      ariaLabel={`Ledger on line ${i + 1}`}
                      options={ledgerOptions}
                      onChange={(v) => updateEntry(setEntries, i, { ledger_id: v ? Number(v) : null })}
                    />
                  </td>
                  <td>
                    <input
                      className="num"
                      type="number"
                      aria-label={`Debit on line ${i + 1}`}
                      value={row.dr_cr === 'Dr' ? (row.amount || '') : ''}
                      disabled={row.dr_cr !== 'Dr'}
                      onChange={(e) => updateEntry(setEntries, i, { amount: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      className="num"
                      type="number"
                      aria-label={`Credit on line ${i + 1}`}
                      value={row.dr_cr === 'Cr' ? (row.amount || '') : ''}
                      disabled={row.dr_cr !== 'Cr'}
                      onChange={(e) => updateEntry(setEntries, i, { amount: Number(e.target.value) })}
                    />
                  </td>
                  <td className="lt-row-action">
                    <button
                      type="button"
                      className="lt-icon-btn"
                      title="Remove this line"
                      aria-label={`Remove ledger line ${i + 1}`}
                      disabled={entries.length <= 1}
                      onClick={() => setEntries((r) => (r.length > 1 ? r.filter((_, x) => x !== i) : r))}
                    >
                      <IconClose />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="label" colSpan={2}>
                  <button
                    type="button"
                    className="lt-add-row"
                    onClick={() => setEntries((r) => [...r, blankEntry()])}
                  >
                    <span aria-hidden="true">+</span>
                    <span>Add ledger line</span>
                    <kbd className="lt-key">Alt+L</kbd>
                  </button>
                </td>
                <td className="num">{fmtAmount(totals.dr)}</td>
                <td className="num">{fmtAmount(totals.cr)}</td>
                <td />
              </tr>
            </tfoot>
          </table>

          {mustBalance && !balanced ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              {balanceChip}
              {party ? (
                <button type="button" className="lt-btn lt-inline-btn" onClick={balanceToParty}>
                  <kbd className="lt-key">Alt+B</kbd><span>Put the difference on the party</span>
                </button>
              ) : (
                <span className="lt-muted lt-small">Choose a party ledger to balance against it.</span>
              )}
            </div>
          ) : null}
        </div>

        <div className="lt-form">
          <Field label="Narration" wide>
            <FieldTextArea
              value={narration}
              placeholder="What this entry is for - shown in the Day Book and the Edit Log"
              onChange={(e) => setNarration(e.target.value)}
            />
          </Field>
        </div>
      </Panel>

      {confirm ? (
        <AcceptBar
          detail={
            isNew
              ? `Save ${voucherType.name} No. ${number || '(auto)'} dated ${fmtDate(date)}.`
              : `Store this as version ${(original?.version_no || 1) + 1} in the Edit Log.`
          }
          onYes={save}
          onNo={() => setConfirm(false)}
        />
      ) : null}
    </>
  );
}

function updateEntry(
  setEntries: React.Dispatch<React.SetStateAction<VoucherEntry[]>>,
  i: number,
  patch: Partial<VoucherEntry>,
) {
  setEntries((rows) => rows.map((r, x) => (x === i ? { ...r, ...patch } : r)));
}

function updateInv(
  setInventory: React.Dispatch<React.SetStateAction<VoucherInventory[]>>,
  i: number,
  patch: Partial<VoucherInventory>,
  recompute = true,
) {
  setInventory((rows) => rows.map((r, x) => {
    if (x !== i) return r;
    const next = { ...r, ...patch };
    if (recompute) {
      const gross = Number(next.quantity || 0) * Number(next.rate || 0);
      next.amount = round2(gross - (gross * Number(next.discount_pct || 0)) / 100);
    }
    return next;
  }));
}

/* ================================================================ Day Book */

export function DayBook() {
  const app = useApp();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [rows, setRows] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState<Voucher | null>(null);
  const [showDeleted, setShowDeleted] = useState(sp.get('deleted') === '1');
  const [typeFilter, setTypeFilter] = useState(sp.get('type') || '');
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Voucher | null>(null);

  const query = useDebounced(search);
  const from = app.period?.from;
  const to = app.period?.to;

  const load = async () => {
    if (!app.company) return;
    try {
      const list = await api.vouchers({
        from, to, search: query,
        voucherType: typeFilter || undefined,
        includeDeleted: showDeleted ? 1 : '',
        limit: 500,
      });
      setRows(list);
      setCursor((c) => Math.min(c, Math.max(0, list.length - 1)));
    } catch (e) {
      app.setError(e instanceof Error ? e.message : 'Could not load the day book');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setLoading(true); load(); /* eslint-disable-next-line */ },
    [app.company?.id, from, to, query, typeFilter, showDeleted]);

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('');
    setShowDeleted(false);
    setSp({});
  };
  const filtered = !!(search || typeFilter || showDeleted);

  useScreen('Day Book', [
    { keys: 'Alt+C', label: 'Create Voucher', onClick: () => navigate('/vouchers'), group: 'Action', strong: true },
    {
      keys: 'Enter', label: 'Alter',
      onClick: () => selected && navigate(`/vouchers/${selected.id}`),
      disabled: !selected, group: 'Action',
    },
    {
      keys: 'Alt+X', label: selected?.is_cancelled ? 'Un-cancel' : 'Cancel Voucher',
      onClick: async () => {
        if (!selected) return;
        try {
          await api.cancelVoucher(selected.id);
          app.setNotice('Voucher status changed. The change is recorded in the Edit Log.');
          await load();
        } catch (e) { app.setError(e instanceof Error ? e.message : 'Failed'); }
      },
      disabled: !selected || !!selected?.is_deleted, group: 'Action',
    },
    {
      keys: 'Alt+D', label: 'Delete',
      onClick: () => selected && setConfirmDelete(selected),
      disabled: !selected || !!selected?.is_deleted, danger: true, group: 'Action',
    },
    {
      keys: 'Ctrl+R', label: 'Restore Deleted',
      onClick: async () => {
        if (!selected?.is_deleted) return;
        try {
          await api.restoreVoucher(selected.id);
          app.setNotice('Voucher restored.');
          await load();
        } catch (e) { app.setError(e instanceof Error ? e.message : 'Failed'); }
      },
      disabled: !selected?.is_deleted, group: 'Action',
      title: selected?.is_deleted ? 'Bring this voucher back' : 'Only a deleted voucher can be restored',
    },
    {
      keys: 'F12', label: showDeleted ? 'Hide Deleted' : 'Show Deleted',
      onClick: () => { setShowDeleted((v) => !v); setSp({}); }, group: 'View',
    },
    {
      keys: 'Ctrl+F12', label: 'Clear Filters', onClick: clearFilters,
      disabled: !filtered, group: 'View',
    },
    {
      keys: 'Ctrl+E', label: 'Edit Log',
      onClick: () => selected && navigate(`/edit-log/voucher/${selected.id}`),
      disabled: !selected, group: 'Audit',
    },
    { keys: 'Esc', label: 'Quit', onClick: () => navigate('/'), group: 'Action' },
  ], [selected?.id, selected?.is_deleted, selected?.is_cancelled, showDeleted, filtered]);

  const columns: Column<Voucher>[] = [
    { key: 'date', header: 'Date', width: 110, sortValue: (v) => v.date, cell: (v) => fmtDate(v.date) },
    {
      key: 'particulars',
      header: 'Particulars',
      sortValue: (v) => v.party_name || '',
      cell: (v) => (
        <>
          {v.party_name
            || v.entries.map((e) => e.ledger_name).filter(Boolean).slice(0, 2).join(', ')
            || <span className="lt-muted">--</span>}
          {v.narration ? <span className="lt-muted"> &middot; {v.narration.slice(0, 48)}</span> : null}
        </>
      ),
    },
    { key: 'vtype', header: 'Vch Type', width: 130, sortValue: (v) => v.voucher_type_name, cell: (v) => v.voucher_type_name },
    {
      key: 'vno', header: 'Vch No.', width: 90, num: true,
      sortValue: (v) => v.voucher_number,
      cell: (v) => v.voucher_number || <span className="lt-muted">--</span>,
    },
    { key: 'debit', header: 'Debit', num: true, width: 140, sortValue: (v) => v.total_amount, cell: (v) => <Amount value={v.total_amount} /> },
    { key: 'credit', header: 'Credit', num: true, width: 140, sortValue: (v) => v.total_amount, cell: (v) => <Amount value={v.total_amount} /> },
    {
      key: 'ver', header: 'Ver.', num: true, width: 64,
      sortValue: (v) => v.version_no,
      cell: (v) => (v.version_no > 1
        ? <strong title={`${v.version_no} versions in the Edit Log`}>{v.version_no}</strong>
        : <span className="lt-muted">{v.version_no}</span>),
    },
    {
      key: 'status', header: 'Status', width: 110,
      sortValue: (v) => (v.is_deleted ? 3 : v.is_cancelled ? 2 : v.is_optional ? 1 : 0),
      cell: (v) => (v.is_deleted ? <Pill tone="deleted">Deleted</Pill>
        : v.is_cancelled ? <Pill tone="cancelled">Cancelled</Pill>
          : v.is_optional ? <Pill tone="optional">Optional</Pill> : ''),
    },
  ];

  const live = rows.filter((r) => !r.is_deleted && !r.is_cancelled);
  const total = live.reduce((s, r) => s + Number(r.total_amount || 0), 0);

  return (
    <div className="lt-stack">
      <div className="lt-filters">
        <label className="lt-fl">
          <span>Voucher Type</span>
          <Dropdown
            value={typeFilter}
            size="sm"
            allowBlank
            blankLabel="All types"
            ariaLabel="Filter by voucher type"
            options={app.voucherTypes.map((v) => ({ value: v.name, label: v.name }))}
            onChange={setTypeFilter}
          />
        </label>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Number, narration or party"
          ariaLabel="Search vouchers"
        />
        <CheckChip checked={showDeleted} onChange={setShowDeleted}>Show deleted</CheckChip>
        {filtered ? (
          <button type="button" className="lt-check" onClick={clearFilters}>
            <IconClose /> Clear filters
          </button>
        ) : null}
        <span className="lt-meta">
          {rows.length} of this period &middot; {fmtPeriod(app.period)}
        </span>
      </div>

      <Panel
        title="Day Book"
        sub={`${live.length} live${rows.length !== live.length ? `, ${rows.length - live.length} cancelled or deleted` : ''}`}
        footer={
          <>
            <span>
              <kbd className="lt-key">Enter</kbd> alter &middot;{' '}
              <kbd className="lt-key">Alt+X</kbd> cancel &middot;{' '}
              <kbd className="lt-key">Alt+D</kbd> delete &middot;{' '}
              <kbd className="lt-key">Ctrl+E</kbd> history
            </span>
            <span>
              {selected
                ? <strong>{selected.voucher_type_name} No. {selected.voucher_number}</strong>
                : 'Nothing selected'}
            </span>
          </>
        }
      >
        <DataTable
          rows={rows}
          loading={loading}
          rowKey={(v) => v.id}
          columns={columns}
          selectedIndex={cursor}
          onSelectedIndexChange={setCursor}
          onSelectedRowChange={setSelected}
          onRowClick={(v) => navigate(`/vouchers/${v.id}`)}
          rowClass={(v) => (v.is_deleted ? 'is-deleted' : v.is_cancelled ? 'is-muted' : '')}
          empty={
            <EmptyState
              title={filtered ? 'No vouchers match these filters' : 'No vouchers in this period'}
              note={filtered
                ? 'Widen the period, clear the filters, or include deleted vouchers.'
                : 'Create the first one, or change the period from the bar at the top.'}
              action={
                <button
                  type="button"
                  className="lt-btn lt-inline-btn lt-btn-strong"
                  onClick={() => (filtered ? clearFilters() : navigate('/vouchers'))}
                >
                  <span>{filtered ? 'Clear the filters' : 'Create a voucher'}</span>
                </button>
              }
            />
          }
          footer={
            <tr>
              <td colSpan={4}>Total of {live.length} live vouchers</td>
              <td className="num"><Amount value={total} blankZero={false} /></td>
              <td className="num"><Amount value={total} blankZero={false} /></td>
              <td colSpan={2} />
            </tr>
          }
        />
      </Panel>

      {confirmDelete ? (
        <AcceptBar
          question={`Delete ${confirmDelete.voucher_type_name} No. ${confirmDelete.voucher_number}?`}
          detail="The voucher is marked deleted, not destroyed - every version stays in the Edit Log and it can be restored."
          yesLabel="Delete"
          noLabel="Keep"
          tone="danger"
          onYes={async () => {
            try {
              await api.deleteVoucher(confirmDelete.id);
              app.setNotice('Voucher deleted. Every version remains available in the Edit Log.');
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
