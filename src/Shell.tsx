import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  useApp, useShell, useButtonShortcuts, fmtDate, fmtPeriod, type ActionButton, type Toast,
} from './state';
import {
  Picker, IconSearch, IconSun, IconMoon, IconSidebar, IconRows, IconChevronDown,
  IconClose, IconAlert, IconCheckCircle, IconInfo,
} from './ui';
import { PeriodDialog, DateDialog } from './dialogs';
import { GO_TO_TARGETS } from './nav';

const TOP_MENU = [
  { key: 'K', label: 'Company', to: '/companies' },
  { key: 'Y', label: 'Data', to: '/data' },
  { key: 'Z', label: 'Exchange', to: '/exchange' },
  { key: 'G', label: 'Go To', to: '__goto__' },
  { key: 'O', label: 'Import', to: '/import' },
  { key: 'E', label: 'Export', to: '/export' },
  { key: 'M', label: 'E-mail', to: '/email' },
  { key: 'P', label: 'Print', to: '__print__' },
  { key: 'F1', label: 'Help', to: '/help' },
];

/* ------------------------------------------------------------------ toasts */

const TOAST_ICON = { error: IconAlert, success: IconCheckCircle, info: IconInfo };

function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (!toasts.length) return null;
  return (
    <div className="lt-toasts" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => {
        const Glyph = TOAST_ICON[t.kind];
        return (
          <div key={t.id} className={`lt-toast is-${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
            <Glyph className="lt-toast-icon" />
            <div className="lt-toast-body">{t.message}</div>
            <button
              type="button"
              className="lt-toast-close"
              aria-label="Dismiss this message"
              onClick={() => onDismiss(t.id)}
            >
              <IconClose />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------- shell */

export default function Shell() {
  const app = useApp();
  const shell = useShell();
  const navigate = useNavigate();
  const location = useLocation();
  const [goTo, setGoTo] = useState(false);
  const [switchCompany, setSwitchCompany] = useState(false);
  const [showPeriod, setShowPeriod] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  /* The browser tab follows the screen, so history and task-switching read
     sensibly rather than saying "LedgerTrail" nine times. */
  useEffect(() => {
    document.title = [shell.title, app.company?.name, 'LedgerTrail'].filter(Boolean).join(' - ');
  }, [shell.title, app.company?.name]);

  const nextTheme = app.resolvedTheme === 'dark' ? 'light' : 'dark';

  const globalButtons = useMemo<ActionButton[]>(() => [
    { keys: 'Alt+G', label: 'Go To', onClick: () => setGoTo(true) },
    { keys: 'Ctrl+K', label: 'Go To', onClick: () => setGoTo(true) },
    { keys: 'Alt+F3', label: 'Company', onClick: () => navigate('/companies') },
    { keys: 'Ctrl+B', label: 'Hide Buttons', onClick: () => app.setSidebarOpen((v) => !v) },
    { keys: 'Ctrl+P', label: 'Print', onClick: () => window.print() },
    { keys: 'F1', label: 'Help', onClick: () => navigate('/help') },
    // Last resort, so a screen's own Esc always wins over this one.
    { keys: 'Esc', label: 'Back', onClick: () => navigate(-1) },
  ], [navigate, app.setSidebarOpen]);

  /* Only the first four are worth a permanent slot in the panel. */
  const alwaysButtons = useMemo(
    () => globalButtons.filter((b) => ['Alt+G', 'Alt+F3', 'Ctrl+P', 'F1'].includes(b.keys || '')),
    [globalButtons],
  );

  useButtonShortcuts(useMemo(
    () => [...shell.buttons, ...globalButtons],
    [shell.buttons, globalButtons],
  ));

  // Clear transient state when the user actually moves to another screen - not
  // on the first render, which would race with a request on that same screen.
  const mainRef = useRef<HTMLDivElement>(null);
  const lastPath = useRef(location.pathname);
  useEffect(() => {
    if (lastPath.current === location.pathname) return;
    lastPath.current = location.pathname;
    // A new screen always starts at the top of the work area.
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [location.pathname]);

  const grouped = useMemo(() => {
    const groups = new Map<string, ActionButton[]>();
    for (const b of shell.buttons) {
      const g = b.group || '';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(b);
    }
    return [...groups.entries()];
  }, [shell.buttons]);

  const activeTop = (to: string) => to.startsWith('/') && location.pathname.startsWith(to);

  return (
    <div className="lt-app">
      <a className="lt-sr-only lt-skip" href="#lt-work">Skip to the work area</a>

      <header className="lt-titlebar">
        <div>
          <span className="lt-product">LedgerTrail</span>
          <span className="lt-edition">Edit Log</span>
        </div>

        <div className="lt-spacer" />

        <button
          type="button"
          className="lt-search-trigger"
          onClick={() => setGoTo(true)}
          title="Jump to any screen (Alt+G)"
        >
          <IconSearch />
          <span>Go to any screen...</span>
          <kbd className="lt-key">Alt+G</kbd>
        </button>

        <button
          type="button"
          className="lt-tool"
          onClick={() => app.setDensity(app.density === 'compact' ? 'cosy' : 'compact')}
          aria-pressed={app.density === 'compact'}
          aria-label={app.density === 'compact' ? 'Use comfortable row height' : 'Use compact row height'}
          title={app.density === 'compact' ? 'Comfortable row height' : 'Compact row height - fit more rows'}
        >
          <IconRows />
        </button>

        <button
          type="button"
          className="lt-tool"
          onClick={() => app.setTheme(nextTheme)}
          aria-label={`Switch to the ${nextTheme} theme`}
          title={`Switch to the ${nextTheme} theme`}
        >
          {nextTheme === 'dark' ? <IconMoon /> : <IconSun />}
        </button>

        <button
          type="button"
          className={`lt-tool ${app.sidebarOpen ? 'is-on' : ''}`}
          onClick={() => app.setSidebarOpen((v) => !v)}
          aria-pressed={app.sidebarOpen}
          aria-label={`${app.sidebarOpen ? 'Hide' : 'Show'} the button panel`}
          title={`${app.sidebarOpen ? 'Hide' : 'Show'} the button panel (Ctrl+B)`}
        >
          <IconSidebar />
        </button>

        <span className="lt-clock">
          {fmtDate(clock.toISOString().slice(0, 10))}
          {'  '}
          {clock.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </header>

      <nav className="lt-menubar" aria-label="Main menu">
        {TOP_MENU.map((m) => (
          <button
            key={m.key}
            type="button"
            className={activeTop(m.to) ? 'is-active' : ''}
            onClick={() => {
              if (m.to === '__goto__') setGoTo(true);
              else if (m.to === '__print__') window.print();
              else navigate(m.to);
            }}
          >
            <kbd className="lt-key">{m.key}</kbd>
            <span>{m.label}</span>
          </button>
        ))}
      </nav>

      <div className="lt-companybar">
        {app.company ? (
          <button
            type="button"
            className="lt-company-pick"
            onClick={() => setSwitchCompany(true)}
            title="Switch company (Alt+F3)"
          >
            <span>{app.company.name}</span>
            <IconChevronDown />
          </button>
        ) : (
          <span className="lt-muted" style={{ paddingLeft: 10 }}>No company selected</span>
        )}

        <div className="lt-screen-name">{shell.title}</div>

        <div className="lt-period">
          {app.period ? (
            <>
              <button
                type="button"
                className="lt-period-btn"
                onClick={() => setShowPeriod(true)}
                title="Change the reporting period (Alt+F2)"
              >
                Period <b>{fmtPeriod(app.period)}</b>
              </button>
              <button
                type="button"
                className="lt-period-btn"
                onClick={() => setShowDate(true)}
                title="Change the current date (F2)"
              >
                Date <b>{fmtDate(app.currentDate)}</b>
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className={`lt-body ${app.sidebarOpen ? '' : 'is-collapsed'}`}>
        <main className="lt-main" id="lt-work" ref={mainRef}>
          <Outlet />
        </main>

        <aside className="lt-buttons" aria-label="Actions on this screen">
          {grouped.map(([group, buttons], gi) => (
            <React.Fragment key={group || gi}>
              {group ? <div className="lt-group-label">{group}</div> : null}
              {buttons.map((b, i) => (
                <button
                  key={`${b.label}-${i}`}
                  type="button"
                  className={[
                    'lt-btn',
                    b.strong ? 'lt-btn-strong' : '',
                    b.danger ? 'lt-btn-danger' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={b.onClick}
                  disabled={b.disabled || !b.onClick}
                  title={b.title || (b.keys ? `${b.label} (${b.keys})` : b.label)}
                >
                  <span>{b.label}</span>
                  {b.keys ? <kbd className="lt-key">{b.keys}</kbd> : null}
                </button>
              ))}
            </React.Fragment>
          ))}

          <div className="lt-always">
            <div className="lt-group-label">Always</div>
            {alwaysButtons.map((b, i) => (
              <button
                key={i}
                type="button"
                className="lt-btn"
                onClick={b.onClick}
                title={`${b.label} (${b.keys})`}
              >
                <span>{b.label}</span>
                <kbd className="lt-key">{b.keys}</kbd>
              </button>
            ))}
          </div>
        </aside>
      </div>

      <footer className="lt-statusbar">
        <button type="button" className="lt-btn" onClick={() => navigate(-1)}>
          <kbd className="lt-key">Esc</kbd><span>Back</span>
        </button>
        <button type="button" className="lt-btn" onClick={() => navigate('/')}>
          <kbd className="lt-key">Home</kbd><span>Gateway</span>
        </button>

        <div className="lt-status-meta">
          {app.company ? (
            <>
              <span>
                Edit Log{' '}
                <strong style={{ color: app.company.edit_log_enabled ? 'var(--success)' : 'var(--text-3)' }}>
                  {app.company.edit_log_enabled ? 'Enabled' : 'Disabled'}
                </strong>
              </span>
              <span>{app.company.maintain}</span>
            </>
          ) : (
            <span>Select or create a company to begin</span>
          )}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span className={`lt-dot ${app.offline ? 'is-off' : ''}`} />
            {app.offline ? 'Server unreachable' : 'Connected'}
          </span>
        </div>
      </footer>

      <Toasts toasts={app.toasts} onDismiss={app.dismissToast} />

      {goTo ? (
        <Picker
          title="Go To"
          placeholder="Go to any screen - type to filter"
          options={GO_TO_TARGETS.map((t) => ({
            value: t.to,
            label: t.label,
            section: t.section,
            keywords: t.keywords,
          }))}
          onPick={(o) => { setGoTo(false); navigate(String(o.value)); }}
          onClose={() => setGoTo(false)}
        />
      ) : null}

      {switchCompany ? (
        <Picker
          title="Switch Company"
          placeholder="Open another company"
          options={[
            ...app.companies.map((c) => ({
              value: `id:${c.id}`,
              label: c.name,
              section: 'Companies',
              note: fmtDate(c.financial_year_from),
            })),
            { value: '/companies', label: 'Manage companies...', section: 'More' },
            { value: '/companies/create', label: 'Create a company', section: 'More' },
          ]}
          onClose={() => setSwitchCompany(false)}
          onPick={async (o) => {
            setSwitchCompany(false);
            const v = String(o.value);
            if (!v.startsWith('id:')) { navigate(v); return; }
            try {
              await app.selectCompany(Number(v.slice(3)));
              navigate('/');
            } catch (e) {
              app.setError(e instanceof Error ? e.message : 'Could not open that company');
            }
          }}
        />
      ) : null}

      {showPeriod && app.period ? (
        <PeriodDialog
          from={app.period.from}
          to={app.period.to}
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
