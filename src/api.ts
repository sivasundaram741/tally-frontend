/* Thin fetch wrapper around the LedgerTrail API. */

export interface Company {
  id: number;
  name: string;
  mailing_name: string;
  address: string;
  state: string;
  country: string;
  pincode: string;
  phone: string;
  mobile: string;
  email: string;
  website: string;
  financial_year_from: string;
  financial_year_to?: string;
  books_begin_from: string;
  base_currency: string;
  currency_name: string;
  decimal_places: number;
  gstin: string;
  gst_registration_type: string;
  pan: string;
  cin: string;
  tan: string;
  maintain: string;
  edit_log_enabled: number;
  gst_enabled: number;
  tds_enabled: number;
}

export interface MasterRow {
  id: number;
  name?: string;
  symbol?: string;
  _display: string;
  is_inactive: number;
  is_reserved?: number;
  [k: string]: unknown;
}

export interface VoucherType {
  id: number;
  name: string;
  parent_type: string;
  abbreviation: string;
  numbering_method: string;
  affects_stock: number;
  is_reserved: number;
}

export interface VoucherEntry {
  id?: number;
  line_no?: number;
  ledger_id: number | null;
  ledger_name?: string;
  dr_cr: 'Dr' | 'Cr';
  amount: number;
  cost_centre_id?: number | null;
  narration?: string;
}

export interface VoucherInventory {
  id?: number;
  stock_item_id: number | null;
  stock_item_name?: string;
  godown_id?: number | null;
  godown_name?: string;
  unit_id?: number | null;
  unit_name?: string;
  batch?: string;
  quantity: number;
  rate: number;
  discount_pct?: number;
  amount: number;
  direction: 'In' | 'Out';
}

export interface BillAllocation {
  id?: number;
  ledger_id: number | null;
  ledger_name?: string;
  bill_name: string;
  bill_type: string;
  amount: number;
  dr_cr: 'Dr' | 'Cr';
  due_date?: string;
}

export interface Voucher {
  id: number;
  company_id: number;
  voucher_type_id: number;
  voucher_type_name: string;
  parent_type?: string;
  voucher_number: string;
  date: string;
  reference_no: string;
  reference_date: string;
  party_ledger_id: number | null;
  party_name?: string | null;
  narration: string;
  place_of_supply: string;
  mode: string;
  is_cancelled: number;
  is_optional: number;
  is_post_dated: number;
  is_deleted: number;
  total_amount: number;
  version_no: number;
  created_at: string;
  created_by: string;
  altered_at: string | null;
  altered_by: string | null;
  entries: VoucherEntry[];
  inventory: VoucherInventory[];
  bills: BillAllocation[];
}

export interface EditLogChange {
  field: string;
  from: string;
  to: string;
  kind: 'added' | 'removed' | 'modified';
}

export interface EditLogEntry {
  id: number;
  entity_type: string;
  entity_kind: 'Master' | 'Voucher';
  entity_id: number;
  entity_name: string;
  entity_label: string;
  action: 'Created' | 'Altered' | 'Deleted' | 'Cancelled' | 'Restored';
  version_no: number;
  username: string;
  machine: string;
  ip_address: string;
  logged_at: string;
  voucher_date: string;
  voucher_type: string;
  voucher_number: string;
  amount: number;
  /** Present on per-entity history; omitted from the list report. */
  snapshot?: Record<string, unknown>;
  changes?: EditLogChange[];
  previousVersion?: number | null;
  changeCount?: number;
  changedFields?: string[];
}

export interface EditLogEntityRow {
  entity_kind: 'Master' | 'Voucher';
  entity_type: string;
  entity_id: number;
  entity_label: string;
  entity_name: string;
  voucher_type: string;
  voucher_number: string;
  voucher_date: string;
  amount: number;
  versions: number;
  first_at: string;
  last_at: string;
  alterations: number;
  deletions: number;
  cancellations: number;
  lastAction: { action: string; username: string } | null;
}

export interface ReportNode {
  id: number;
  name: string;
  type: string;
  nature?: string;
  opening: number;
  debit: number;
  credit: number;
  closing: number;
  amount?: number;
  children: ReportNode[];
}

