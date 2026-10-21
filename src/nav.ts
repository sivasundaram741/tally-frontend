/* Everything reachable from "Go To", the quick jump (Alt+G / Ctrl+K).
   Keywords are matched alongside the label, so "bs" and "closing balance"
   both land on the Balance Sheet. */

export interface GoToTarget {
  label: string;
  to: string;
  section: string;
  keywords?: string;
}

export const GO_TO_TARGETS: GoToTarget[] = [
  { section: 'Masters', label: 'Chart of Accounts', to: '/masters/chart', keywords: 'coa accounts tree' },
  { section: 'Masters', label: 'Create Master', to: '/masters/create', keywords: 'new ledger group stock item' },
  { section: 'Masters', label: 'Alter Master', to: '/masters/alter', keywords: 'edit change ledger group' },
  { section: 'Masters', label: 'Ledgers', to: '/masters/ledger', keywords: 'accounts parties' },
  { section: 'Masters', label: 'Groups', to: '/masters/group' },
  { section: 'Masters', label: 'Stock Items', to: '/masters/stock-item', keywords: 'inventory products' },
  { section: 'Masters', label: 'Voucher Types', to: '/masters/voucher-type' },
  { section: 'Masters', label: 'Credit Limits', to: '/masters/credit-limits', keywords: 'party limit' },

  { section: 'Transactions', label: 'Accounting Vouchers', to: '/vouchers', keywords: 'entry new voucher' },
  { section: 'Transactions', label: 'Day Book', to: '/day-book', keywords: 'transactions list register' },
  { section: 'Transactions', label: 'Payment', to: '/vouchers/new/Payment', keywords: 'f5 pay' },
  { section: 'Transactions', label: 'Receipt', to: '/vouchers/new/Receipt', keywords: 'f6 collect' },
  { section: 'Transactions', label: 'Sales', to: '/vouchers/new/Sales', keywords: 'f8 invoice' },
  { section: 'Transactions', label: 'Purchase', to: '/vouchers/new/Purchase', keywords: 'f9 bill' },
  { section: 'Transactions', label: 'Journal', to: '/vouchers/new/Journal', keywords: 'f7 adjustment' },
  { section: 'Transactions', label: 'Contra', to: '/vouchers/new/Contra', keywords: 'f4 cash bank transfer' },

  { section: 'Reports', label: 'Balance Sheet', to: '/reports/balance-sheet', keywords: 'bs assets liabilities' },
  { section: 'Reports', label: 'Profit & Loss A/c', to: '/reports/profit-loss', keywords: 'pl income expenses' },
  { section: 'Reports', label: 'Trial Balance', to: '/reports/trial-balance', keywords: 'tb' },
  { section: 'Reports', label: 'Stock Summary', to: '/reports/stock-summary', keywords: 'inventory closing' },
  { section: 'Reports', label: 'Ratio Analysis', to: '/reports/ratio-analysis', keywords: 'ratios' },
  { section: 'Reports', label: 'Ledger Vouchers', to: '/reports/ledgers', keywords: 'statement account' },
  { section: 'Reports', label: 'Cash/Bank Books', to: '/reports/cash-bank', keywords: 'banking' },
  { section: 'Reports', label: 'Bills Receivable', to: '/reports/outstandings/receivable', keywords: 'debtors outstanding' },
  { section: 'Reports', label: 'Bills Payable', to: '/reports/outstandings/payable', keywords: 'creditors outstanding' },
  { section: 'Reports', label: 'Display More Reports', to: '/reports' },

  { section: 'Audit', label: 'Edit Log', to: '/edit-log', keywords: 'history audit trail versions' },
  { section: 'Audit', label: 'Edit Log Summary', to: '/edit-log/summary', keywords: 'audit counts' },
  { section: 'Audit', label: 'Edit Log - Vouchers', to: '/edit-log/entities?kind=Voucher' },
  { section: 'Audit', label: 'Edit Log - Masters', to: '/edit-log/entities?kind=Master' },

  { section: 'Data', label: 'Import', to: '/import', keywords: 'csv json load' },
  { section: 'Data', label: 'Export', to: '/export', keywords: 'csv json download' },
  { section: 'Data', label: 'E-mail a report', to: '/email', keywords: 'send mail' },
  { section: 'Data', label: 'Backup and Restore', to: '/data', keywords: 'save copy json' },
  { section: 'Data', label: 'Exchange', to: '/exchange' },

  { section: 'Company', label: 'Gateway', to: '/', keywords: 'home start' },
  { section: 'Company', label: 'Select Company', to: '/companies', keywords: 'switch open' },
  { section: 'Company', label: 'Create Company', to: '/companies/create', keywords: 'new' },
  { section: 'Company', label: 'Alter Company', to: '/companies/alter', keywords: 'edit settings' },
  { section: 'Company', label: 'Help and Shortcuts', to: '/help', keywords: 'keyboard keys f1' },
];
