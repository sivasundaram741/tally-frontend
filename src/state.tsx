import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { api, setApiCompany, type Company, type MasterRow, type Period, type VoucherType } from './api';

/* ---------------------------------------------------------------- buttons */

export interface ActionButton {
  /** Keyboard shortcut, e.g. "F5", "Alt+F2", "Ctrl+A", "Esc". */
  keys?: string;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  strong?: boolean;
  danger?: boolean;
  group?: string;
  /** Shown as a tooltip - useful for saying why a button is unavailable. */
  title?: string;
}

interface ShellState {
  title: string;
  buttons: ActionButton[];
  setTitle: (t: string) => void;
  setButtons: (b: ActionButton[]) => void;
}

const ShellContext = createContext<ShellState | null>(null);
export const useShell = () => {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell outside ShellProvider');
  return ctx;
};

/* ----------------------------------------------------------------- toasts */

export type ToastKind = 'error' | 'success' | 'info';
export interface Toast { id: number; kind: ToastKind; message: string; }

const TOAST_LIFE: Record<ToastKind, number> = { success: 4500, info: 5500, error: 11000 };

/* -------------------------------------------------------- user preferences */

export type ThemeMode = 'light' | 'dark' | 'system';
export type Density = 'cosy' | 'compact';

const THEME_KEY = 'ledgertrail.theme';
const DENSITY_KEY = 'ledgertrail.density';
const SIDEBAR_KEY = 'ledgertrail.sidebar';
const COMPANY_KEY = 'ledgertrail.companyId';

const readStored = <T extends string>(key: string, fallback: T): T => {
  try { return (localStorage.getItem(key) as T) || fallback; } catch { return fallback; }
};
const store = (key: string, value: string) => {
  try { localStorage.setItem(key, value); } catch { /* private mode */ }
};

/* ------------------------------------------------------------------- app */

interface AppState {
  companies: Company[];
  company: Company | null;
  period: Period | null;
  lookups: Record<string, MasterRow[]>;
  voucherTypes: VoucherType[];
  loading: boolean;
  /** True while the last API call failed, so the status bar can say so. */
  offline: boolean;
  currentDate: string;

  toasts: Toast[];
  dismissToast: (id: number) => void;

  theme: ThemeMode;
  /** What 'system' actually resolved to, so the toggle can offer the opposite. */
  resolvedTheme: 'light' | 'dark';
  setTheme: (t: ThemeMode) => void;
  density: Density;
  setDensity: (d: Density) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean | ((prev: boolean) => boolean)) => void;

  selectCompany: (id: number | null) => Promise<void>;
  reloadCompanies: () => Promise<void>;
  reloadLookups: () => Promise<void>;
  setPeriodRange: (from: string, to: string) => void;
  setCurrentDate: (d: string) => void;
  /** Reports a failure to the user. Pass null to clear nothing - it is a no-op. */
  setError: (e: string | null) => void;
  /** Confirms something went well. */
  setNotice: (n: string | null) => void;
  notify: (kind: ToastKind, message: string) => void;
}

