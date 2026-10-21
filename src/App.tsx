import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider, useApp } from './state';
import Shell from './Shell';
import { Spinner } from './ui';
import Gateway from './screens/Gateway';
import { CompanySelect, CompanyForm } from './screens/Company';
import { MastersMenu, MasterList, MasterForm, CreditLimits } from './screens/Masters';
import { VoucherMenu, VoucherEntryScreen, DayBook } from './screens/Vouchers';
import {
  ReportsMenu, BalanceSheet, ProfitLoss, TrialBalance, StockSummary,
  RatioAnalysis, Outstandings, CashBank, LedgerIndex, LedgerStatement,
} from './screens/Reports';
import {
  EditLogReport, EditLogSummary, EditLogEntities, EditLogHistory,
} from './screens/EditLog';
import {
  DataMenu, ExchangeMenu, ImportScreen, ExportScreen, EmailScreen, HelpScreen,
} from './screens/Tools';

function Boot({ children }: { children: React.ReactNode }) {
  const app = useApp();
  if (app.loading) {
    return (
      <div className="lt-login">
        <div className="lt-panel" style={{ padding: '22px 26px', minWidth: 340 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Spinner large />
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text)' }}>LedgerTrail</div>
              <div className="lt-muted lt-small">Connecting to the data server...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

/** Sends the user to company selection until a company is open. */
function RequireCompany({ children }: { children: React.ReactNode }) {
  const app = useApp();
  if (!app.company) return <Navigate to="/companies" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Boot>
          <Routes>
            <Route element={<Shell />}>
              <Route path="/" element={<RequireCompany><Gateway /></RequireCompany>} />

              <Route path="/companies" element={<CompanySelect />} />
              <Route path="/companies/create" element={<CompanyForm mode="create" />} />
              <Route path="/companies/alter" element={<CompanyForm mode="alter" />} />
              <Route path="/companies/alter/:id" element={<CompanyForm mode="alter" />} />

              <Route path="/masters/create" element={<RequireCompany><MastersMenu mode="create" /></RequireCompany>} />
              <Route path="/masters/alter" element={<RequireCompany><MastersMenu mode="alter" /></RequireCompany>} />
              <Route path="/masters/chart" element={<RequireCompany><MastersMenu mode="chart" /></RequireCompany>} />
              <Route path="/masters/credit-limits" element={<RequireCompany><CreditLimits /></RequireCompany>} />
              <Route path="/masters/:type" element={<RequireCompany><MasterList /></RequireCompany>} />
              <Route path="/masters/:type/new" element={<RequireCompany><MasterForm /></RequireCompany>} />
              <Route path="/masters/:type/:id" element={<RequireCompany><MasterForm /></RequireCompany>} />

              <Route path="/vouchers" element={<RequireCompany><VoucherMenu /></RequireCompany>} />
              <Route path="/vouchers/new/:type" element={<RequireCompany><VoucherEntryScreen /></RequireCompany>} />
              <Route path="/vouchers/:id" element={<RequireCompany><VoucherEntryScreen /></RequireCompany>} />
              <Route path="/day-book" element={<RequireCompany><DayBook /></RequireCompany>} />

              <Route path="/reports" element={<RequireCompany><ReportsMenu /></RequireCompany>} />
              <Route path="/reports/balance-sheet" element={<RequireCompany><BalanceSheet /></RequireCompany>} />
              <Route path="/reports/profit-loss" element={<RequireCompany><ProfitLoss /></RequireCompany>} />
              <Route path="/reports/trial-balance" element={<RequireCompany><TrialBalance /></RequireCompany>} />
              <Route path="/reports/stock-summary" element={<RequireCompany><StockSummary /></RequireCompany>} />
              <Route path="/reports/ratio-analysis" element={<RequireCompany><RatioAnalysis /></RequireCompany>} />
              <Route path="/reports/cash-bank" element={<RequireCompany><CashBank /></RequireCompany>} />
              <Route path="/reports/ledgers" element={<RequireCompany><LedgerIndex /></RequireCompany>} />
              <Route path="/reports/ledger/:id" element={<RequireCompany><LedgerStatement /></RequireCompany>} />
              <Route path="/reports/outstandings/:kind" element={<RequireCompany><Outstandings /></RequireCompany>} />

              <Route path="/edit-log" element={<RequireCompany><EditLogReport /></RequireCompany>} />
              <Route path="/edit-log/summary" element={<RequireCompany><EditLogSummary /></RequireCompany>} />
              <Route path="/edit-log/entities" element={<RequireCompany><EditLogEntities /></RequireCompany>} />
              <Route
                path="/edit-log/:entityType/:entityId"
                element={<RequireCompany><EditLogHistory /></RequireCompany>}
              />

              <Route path="/data" element={<RequireCompany><DataMenu /></RequireCompany>} />
              <Route path="/exchange" element={<RequireCompany><ExchangeMenu /></RequireCompany>} />
              <Route path="/import" element={<RequireCompany><ImportScreen /></RequireCompany>} />
              <Route path="/export" element={<RequireCompany><ExportScreen /></RequireCompany>} />
              <Route path="/email" element={<RequireCompany><EmailScreen /></RequireCompany>} />
              <Route path="/help" element={<HelpScreen />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Boot>
      </BrowserRouter>
    </AppProvider>
  );
}
