import React, { useState } from 'react';
import { Dialog, Field, DateInput, IconCheck } from './ui';
import { fmtDate } from './state';

/** Jumps the reporting period to a whole month, quarter or year. */
function quickRanges(from: string, to: string): { label: string; from: string; to: string }[] {
  const base = to || from || new Date().toISOString().slice(0, 10);
  const d = new Date(`${base}T00:00:00`);
  if (Number.isNaN(d.getTime())) return [];
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  const y = d.getFullYear();
  const m = d.getMonth();
  const qStart = Math.floor(m / 3) * 3;
  // An Indian financial year runs April to March.
  const fyStart = m >= 3 ? y : y - 1;
  return [
    { label: 'This month', from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) },
    { label: 'This quarter', from: iso(new Date(y, qStart, 1)), to: iso(new Date(y, qStart + 3, 0)) },
    { label: 'Financial year', from: `${fyStart}-04-01`, to: `${fyStart + 1}-03-31` },
    { label: 'Year to date', from: `${fyStart}-04-01`, to: base },
  ];
}

export function PeriodDialog({
  from, to, onClose, onApply,
}: { from: string; to: string; onClose: () => void; onApply: (f: string, t: string) => void }) {
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const invalid = !!f && !!t && f > t;
  const ranges = quickRanges(from, to);
  const matched = ranges.findIndex((r) => r.from === f && r.to === t);

  return (
    <Dialog
      title="Change Period"
      width={470}
      onClose={onClose}
      footer={
        <>
          <span className="lt-muted lt-small" style={{ marginRight: 'auto' }}>
            {invalid ? 'The start date must come first.' : `${fmtDate(f)} to ${fmtDate(t)}`}
          </span>
          <button type="button" className="lt-btn" onClick={onClose}>
            <kbd className="lt-key">Esc</kbd><span>Cancel</span>
          </button>
          <button
            type="button"
            className="lt-btn lt-btn-strong"
            disabled={invalid}
            onClick={() => onApply(f, t)}
          >
            <kbd className="lt-key">Ctrl+A</kbd><span>Accept</span>
          </button>
        </>
      }
    >
      <div className="lt-form">
        <Field label="From">
          <DateInput value={f} onChange={setF} max={t || undefined} autoFocus />
        </Field>
        <Field label="To" error={invalid ? 'The period ends before it starts.' : undefined}>
          <DateInput value={t} onChange={setT} min={f || undefined} invalid={invalid} />
        </Field>
        <Field label="Jump to" hint="Common ranges, based on the period you are in.">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ranges.map((r, i) => {
              // Ranges can coincide (a year to date that has run its full
              // course is the financial year); only mark the first.
              const on = matched === i;
              return (
                <button
                  key={r.label}
                  type="button"
                  className={`lt-check ${on ? 'is-on' : ''}`}
                  onClick={() => { setF(r.from); setT(r.to); }}
                >
                  {on ? <span className="lt-check-box"><IconCheck /></span> : null}
                  <span>{r.label}</span>
                </button>
              );
            })}
          </div>
        </Field>
      </div>
    </Dialog>
  );
}

export function DateDialog({
  value, onClose, onApply,
}: { value: string; onClose: () => void; onApply: (d: string) => void }) {
  const [d, setD] = useState(value);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Dialog
      title="Change Current Date"
      width={430}
      onClose={onClose}
      footer={
        <>
          <span className="lt-muted lt-small" style={{ marginRight: 'auto' }}>{fmtDate(d)}</span>
          <button type="button" className="lt-btn" onClick={onClose}>
            <kbd className="lt-key">Esc</kbd><span>Cancel</span>
          </button>
          <button type="button" className="lt-btn lt-btn-strong" onClick={() => onApply(d)}>
            <kbd className="lt-key">Ctrl+A</kbd><span>Accept</span>
          </button>
        </>
      }
    >
      <div className="lt-form">
        <Field
          label="Current Date"
          hint="New vouchers open on this date."
        >
          <DateInput value={d} onChange={setD} autoFocus clearable={false} />
          <button type="button" className="lt-check" onClick={() => setD(today)}>Today</button>
        </Field>
      </div>
    </Dialog>
  );
}