const AppContext = createContext<AppState | null>(null);
export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp outside AppProvider');
  return ctx;
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [period, setPeriod] = useState<Period | null>(null);
  const [lookups, setLookups] = useState<Record<string, MasterRow[]>>({});
  const [voucherTypes, setVoucherTypes] = useState<VoucherType[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [currentDate, setCurrentDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const [theme, setThemeState] = useState<ThemeMode>(() => readStored<ThemeMode>(THEME_KEY, 'system'));
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(
    () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'),
  );
  const [density, setDensityState] = useState<Density>(() => readStored<Density>(DENSITY_KEY, 'cosy'));
  const [sidebarOpen, setSidebarOpenState] = useState<boolean>(
    () => readStored<string>(SIDEBAR_KEY, 'open') !== 'closed',
  );

  const [title, setTitle] = useState('Gateway');
  const [buttons, setButtons] = useState<ActionButton[]>([]);

  /* ---- toasts --------------------------------------------------------- */
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());

  const dismissToast = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) { window.clearTimeout(t); timers.current.delete(id); }
    setToasts((list) => list.filter((x) => x.id !== id));
  }, []);

  const notify = useCallback((kind: ToastKind, message: string) => {
    const text = String(message || '').trim();
    if (!text) return;
    const id = nextId.current++;
    setToasts((list) => {
      // The same message twice in a row replaces itself rather than stacking.
      const deduped = list.filter((t) => !(t.kind === kind && t.message === text));
      return [...deduped, { id, kind, message: text }].slice(-4);
    });
    timers.current.set(id, window.setTimeout(() => dismissToast(id), TOAST_LIFE[kind]));
  }, [dismissToast]);

  useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)); }, []);

  const setError = useCallback((e: string | null) => {
    if (e) { setOffline(/network|fetch|reach|failed to/i.test(e)); notify('error', e); }
  }, [notify]);
  const setNotice = useCallback((n: string | null) => { if (n) notify('success', n); }, [notify]);

  /* ---- preferences ----------------------------------------------------- */
  useEffect(() => {
    const apply = () => {
      const dark = theme === 'dark'
        || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      setResolvedTheme(dark ? 'dark' : 'light');
    };
    apply();
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => { document.documentElement.dataset.density = density; }, [density]);

  const setTheme = useCallback((t: ThemeMode) => { setThemeState(t); store(THEME_KEY, t); }, []);
  const setDensity = useCallback((d: Density) => { setDensityState(d); store(DENSITY_KEY, d); }, []);
  const setSidebarOpen = useCallback((v: boolean | ((prev: boolean) => boolean)) => {
    setSidebarOpenState((prev) => {
      const next = typeof v === 'function' ? v(prev) : v;
      store(SIDEBAR_KEY, next ? 'open' : 'closed');
      return next;
    });
  }, []);

  /* ---- data ------------------------------------------------------------ */
  const reloadCompanies = useCallback(async () => {
    const list = await api.companies();
    setCompanies(list);
    setOffline(false);
    return list;
  }, []);

  const reloadLookups = useCallback(async () => {
    try {
      const [lk, vts] = await Promise.all([api.lookups(), api.voucherTypes()]);
      setLookups(lk);
      setVoucherTypes(vts);
    } catch {
      setLookups({});
      setVoucherTypes([]);
    }
  }, []);

  const selectCompany = useCallback(async (id: number | null) => {
    setApiCompany(id);
    if (!id) {
      setCompany(null);
      setPeriod(null);
      setLookups({});
      setVoucherTypes([]);
      try { localStorage.removeItem(COMPANY_KEY); } catch { /* private mode */ }
      return;
    }
    const c = await api.company(id);
    setCompany(c);
    store(COMPANY_KEY, String(id));
    const p = await api.period();
    setPeriod(p);
    setCurrentDate((d) => (d >= p.from && d <= p.to ? d : p.to));
    await reloadLookups();
  }, [reloadLookups]);

  useEffect(() => {
    (async () => {
      try {
        const list = await reloadCompanies();
        const saved = Number(readStored(COMPANY_KEY, '0'));
        const pick = list.find((c) => c.id === saved) || null;
        if (pick) await selectCompany(pick.id);
      } catch (e) {
        setOffline(true);
        notify('error', e instanceof Error ? e.message : 'Unable to reach the LedgerTrail server');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setPeriodRange = useCallback((from: string, to: string) => {
    setPeriod((p) => (p ? { ...p, from, to } : p));
  }, []);

  const appValue = useMemo<AppState>(() => ({
    companies, company, period, lookups, voucherTypes, loading, offline, currentDate,
    toasts, dismissToast, notify,
    theme, resolvedTheme, setTheme, density, setDensity, sidebarOpen, setSidebarOpen,
    selectCompany, reloadCompanies: async () => { await reloadCompanies(); }, reloadLookups,
    setPeriodRange, setCurrentDate, setError, setNotice,
  }), [companies, company, period, lookups, voucherTypes, loading, offline, currentDate,
    toasts, dismissToast, notify, theme, resolvedTheme, setTheme, density, setDensity,
    sidebarOpen, setSidebarOpen,
    selectCompany, reloadCompanies, reloadLookups, setPeriodRange, setError, setNotice]);

  const shellValue = useMemo<ShellState>(
    () => ({ title, buttons, setTitle, setButtons }),
    [title, buttons],
  );

  return (
    <AppContext.Provider value={appValue}>
      <ShellContext.Provider value={shellValue}>{children}</ShellContext.Provider>
    </AppContext.Provider>
  );
}

/* --------------------------------------------------------- keyboard utils */

/** Normalises a KeyboardEvent into the "Alt+F2" form used by ActionButton. */
export function comboOf(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey && e.key.length > 1) parts.push('Shift');
  let key = e.key;
  if (key === 'Escape') key = 'Esc';
  if (key === ' ') key = 'Space';
  // "ArrowUp" reads badly on a key chip; "Up" is what people call it.
  if (key.startsWith('Arrow')) key = key.slice(5);
  if (key.length === 1) key = key.toUpperCase();
  parts.push(key);
  return parts.join('+');
}

/** Registers the screen title and right-hand button panel. */
export function useScreen(title: string, buttons: ActionButton[], deps: unknown[] = []) {
  const shell = useShell();
  const ref = useRef(shell);
  ref.current = shell;
  useEffect(() => {
    ref.current.setTitle(title);
    ref.current.setButtons(buttons);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, ...deps]);
  useEffect(() => () => { ref.current.setButtons([]); }, []);
}

/** Document title follows the screen, so browser history reads sensibly. */
export function useDocumentTitle(parts: (string | undefined | null)[]) {
  useEffect(() => {
    const text = parts.filter(Boolean).join(' - ');
    document.title = text ? `${text} - LedgerTrail` : 'LedgerTrail';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts.join('|')]);
}

/* --------------------------------------------------------- overlay stack */

/**
 * Dropdowns, pickers, dialogs and the confirm bar register here while they are
 * open. Screen shortcuts stand down for as long as one of them owns the
 * keyboard, so Esc closes the dropdown instead of leaving the screen.
 */
let overlayDepth = 0;
export const isOverlayOpen = () => overlayDepth > 0;

export function useOverlay(active = true) {
  useEffect(() => {
    if (!active) return;
    overlayDepth += 1;
    return () => { overlayDepth = Math.max(0, overlayDepth - 1); };
  }, [active]);
}

/** Global shortcut dispatch for the registered buttons. */
export function useButtonShortcuts(buttons: ActionButton[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isOverlayOpen()) return;
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
      const target = e.target as HTMLElement | null;
      const typing = !!target
        && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable);
      const combo = comboOf(e);
      // Plain letters must not steal keystrokes while the user is typing.
      if (typing && !/^(F\d|Esc|Ctrl\+|Alt\+)/.test(combo)) return;
      const hit = buttons.find((b) => b.keys && b.keys.toLowerCase() === combo.toLowerCase() && !b.disabled);
      if (hit?.onClick) {
        e.preventDefault();
        e.stopPropagation();
        hit.onClick();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [buttons]);
}

/* ---------------------------------------------------------------- hooks */

/** Delays a fast-changing value, so a search box does not hit the API per key. */
export function useDebounced<T>(value: T, delay = 220): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/** Sorting state shared by every list screen. */
export interface SortState { key: string; dir: 'asc' | 'desc'; }

export function useSort(initial?: SortState) {
  const [sort, setSort] = useState<SortState | null>(initial ?? null);
  const toggle = useCallback((key: string) => {
    setSort((s) => (s && s.key === key
      ? (s.dir === 'asc' ? { key, dir: 'desc' as const } : null)
      : { key, dir: 'asc' as const }));
  }, []);
  return { sort, toggle };
}

/** Compares two cell values the way a person would read them. */
export function compareValues(a: unknown, b: unknown): number {
  const an = a === null || a === undefined || a === '';
  const bn = b === null || b === undefined || b === '';
  if (an && bn) return 0;
  if (an) return 1;
  if (bn) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const as = String(a);
  const bs = String(b);
  const af = Number(as.replace(/,/g, ''));
  const bf = Number(bs.replace(/,/g, ''));
  if (!Number.isNaN(af) && !Number.isNaN(bf) && as.trim() !== '' && bs.trim() !== '') return af - bf;
  return as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' });
}

/* ------------------------------------------------------------ formatting */

export function fmtAmount(n: number | null | undefined, opts: { blankZero?: boolean } = {}): string {
  const v = Number(n ?? 0);
  if (opts.blankZero && Math.abs(v) < 0.005) return '';
  return Math.abs(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtSigned(n: number): string {
  const v = Number(n ?? 0);
  if (Math.abs(v) < 0.005) return '';
  return `${fmtAmount(v)} ${v >= 0 ? 'Dr' : 'Cr'}`;
}

/** 1,23,456.78 becomes "1.23 L" - for stat tiles, where width is scarce. */
export function fmtCompact(n: number | null | undefined): string {
  const v = Math.abs(Number(n ?? 0));
  if (v >= 1e7) return `${(v / 1e7).toFixed(2)} Cr`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(2)} L`;
  return fmtAmount(n);
}

export function fmtQty(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (!v) return '';
  return v.toLocaleString('en-IN', { maximumFractionDigits: 3 });
}

/** Dates are shown as 1-Apr-26. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()}-${months[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`;
}

export function fmtDateTime(s: string | null | undefined): string {
  if (!s) return '';
  const [date, time] = String(s).replace('T', ' ').split(' ');
  return `${fmtDate(date)} ${time ? time.slice(0, 8) : ''}`.trim();
}

export function fmtPeriod(p: Period | null): string {
  if (!p) return '';
  return `${fmtDate(p.from)} to ${fmtDate(p.to)}`;
}
