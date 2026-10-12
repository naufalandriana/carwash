export const qk = {
  dashboardSummary: () => ['dashboard-summary'] as const,
  todayHourly: (date: string) => ['today-hourly', date] as const,
  monthlyRevenue: () => ['monthly-revenue'] as const,
  queue: () => ['queue'] as const,
  recentActivity: () => ['recent-activity'] as const,
  reportTransactions: (from?: string, to?: string) => ['report-transactions', from ?? null, to ?? null] as const,
  transactionDateRange: () => ['transaction-date-range'] as const,
  staff: () => ['staff'] as const,
  vehicles: () => ['vehicles'] as const,
  expenses: () => ['expenses'] as const,
}
