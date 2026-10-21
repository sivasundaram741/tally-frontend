/* Field definitions for every master entry screen, mirroring the creation
   screens of a full accounting package. */

export type FieldType = 'text' | 'number' | 'date' | 'yesno' | 'select' | 'ref' | 'textarea';

export interface FormField {
  col: string;
  label: string;
  type: FieldType;
  options?: string[];
  ref?: string;              // key into the lookups payload
  section?: string;
  hint?: string;
  width?: number;
  showIf?: (v: Record<string, any>) => boolean;
}

export interface MasterFormDef {
  key: string;
  label: string;
  plural: string;
  nameCol: string;
  group: 'Accounting Masters' | 'Inventory Masters' | 'Statutory Masters';
  fields: FormField[];
  /** Columns shown on the list screen. */
  list: { col: string; label: string; num?: boolean }[];
}

const YESNO = (col: string, label: string, section?: string, hint?: string): FormField =>
  ({ col, label, type: 'yesno', section, hint });

export const MASTER_FORMS: Record<string, MasterFormDef> = {
  group: {
    key: 'group',
    label: 'Group',
    plural: 'Groups',
    nameCol: 'name',
    group: 'Accounting Masters',
    fields: [
      { col: 'name', label: 'Name', type: 'text' },
      { col: 'alias', label: '(alias)', type: 'text' },
      { col: 'parent_id', label: 'Under', type: 'ref', ref: 'groups' },
      {
        col: 'nature', label: 'Nature of Group', type: 'select',
        options: ['Assets', 'Liabilities', 'Income', 'Expenses'],
        section: 'Behaviour',
      },
      YESNO('is_deemed_positive', 'Group behaves like a sub-ledger'),
      YESNO('affects_gross_profit', 'Does it affect Gross Profit?'),
      YESNO('net_debit_credit', 'Net Debit/Credit balances for reporting'),
      YESNO('used_for_calculation', 'Used for calculation (e.g. taxes, discounts)'),
      YESNO('is_inactive', 'Is Inactive'),
    ],
    list: [
      { col: 'name', label: 'Name' },
      { col: 'parent_id_name', label: 'Under' },
      { col: 'nature', label: 'Nature' },
    ],
  },

  ledger: {
    key: 'ledger',
    label: 'Ledger',
    plural: 'Ledgers',
    nameCol: 'name',
    group: 'Accounting Masters',
    fields: [
      { col: 'name', label: 'Name', type: 'text' },
      { col: 'alias', label: '(alias)', type: 'text' },
      { col: 'group_id', label: 'Under', type: 'ref', ref: 'groups' },
      { col: 'opening_balance', label: 'Opening Balance', type: 'number', width: 200 },
      { col: 'opening_balance_type', label: 'Dr/Cr', type: 'select', options: ['Dr', 'Cr'], width: 90 },

      { col: 'mailing_name', label: 'Mailing Name', type: 'text', section: 'Mailing Details' },
      { col: 'address', label: 'Address', type: 'textarea' },
      { col: 'state', label: 'State', type: 'text' },
      { col: 'country', label: 'Country', type: 'text' },
      { col: 'pincode', label: 'Pincode', type: 'text', width: 160 },
      { col: 'contact_person', label: 'Contact Person', type: 'text' },
      { col: 'phone', label: 'Phone', type: 'text', width: 220 },
      { col: 'email', label: 'E-Mail', type: 'text' },

      {
        col: 'registration_type', label: 'Registration Type', type: 'select',
        options: ['Unregistered', 'Regular', 'Composition', 'Consumer', 'Unknown'],
        section: 'Statutory Details',
      },
      { col: 'gstin', label: 'GSTIN/UIN', type: 'text', width: 240 },
      { col: 'pan', label: 'PAN/IT No.', type: 'text', width: 200 },
      {
        col: 'gst_applicable', label: 'GST Applicability', type: 'select',
        options: ['Not Applicable', 'Applicable', 'Undefined'],
      },
      { col: 'hsn_sac', label: 'HSN/SAC', type: 'text', width: 200 },
      {
        col: 'tax_type', label: 'Type of Duty/Tax', type: 'select',
        options: ['', 'CGST', 'SGST', 'IGST', 'Cess', 'TDS', 'TCS'],
        hint: 'Set this on duty ledgers kept under Duties & Taxes.',
      },
      { col: 'tax_rate', label: 'Tax Rate (%)', type: 'number', width: 120 },

      { col: 'bank_name', label: 'Bank Name', type: 'text', section: 'Banking Details' },
      { col: 'bank_account_no', label: 'A/c No.', type: 'text', width: 240 },
      { col: 'bank_ifsc', label: 'IFS Code', type: 'text', width: 200 },
      { col: 'bank_branch', label: 'Branch', type: 'text' },

      YESNO('is_bill_wise', 'Maintain balances bill-by-bill', 'Behaviour'),
      YESNO('is_cost_centre', 'Cost centres are applicable'),
      YESNO('inventory_affected', 'Inventory values are affected'),
      { col: 'credit_period_days', label: 'Credit Period (days)', type: 'number', width: 140 },
      { col: 'credit_limit', label: 'Credit Limit', type: 'number', width: 200 },
      YESNO('is_inactive', 'Is Inactive'),
    ],
    list: [
      { col: 'name', label: 'Name' },
      { col: 'group_id_name', label: 'Under' },
      { col: 'opening_balance', label: 'Opening Balance', num: true },
      { col: 'opening_balance_type', label: 'Dr/Cr' },
      { col: 'gstin', label: 'GSTIN/UIN' },
    ],
  },

  currency: {
    key: 'currency',
    label: 'Currency',
    plural: 'Currencies',
    nameCol: 'symbol',
    group: 'Accounting Masters',
    fields: [
      { col: 'symbol', label: 'Symbol', type: 'text', width: 120 },
      { col: 'formal_name', label: 'Formal Name', type: 'text' },
      { col: 'decimal_places', label: 'Number of decimal places', type: 'number', width: 100 },
      YESNO('is_base', 'Is this the base currency?'),
      YESNO('suffix_symbol', 'Show amounts in millions'),
      YESNO('space_between', 'Put a space between amount and symbol'),
      { col: 'amount_in_words', label: 'Word representing amount', type: 'text' },
      { col: 'decimal_words', label: 'Word representing decimals', type: 'text' },
      YESNO('is_inactive', 'Is Inactive'),
    ],
    list: [
      { col: 'symbol', label: 'Symbol' },
      { col: 'formal_name', label: 'Formal Name' },
      { col: 'decimal_places', label: 'Decimals', num: true },
    ],
  },

  budget: {
    key: 'budget',
    label: 'Budget',
    plural: 'Budgets',
    nameCol: 'name',
    group: 'Accounting Masters',
    fields: [
      { col: 'name', label: 'Name', type: 'text' },
      { col: 'parent_id', label: 'Under', type: 'ref', ref: 'budgets' },
      { col: 'period_from', label: 'Period From', type: 'date', width: 200 },
      { col: 'period_to', label: 'Period To', type: 'date', width: 200 },
      YESNO('is_inactive', 'Is Inactive'),
    ],
    list: [
      { col: 'name', label: 'Name' },
      { col: 'period_from', label: 'From' },
      { col: 'period_to', label: 'To' },
    ],
  },

  scenario: {
    key: 'scenario',
    label: 'Scenario',
    plural: 'Scenarios',
    nameCol: 'name',
    group: 'Accounting Masters',
    fields: [
      { col: 'name', label: 'Name', type: 'text' },
      { col: 'include_types', label: 'Include these voucher types', type: 'text', hint: 'Comma separated, e.g. Reversing Journal, Memorandum' },
      { col: 'exclude_types', label: 'Exclude these voucher types', type: 'text' },
      YESNO('is_inactive', 'Is Inactive'),
    ],
    list: [
      { col: 'name', label: 'Name' },
      { col: 'include_types', label: 'Includes' },
    ],
  },

  'voucher-type': {
    key: 'voucher-type',
    label: 'Voucher Type',
    plural: 'Voucher Types',
    nameCol: 'name',
    group: 'Accounting Masters',
    fields: [
      { col: 'name', label: 'Name', type: 'text' },
      { col: 'alias', label: '(alias)', type: 'text' },
      {
        col: 'parent_type', label: 'Select type of voucher', type: 'select',
        options: [
          'Contra', 'Payment', 'Receipt', 'Journal', 'Sales', 'Purchase',
          'Credit Note', 'Debit Note', 'Reversing Journal', 'Memorandum',
          'Sales Order', 'Purchase Order', 'Delivery Note', 'Receipt Note',
          'Rejections In', 'Rejections Out', 'Stock Journal', 'Physical Stock',
          'Material In', 'Material Out', 'Payroll', 'Attendance',
        ],
      },
      { col: 'abbreviation', label: 'Abbreviation', type: 'text', width: 160 },
      {
        col: 'numbering_method', label: 'Method of voucher numbering', type: 'select',
        options: ['Automatic', 'Automatic (Manual Override)', 'Manual', 'None'],
        section: 'Numbering',
      },
      {
        col: 'restart_numbering', label: 'Restart numbering', type: 'select',
        options: ['Yearly', 'Monthly', 'Never'],
      },
      { col: 'prefix', label: 'Prefix details', type: 'text', width: 160 },
      { col: 'suffix', label: 'Suffix details', type: 'text', width: 160 },
      { col: 'starting_number', label: 'Starting number', type: 'number', width: 120 },
      YESNO('use_common_narration', 'Use common narration', 'Behaviour'),
      YESNO('narration_per_entry', 'Narration for each entry'),
      YESNO('print_after_saving', 'Print voucher after saving'),
      YESNO('is_optional_default', 'Make this voucher type "Optional" by default'),
      YESNO('affects_stock', 'Affects stock'),
      YESNO('allow_zero_valued', 'Allow zero-valued transactions'),
      YESNO('is_inactive', 'Is Inactive'),
    ],
    list: [
      { col: 'name', label: 'Name' },
      { col: 'parent_type', label: 'Type of Voucher' },
      { col: 'abbreviation', label: 'Abbreviation' },
      { col: 'numbering_method', label: 'Numbering' },
    ],
  },

  'cost-category': {
    key: 'cost-category',
    label: 'Cost Category',
    plural: 'Cost Categories',
    nameCol: 'name',
    group: 'Accounting Masters',
    fields: [
      { col: 'name', label: 'Name', type: 'text' },
      { col: 'alias', label: '(alias)', type: 'text' },
      YESNO('allocate_revenue', 'Allocate revenue items'),
      YESNO('allocate_non_revenue', 'Allocate non-revenue items'),
      YESNO('is_inactive', 'Is Inactive'),
    ],
    list: [{ col: 'name', label: 'Name' }],
  },

  'cost-centre': {
    key: 'cost-centre',
    label: 'Cost Centre',
    plural: 'Cost Centres',
    nameCol: 'name',
    group: 'Accounting Masters',
    fields: [
      { col: 'name', label: 'Name', type: 'text' },
      { col: 'alias', label: '(alias)', type: 'text' },
      { col: 'category_id', label: 'Category', type: 'ref', ref: 'costCategories' },
      { col: 'parent_id', label: 'Under', type: 'ref', ref: 'costCentres' },
      YESNO('is_inactive', 'Is Inactive'),
    ],
    list: [
      { col: 'name', label: 'Name' },
      { col: 'category_id_name', label: 'Category' },
      { col: 'parent_id_name', label: 'Under' },
    ],
  },

  'stock-group': {
    key: 'stock-group',
    label: 'Stock Group',
    plural: 'Stock Groups',
    nameCol: 'name',
    group: 'Inventory Masters',
    fields: [
      { col: 'name', label: 'Name', type: 'text' },
      { col: 'alias', label: '(alias)', type: 'text' },
      { col: 'parent_id', label: 'Under', type: 'ref', ref: 'stockGroups' },
      YESNO('quantities_added', 'Should quantities of items be added?'),
      { col: 'hsn_sac', label: 'HSN/SAC', type: 'text', width: 200, section: 'GST Details' },
      { col: 'tax_rate', label: 'Tax Rate (%)', type: 'number', width: 120 },
      YESNO('is_inactive', 'Is Inactive'),
    ],
    list: [
      { col: 'name', label: 'Name' },
      { col: 'parent_id_name', label: 'Under' },
      { col: 'hsn_sac', label: 'HSN/SAC' },
    ],
  },

  'stock-category': {
    key: 'stock-category',
    label: 'Stock Category',
    plural: 'Stock Categories',
    nameCol: 'name',
    group: 'Inventory Masters',
    fields: [
      { col: 'name', label: 'Name', type: 'text' },
      { col: 'alias', label: '(alias)', type: 'text' },
      { col: 'parent_id', label: 'Under', type: 'ref', ref: 'stockCategories' },
      YESNO('is_inactive', 'Is Inactive'),
    ],
    list: [
      { col: 'name', label: 'Name' },
      { col: 'parent_id_name', label: 'Under' },
    ],
  },

  'stock-item': {
    key: 'stock-item',
    label: 'Stock Item',
    plural: 'Stock Items',
    nameCol: 'name',
    group: 'Inventory Masters',
    fields: [
      { col: 'name', label: 'Name', type: 'text' },
      { col: 'alias', label: '(alias)', type: 'text' },
      { col: 'part_number', label: 'Part No.', type: 'text', width: 200 },
      { col: 'stock_group_id', label: 'Under', type: 'ref', ref: 'stockGroups' },
      { col: 'category_id', label: 'Category', type: 'ref', ref: 'stockCategories' },
      { col: 'unit_id', label: 'Units', type: 'ref', ref: 'units' },

      { col: 'opening_qty', label: 'Opening Quantity', type: 'number', width: 180, section: 'Opening Balance' },
      { col: 'opening_rate', label: 'Opening Rate', type: 'number', width: 180 },
      { col: 'opening_value', label: 'Opening Value', type: 'number', width: 200, hint: 'Leave at 0 to use Quantity x Rate.' },

      {
        col: 'gst_applicable', label: 'GST Applicability', type: 'select',
        options: ['Applicable', 'Not Applicable', 'Undefined'], section: 'GST Details',
      },
      { col: 'hsn_sac', label: 'HSN/SAC', type: 'text', width: 200 },
      {
        col: 'taxability', label: 'Taxability', type: 'select',
        options: ['Taxable', 'Exempt', 'Nil Rated', 'Non-GST'],
      },
      { col: 'tax_rate', label: 'Integrated Tax Rate (%)', type: 'number', width: 140 },
      { col: 'cess_rate', label: 'Cess Rate (%)', type: 'number', width: 140 },

      { col: 'standard_cost', label: 'Standard Cost', type: 'number', width: 180, section: 'Other Details' },
      { col: 'standard_price', label: 'Standard Selling Price', type: 'number', width: 180 },
      {
        col: 'costing_method', label: 'Costing Method', type: 'select',
        options: ['Avg. Cost', 'FIFO', 'LIFO', 'Last Purchase Cost', 'Std. Cost'],
      },
      YESNO('maintain_batches', 'Maintain in batches'),
      { col: 'reorder_level', label: 'Re-order Level', type: 'number', width: 160 },
      { col: 'min_order_qty', label: 'Minimum Order Quantity', type: 'number', width: 160 },
      YESNO('is_inactive', 'Is Inactive'),
    ],
    list: [
      { col: 'name', label: 'Name' },
      { col: 'stock_group_id_name', label: 'Under' },
      { col: 'unit_id_name', label: 'Units' },
      { col: 'opening_qty', label: 'Opening Qty', num: true },
      { col: 'opening_rate', label: 'Rate', num: true },
      { col: 'hsn_sac', label: 'HSN/SAC' },
    ],
  },

  unit: {
    key: 'unit',
    label: 'Unit',
    plural: 'Units',
    nameCol: 'symbol',
    group: 'Inventory Masters',
    fields: [
      { col: 'unit_type', label: 'Type', type: 'select', options: ['Simple', 'Compound'] },
      { col: 'symbol', label: 'Symbol', type: 'text', width: 160 },
      { col: 'formal_name', label: 'Formal Name', type: 'text' },
      {
        col: 'decimal_places', label: 'Number of decimal places', type: 'number', width: 100,
        hint: '0 for whole numbers such as Nos, 2-3 for Kg or Ltr.',
      },
      {
        col: 'base_unit_id', label: 'Base Unit', type: 'ref', ref: 'units',
        showIf: (v) => v.unit_type === 'Compound',
      },
      {
        col: 'additional_unit_id', label: 'Additional Unit', type: 'ref', ref: 'units',
        showIf: (v) => v.unit_type === 'Compound',
      },
      {
        col: 'conversion', label: 'Conversion', type: 'number', width: 140,
        showIf: (v) => v.unit_type === 'Compound',
      },
      YESNO('is_inactive', 'Is Inactive'),
    ],
    list: [
      { col: 'symbol', label: 'Symbol' },
      { col: 'formal_name', label: 'Formal Name' },
      { col: 'unit_type', label: 'Type' },
      { col: 'decimal_places', label: 'Decimals', num: true },
    ],
  },

  godown: {
    key: 'godown',
    label: 'Godown',
    plural: 'Godowns',
    nameCol: 'name',
    group: 'Inventory Masters',
    fields: [
      { col: 'name', label: 'Name', type: 'text' },
      { col: 'alias', label: '(alias)', type: 'text' },
      { col: 'parent_id', label: 'Under', type: 'ref', ref: 'godowns' },
      { col: 'address', label: 'Address', type: 'textarea' },
      YESNO('allow_storage', 'Allow storage of materials'),
      YESNO('is_inactive', 'Is Inactive'),
    ],
    list: [
      { col: 'name', label: 'Name' },
      { col: 'parent_id_name', label: 'Under' },
      { col: 'address', label: 'Address' },
    ],
  },

  'gst-registration': {
    key: 'gst-registration',
    label: 'GST Registration',
    plural: 'GST Registrations',
    nameCol: 'name',
    group: 'Statutory Masters',
    fields: [
      { col: 'name', label: 'Registration Name', type: 'text' },
      { col: 'state', label: 'State', type: 'text' },
      {
        col: 'registration_type', label: 'Registration Type', type: 'select',
        options: ['Regular', 'Composition', 'Unregistered', 'Consumer'],
      },
      { col: 'gstin', label: 'GSTIN/UIN', type: 'text', width: 240 },
      { col: 'applicable_from', label: 'Applicable From', type: 'date', width: 200 },
      {
        col: 'periodicity', label: 'Periodicity of GSTR-1', type: 'select',
        options: ['Monthly', 'Quarterly'],
      },
      YESNO('is_default', 'Set as default registration'),
      YESNO('is_inactive', 'Is Inactive'),
    ],
    list: [
      { col: 'name', label: 'Name' },
      { col: 'state', label: 'State' },
      { col: 'gstin', label: 'GSTIN/UIN' },
      { col: 'registration_type', label: 'Type' },
    ],
  },

  'gst-classification': {
    key: 'gst-classification',
    label: 'GST Classification',
    plural: 'GST Classifications',
    nameCol: 'name',
    group: 'Statutory Masters',
    fields: [
      { col: 'name', label: 'Name', type: 'text' },
      { col: 'hsn_sac', label: 'HSN/SAC', type: 'text', width: 200 },
      { col: 'description', label: 'Description', type: 'text' },
      {
        col: 'taxability', label: 'Taxability', type: 'select',
        options: ['Taxable', 'Exempt', 'Nil Rated', 'Non-GST'],
      },
      { col: 'tax_rate', label: 'Integrated Tax Rate (%)', type: 'number', width: 140 },
      { col: 'cess_rate', label: 'Cess Rate (%)', type: 'number', width: 140 },
      { col: 'applicable_from', label: 'Applicable From', type: 'date', width: 200 },
      YESNO('is_inactive', 'Is Inactive'),
    ],
    list: [
      { col: 'name', label: 'Name' },
      { col: 'hsn_sac', label: 'HSN/SAC' },
      { col: 'tax_rate', label: 'Rate %', num: true },
      { col: 'taxability', label: 'Taxability' },
    ],
  },

  'tds-nature': {
    key: 'tds-nature',
    label: 'TDS Nature of Payment',
    plural: 'TDS Natures of Payment',
    nameCol: 'name',
    group: 'Statutory Masters',
    fields: [
      { col: 'name', label: 'Name', type: 'text' },
      { col: 'section', label: 'Section', type: 'text', width: 160 },
      { col: 'payment_code', label: 'Payment Code', type: 'text', width: 160 },
      { col: 'rate_individual', label: 'Rate for Individual/HUF (%)', type: 'number', width: 140 },
      { col: 'rate_company', label: 'Rate for Other Deductee (%)', type: 'number', width: 140 },
      { col: 'rate_no_pan', label: 'Rate if PAN not available (%)', type: 'number', width: 140 },
      { col: 'threshold', label: 'Threshold/Exemption Limit', type: 'number', width: 200 },
      YESNO('is_inactive', 'Is Inactive'),
    ],
    list: [
      { col: 'name', label: 'Name' },
      { col: 'section', label: 'Section' },
      { col: 'rate_individual', label: 'Individual %', num: true },
      { col: 'rate_company', label: 'Company %', num: true },
    ],
  },
};

