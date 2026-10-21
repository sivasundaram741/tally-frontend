import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type Company } from '../api';
import { useApp, useScreen, fmtDate } from '../state';
import {
  Panel, DataTable, TextField, SelectField, YesNoField, AcceptBar, Alert, EmptyState,
  Loading, Pill, IconBook, type Column,
} from '../ui';

const STATES = [
  'Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
  'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal',
];

/* ========================================================== Select company */

export function CompanySelect() {
  const app = useApp();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState<Company | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Company | null>(null);

  const loadDemo = async () => {
    setBusy(true);
    try {
      const out = await api.seedDemo();
      await app.reloadCompanies();
      await app.selectCompany(out.company.id);
      app.setNotice(`Demo company "${out.company.name}" created with sample vouchers and edit-log history.`);
      navigate('/');
    } catch (e) {
      app.setError(e instanceof Error ? e.message : 'Could not create the demo company');
    } finally {
      setBusy(false);
    }
  };

  const open = async (c: Company) => {
    try {
      await app.selectCompany(c.id);
      navigate('/');
    } catch (e) {
      app.setError(e instanceof Error ? e.message : 'Could not open that company');
    }
  };

  useScreen('Select Company', [
    {
      keys: 'Enter', label: 'Open', onClick: () => selected && open(selected),
      disabled: !selected, group: 'Company', strong: true,
    },
    { keys: 'F3', label: 'Create Company', onClick: () => navigate('/companies/create'), group: 'Company' },
    {
      keys: 'Alt+A', label: 'Alter',
      onClick: () => selected && navigate(`/companies/alter/${selected.id}`),
      disabled: !selected, group: 'Company',
    },
    {
      keys: 'Alt+D', label: 'Delete',
      onClick: () => selected && setConfirmDelete(selected),
      disabled: !selected, danger: true, group: 'Company',
      title: selected ? `Delete "${selected.name}" and all of its data` : 'Select a company first',
    },
    {
      keys: 'Ctrl+D', label: 'Load Demo Data', onClick: loadDemo, disabled: busy,
      group: 'Sample', strong: !app.companies.length,
      title: 'Create a company complete with masters, vouchers and edit-log history',
    },
  ], [busy, selected?.id, app.companies.length]);

  const columns: Column<Company>[] = [
    {
      key: 'name',
      header: 'Company',
      sortValue: (c) => c.name,
      cell: (c) => (
        <span style={{ fontWeight: 600 }}>
          {c.name}
          {app.company?.id === c.id ? <> <Pill tone="good">Open</Pill></> : null}
        </span>
      ),
    },
    {
      key: 'fy', header: 'Financial year from', width: 160,
      sortValue: (c) => c.financial_year_from,
      cell: (c) => fmtDate(c.financial_year_from),
    },
    {
      key: 'books', header: 'Books begin', width: 140,
      sortValue: (c) => c.books_begin_from,
      cell: (c) => fmtDate(c.books_begin_from),
    },
    { key: 'maintain', header: 'Maintain', width: 180, sortValue: (c) => c.maintain, cell: (c) => c.maintain },
    {
      key: 'gstin', header: 'GSTIN/UIN', width: 170,
      sortValue: (c) => c.gstin,
      cell: (c) => c.gstin || <span className="lt-muted">--</span>,
    },
    {
      key: 'log', header: 'Edit Log', width: 100,
      sortValue: (c) => c.edit_log_enabled,
      cell: (c) => (c.edit_log_enabled
        ? <Pill tone="good">On</Pill>
        : <Pill tone="inactive">Off</Pill>),
    },
  ];

  return (
    <div className="lt-stack">
      <Panel
        title="List of Companies"
        sub={`${app.companies.length} compan${app.companies.length === 1 ? 'y' : 'ies'} on this server`}
        footer={
          <>
            <span>Arrow keys to move, <kbd className="lt-key">Enter</kbd> to open the books</span>
            <span>Alt+A to alter &middot; Alt+D to delete</span>
          </>
        }
      >
        <DataTable
          rows={app.companies}
          rowKey={(c) => c.id}
          columns={columns}
          selectedIndex={cursor}
          onSelectedIndexChange={setCursor}
          onSelectedRowChange={setSelected}
          onRowClick={open}
          tall
          empty={
            <EmptyState
              icon={<IconBook />}
              title="No companies yet"
              note="Load the demo data to get a company complete with masters, vouchers and a populated edit log - or create your own."
              action={
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button type="button" className="lt-inline-btn lt-btn lt-btn-strong" onClick={loadDemo} disabled={busy}>
                    <kbd className="lt-key">Ctrl+D</kbd><span>Load Demo Data</span>
                  </button>
                  <button type="button" className="lt-inline-btn lt-btn" onClick={() => navigate('/companies/create')}>
                    <kbd className="lt-key">F3</kbd><span>Create Company</span>
                  </button>
                </div>
              }
            />
          }
        />
      </Panel>

      <Panel title="About LedgerTrail">
        <div className="lt-prose">
          <p>
            Every create, alter, delete and cancel is recorded as a full version snapshot with
            the user, the time and the exact fields that changed. Nothing is ever silently
            overwritten, and a deleted voucher keeps its whole history.
          </p>
          <p>
            If this is a fresh install, choose <strong>Load Demo Data</strong> to create a company
            complete with masters, vouchers and a populated edit log.
          </p>
        </div>
      </Panel>

      {confirmDelete ? (
        <AcceptBar
          question={`Delete "${confirmDelete.name}"?`}
          detail="Every master, voucher and edit-log version in this company goes with it. This cannot be undone."
          yesLabel="Delete"
          noLabel="Keep"
          tone="danger"
          onYes={async () => {
            try {
              await api.deleteCompany(confirmDelete.id);
              if (app.company?.id === confirmDelete.id) await app.selectCompany(null);
              await app.reloadCompanies();
              setCursor(0);
              app.setNotice(`Company "${confirmDelete.name}" deleted.`);
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

/* ============================================================ Company form */

const EMPTY: Partial<Company> = {
  name: '', mailing_name: '', address: '', state: 'Tamil Nadu', country: 'India', pincode: '',
  phone: '', mobile: '', email: '', website: '', base_currency: 'Rs.', currency_name: 'INR',
  decimal_places: 2, gstin: '', gst_registration_type: 'Regular', pan: '', cin: '', tan: '',
  maintain: 'Accounts with Inventory', edit_log_enabled: 1, gst_enabled: 1, tds_enabled: 0,
};

export function CompanyForm({ mode }: { mode: 'create' | 'alter' }) {
  const app = useApp();
  const navigate = useNavigate();
  const params = useParams();
  const editingId = mode === 'alter' ? Number(params.id || app.company?.id || 0) : 0;

  const [form, setForm] = useState<Partial<Company>>(EMPTY);
  const [ready, setReady] = useState(mode === 'create');
  const [confirm, setConfirm] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    (async () => {
      if (mode === 'create') {
        const d = await api.companyDefaults();
        setForm({ ...EMPTY, financial_year_from: d.financial_year_from, books_begin_from: d.books_begin_from });
        setReady(true);
      } else if (editingId) {
        const c = await api.company(editingId);
        setForm(c);
        setReady(true);
      }
    })().catch((e) => app.setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, editingId]);

  const set = (k: keyof Company) => (v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const nameError = touched && !String(form.name || '').trim() ? 'A company needs a name.' : undefined;
  const canSave = !!String(form.name || '').trim();

  const tryAccept = () => {
    setTouched(true);
    if (!canSave) {
      app.setError('Enter a company name before accepting.');
      return;
    }
    setConfirm(true);
  };

  const save = async () => {
    try {
      if (mode === 'create') {
        const c = await api.createCompany(form);
        await app.reloadCompanies();
        await app.selectCompany(c.id);
        app.setNotice(`Company "${c.name}" created.`);
      } else {
        const c = await api.updateCompany(editingId, form);
        await app.reloadCompanies();
        await app.selectCompany(c.id);
        app.setNotice(`Company "${c.name}" altered. The change is recorded in the Edit Log.`);
      }
      navigate('/');
    } catch (e) {
      app.setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setConfirm(false);
    }
  };

  const title = mode === 'create' ? 'Company Creation' : 'Company Alteration';

  useScreen(title, [
    { keys: 'Ctrl+A', label: 'Accept', onClick: tryAccept, strong: true, group: 'Save' },
    { keys: 'Esc', label: 'Quit', onClick: () => navigate(-1), group: 'Save' },
    ...(mode === 'alter' && editingId ? [{
      keys: 'Ctrl+E', label: 'Edit Log',
      onClick: () => navigate(`/edit-log/company/${editingId}`), group: 'Audit',
    }] : []),
  ], [form, canSave]);

  if (!ready) return <Loading what="Loading the company" />;

  return (
    <>
      <Panel
        title={title}
        sub={mode === 'alter' ? form.name : 'New company'}
        style={{ maxWidth: 1000 }}
        footer={
          <>
            <span>
              {mode === 'create'
                ? 'The books open as soon as you accept.'
                : 'Every change here is stored as a new version in the Edit Log.'}
            </span>
            <span style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="lt-btn lt-inline-btn" onClick={() => navigate(-1)}>
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
        <div className="lt-form lt-form-2col">
          <div className="lt-form-section">Company Details</div>
          <TextField
            label="Name"
            value={form.name || ''}
            onChange={set('name')}
            onBlur={() => setTouched(true)}
            error={nameError}
            required
            autoFocus
          />
          <TextField
            label="Mailing Name"
            value={form.mailing_name || ''}
            onChange={set('mailing_name')}
            placeholder={form.name || 'As it should appear on documents'}
          />
          <TextField label="Address" value={form.address || ''} onChange={set('address')} />
          <SelectField
            label="State"
            value={form.state || ''}
            onChange={set('state')}
            options={STATES.map((s) => ({ value: s, label: s }))}
            allowBlank
            blankLabel="Select state"
          />
          <TextField label="Country" value={form.country || ''} onChange={set('country')} />
          <TextField label="Pincode" value={form.pincode || ''} onChange={set('pincode')} maxWidth={160} inputMode="numeric" />
          <TextField label="Telephone" value={form.phone || ''} onChange={set('phone')} maxWidth={220} inputMode="tel" />
          <TextField label="Mobile" value={form.mobile || ''} onChange={set('mobile')} maxWidth={220} inputMode="tel" />
          <TextField label="E-Mail" type="email" value={form.email || ''} onChange={set('email')} inputMode="email" />
          <TextField label="Website" value={form.website || ''} onChange={set('website')} />

          <div className="lt-form-section">Books and Financial Year</div>
          <TextField
            label="Financial year beginning from"
            type="date"
            value={form.financial_year_from || ''}
            onChange={set('financial_year_from')}
          />
          <TextField
            label="Books beginning from"
            type="date"
            value={form.books_begin_from || ''}
            onChange={set('books_begin_from')}
          />
          <SelectField
            label="Maintain"
            value={form.maintain || ''}
            onChange={set('maintain')}
            options={[
              { value: 'Accounts only', label: 'Accounts only' },
              { value: 'Accounts with Inventory', label: 'Accounts with Inventory' },
            ]}
          />

          <div className="lt-form-section">Base Currency</div>
          <TextField label="Base currency symbol" value={form.base_currency || ''} onChange={set('base_currency')} maxWidth={120} />
          <TextField label="Formal name" value={form.currency_name || ''} onChange={set('currency_name')} maxWidth={200} />
          <TextField
            label="Number of decimal places"
            type="number"
            min={0}
            max={4}
            value={form.decimal_places ?? 2}
            onChange={(v) => set('decimal_places')(Number(v))}
            maxWidth={100}
          />

          <div className="lt-form-section">Statutory Details</div>
          <YesNoField
            label="Enable Goods and Services Tax (GST)"
            value={!!form.gst_enabled}
            onChange={(v) => set('gst_enabled')(v ? 1 : 0)}
          />
          <TextField label="GSTIN/UIN" value={form.gstin || ''} onChange={set('gstin')} maxWidth={240} />
          <SelectField
            label="Registration type"
            value={form.gst_registration_type || ''}
            onChange={set('gst_registration_type')}
            options={['Regular', 'Composition', 'Unregistered', 'Consumer'].map((s) => ({ value: s, label: s }))}
          />
          <TextField label="PAN/IT No." value={form.pan || ''} onChange={set('pan')} maxWidth={200} />
          <TextField label="CIN" value={form.cin || ''} onChange={set('cin')} maxWidth={260} />
          <TextField label="TAN" value={form.tan || ''} onChange={set('tan')} maxWidth={200} />
          <YesNoField
            label="Enable Tax Deducted at Source (TDS)"
            value={!!form.tds_enabled}
            onChange={(v) => set('tds_enabled')(v ? 1 : 0)}
          />

          <div className="lt-form-section">Edit Log</div>
          <div className="lt-field-span">
            <YesNoField
              label="Maintain Edit Log"
              value={!!form.edit_log_enabled}
              onChange={(v) => set('edit_log_enabled')(v ? 1 : 0)}
              hint="Every master and voucher change is stored as a new version with the user, the time and the exact fields that changed."
            />
            {!form.edit_log_enabled ? (
              <div style={{ padding: '4px 18px 10px' }}>
                <Alert tone="warn">
                  With the Edit Log off, alterations overwrite the record and leave no trail.
                </Alert>
              </div>
            ) : null}
          </div>
        </div>
      </Panel>

      {confirm ? (
        <AcceptBar
          question="Accept?"
          detail={mode === 'create' ? `Create "${form.name}" and open its books.` : `Save the changes to "${form.name}".`}
          onYes={save}
          onNo={() => setConfirm(false)}
        />
      ) : null}
    </>
  );
}