export interface Period { from: string; to: string; fyFrom: string; fyTo: string; }

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let currentCompanyId: number | null = null;
export function setApiCompany(id: number | null) { currentCompanyId = id; }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (currentCompanyId) headers['x-company-id'] = String(currentCompanyId);

  const res = await fetch(`/api${path}`, { ...init, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data?.error || res.statusText);
  return data as T;
}

const qs = (params: Record<string, unknown>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
};

const withCompany = (params: Record<string, unknown> = {}) => ({
  companyId: currentCompanyId ?? undefined,
  ...params,
});

export const api = {
  health: () => request<{ status: string }>('/health'),

  // --- companies ---------------------------------------------------------
  companies: () => request<Company[]>('/companies'),
  company: (id: number) => request<Company>(`/companies/${id}`),
  companyDefaults: () => request<{ financial_year_from: string; financial_year_to: string; books_begin_from: string }>('/companies/defaults'),
  createCompany: (body: Partial<Company>) =>
    request<Company>('/companies', { method: 'POST', body: JSON.stringify(body) }),
  updateCompany: (id: number, body: Partial<Company>) =>
    request<Company>(`/companies/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteCompany: (id: number) => request<{ deleted: boolean }>(`/companies/${id}`, { method: 'DELETE' }),
  seedDemo: () => request<{ company: Company }>('/demo/seed', { method: 'POST', body: '{}' }),

  // --- masters -----------------------------------------------------------
  masterCounts: () => request<Record<string, number>>(`/masters/counts${qs(withCompany())}`),
  lookups: () => request<Record<string, MasterRow[]>>(`/masters/lookups${qs(withCompany())}`),
  masters: (type: string, params: Record<string, unknown> = {}) =>
    request<MasterRow[]>(`/masters/${type}${qs(withCompany(params))}`),
  master: (type: string, id: number) =>
    request<MasterRow>(`/masters/${type}/${id}${qs(withCompany())}`),
  createMaster: (type: string, body: Record<string, unknown>) =>
    request<MasterRow>(`/masters/${type}${qs(withCompany())}`, { method: 'POST', body: JSON.stringify(body) }),
  updateMaster: (type: string, id: number, body: Record<string, unknown>) =>
    request<MasterRow>(`/masters/${type}/${id}${qs(withCompany())}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteMaster: (type: string, id: number) =>
    request<{ deleted: boolean }>(`/masters/${type}/${id}${qs(withCompany())}`, { method: 'DELETE' }),
  masterHistory: (type: string, id: number) =>
    request<EditLogEntry[]>(`/masters/${type}/${id}/history${qs(withCompany())}`),

  // --- vouchers ----------------------------------------------------------
  voucherTypes: () => request<VoucherType[]>(`/vouchers/types${qs(withCompany())}`),
  nextVoucherNumber: (voucherTypeId: number, date: string) =>
    request<{ voucher_number: string }>(`/vouchers/next-number${qs(withCompany({ voucherTypeId, date }))}`),
  vouchers: (params: Record<string, unknown> = {}) =>
    request<Voucher[]>(`/vouchers${qs(withCompany(params))}`),
  voucher: (id: number, params: Record<string, unknown> = {}) =>
    request<Voucher>(`/vouchers/${id}${qs(withCompany(params))}`),
  createVoucher: (body: Record<string, unknown>) =>
    request<Voucher>(`/vouchers${qs(withCompany())}`, { method: 'POST', body: JSON.stringify(body) }),
  updateVoucher: (id: number, body: Record<string, unknown>) =>
    request<Voucher>(`/vouchers/${id}${qs(withCompany())}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteVoucher: (id: number) =>
    request<{ deleted: boolean }>(`/vouchers/${id}${qs(withCompany())}`, { method: 'DELETE' }),
  cancelVoucher: (id: number) =>
    request<Voucher>(`/vouchers/${id}/cancel${qs(withCompany())}`, { method: 'POST', body: '{}' }),
  restoreVoucher: (id: number) =>
    request<Voucher>(`/vouchers/${id}/restore${qs(withCompany())}`, { method: 'POST', body: '{}' }),
  voucherHistory: (id: number) =>
    request<EditLogEntry[]>(`/vouchers/${id}/history${qs(withCompany())}`),

  // --- reports -----------------------------------------------------------
  period: () => request<Period>(`/reports/period${qs(withCompany())}`),
  dashboard: (p: Record<string, unknown> = {}) => request<any>(`/reports/dashboard${qs(withCompany(p))}`),
  trialBalance: (p: Record<string, unknown> = {}) => request<any>(`/reports/trial-balance${qs(withCompany(p))}`),
  balanceSheet: (p: Record<string, unknown> = {}) => request<any>(`/reports/balance-sheet${qs(withCompany(p))}`),
  profitLoss: (p: Record<string, unknown> = {}) => request<any>(`/reports/profit-loss${qs(withCompany(p))}`),
  stockSummary: (p: Record<string, unknown> = {}) => request<any>(`/reports/stock-summary${qs(withCompany(p))}`),
  ratioAnalysis: (p: Record<string, unknown> = {}) => request<any>(`/reports/ratio-analysis${qs(withCompany(p))}`),
  cashBank: (p: Record<string, unknown> = {}) => request<any>(`/reports/cash-bank${qs(withCompany(p))}`),
  outstandings: (kind: string, p: Record<string, unknown> = {}) =>
    request<any>(`/reports/outstandings/${kind}${qs(withCompany(p))}`),
  ledgerStatement: (id: number, p: Record<string, unknown> = {}) =>
    request<any>(`/reports/ledger/${id}${qs(withCompany(p))}`),
  groupSummary: (id: number, p: Record<string, unknown> = {}) =>
    request<any>(`/reports/group/${id}${qs(withCompany(p))}`),

  // --- data: backup, restore, import, export -----------------------------
  dataCatalogue: () => request<{
    exports: { key: string; label: string }[];
    imports: { key: string; label: string }[];
  }>('/data/catalogue'),
  backup: () => request<any>(`/data/backup${qs(withCompany())}`),
  restore: (dump: unknown, name?: string) =>
    request<{ company: Company; restored: Record<string, number> }>('/data/restore', {
      method: 'POST',
      body: JSON.stringify({ dump, name }),
    }),
  exportPreview: (kind: string, p: Record<string, unknown> = {}) =>
    request<{ headers: string[]; rows: unknown[][]; total: number }>(
      `/data/export/${kind}/preview${qs(withCompany(p))}`,
    ),
  /** Direct link used for downloads, so the browser handles the file. */
  exportUrl: (kind: string, p: Record<string, unknown> = {}) =>
    `/api${`/data/export/${kind}`}${qs(withCompany({ ...p, download: 1 }))}`,
  backupUrl: () => `/api/data/backup${qs(withCompany({ download: 1 }))}`,
  importRows: (kind: string, rows: unknown[]) =>
    request<{ imported: number; total: number; failed: { line: number; error: string }[] }>(
      `/data/import/${kind}${qs(withCompany())}`,
      { method: 'POST', body: JSON.stringify({ rows }) },
    ),
  repair: () => request<{ message: string }>('/data/repair', { method: 'POST', body: '{}' }),

  // --- edit log ----------------------------------------------------------
  editLog: (p: Record<string, unknown> = {}) => request<EditLogEntry[]>(`/edit-log${qs(withCompany(p))}`),
  editLogSummary: (p: Record<string, unknown> = {}) => request<any>(`/edit-log/summary${qs(withCompany(p))}`),
  editLogEntities: (p: Record<string, unknown> = {}) =>
    request<EditLogEntityRow[]>(`/edit-log/entities${qs(withCompany(p))}`),
  editLogUsers: () => request<{ username: string; events: number }[]>(`/edit-log/users${qs(withCompany())}`),
  editLogHistory: (type: string, id: number) =>
    request<EditLogEntry[]>(`/edit-log/${type}/${id}${qs(withCompany())}`),
  editLogCompare: (type: string, id: number, a: number, b: number) =>
    request<{ left: EditLogEntry; right: EditLogEntry; changes: EditLogChange[] }>(
      `/edit-log/${type}/${id}/compare${qs(withCompany({ a, b }))}`,
    ),
};