/**
 * The "List of Masters" layout. Entries marked
 * `advanced` are revealed only on "Expand All" (they depend
 * on company features such as cost centres being switched on).
 */
export const MASTER_MENU: {
  section: string;
  items: { label: string; key?: string; to?: string; advanced?: boolean }[];
}[] = [
  {
    section: 'Accounting Masters',
    items: [
      { label: 'Group', key: 'group' },
      { label: 'Ledger', key: 'ledger' },
      { label: 'Currency', key: 'currency' },
      { label: 'Budget', key: 'budget' },
      { label: 'Scenario', key: 'scenario' },
      { label: 'Voucher Type', key: 'voucher-type' },
      { label: 'Credit Limits', to: '/masters/credit-limits' },
      { label: 'Cost Category', key: 'cost-category', advanced: true },
      { label: 'Cost Centre', key: 'cost-centre', advanced: true },
    ],
  },
  {
    section: 'Inventory Masters',
    items: [
      { label: 'Stock Group', key: 'stock-group' },
      { label: 'Stock Category', key: 'stock-category' },
      { label: 'Stock Item', key: 'stock-item' },
      { label: 'Unit', key: 'unit' },
      { label: 'Godown', key: 'godown' },
      { label: 'Copy Allocation Details', to: '/masters/stock-item' },
    ],
  },
  {
    section: 'Statutory Masters',
    items: [
      { label: 'GST Registration', key: 'gst-registration' },
      { label: 'GST Classification', key: 'gst-classification' },
      { label: 'TDS Nature of Payments', key: 'tds-nature' },
    ],
  },
  {
    section: 'Statutory Details',
    items: [
      { label: 'Company GST Details', to: '/companies/alter' },
      { label: 'TDS Details', to: '/companies/alter' },
      { label: 'PAN/CIN Details', to: '/companies/alter' },
    ],
  },
];

/** Master types shown when the list is collapsed ("Show Less"). */
export const COMPACT_KEYS = new Set([
  'group', 'ledger', 'voucher-type', 'stock-group', 'stock-item', 'unit', 'godown',
]);
