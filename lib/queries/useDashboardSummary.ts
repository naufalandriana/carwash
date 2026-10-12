'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/Supabase'
import { qk } from './keys'
import { wibDayRange, todayWIB, last7DaysWIB } from '@/lib/date'

export interface DashboardSummary {
  today_revenue: number
  today_count: number
  today_expenses: number
  last7days: { date: string; total: number }[]
}

export function useDashboardSummary() {
  return useQuery<DashboardSummary>({
    queryKey: qk.dashboardSummary(),
    staleTime: 30 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('rpc_dashboard_summary')
      if (!error && data) {
        // supabase-js returns JSON directly; validate shape
        const v = data as unknown as DashboardSummary
        if (
          typeof v.today_revenue === 'number' &&
          typeof v.today_count === 'number' &&
          typeof v.today_expenses === 'number' &&
          Array.isArray(v.last7days)
        ) {
          return v
        }
      }
      // Fallback: hitung dari query biasa, jangan crash
      try {
        const today = todayWIB()
        const { start, end } = wibDayRange(today)
        const txP = supabase.from('transactions').select('harga,created_at').gte('created_at', start).lte('created_at', end)
        const expP = supabase.from('expenses').select('nominal,created_at').gte('created_at', start).lte('created_at', end)
        const last7P = (async (): Promise<unknown> => {
          const days = last7DaysWIB()
          const from = wibDayRange(days[0].date).start
          const to = wibDayRange(days[days.length - 1].date).end
          const { data } = await supabase
            .from('transactions')
            .select('harga,created_at')
            .gte('created_at', from)
            .lte('created_at', to)
          return data
        })()
        const [txRes, expRes, last7Raw] = (await Promise.all([txP, expP, last7P])) as [
          { data: { harga: number; created_at: string }[] | null },
          { data: { nominal: number; created_at: string }[] | null },
          unknown,
        ]
        const txToday = txRes.data
        const expToday = expRes.data
        const today_revenue = (txToday ?? []).reduce((s: number, r: { harga: number }) => s + (r.harga ?? 0), 0)
        const today_count = (txToday ?? []).length
        const today_expenses = (expToday ?? []).reduce((s: number, r: { nominal: number }) => s + (r.nominal ?? 0), 0)
        // build last7days buckets
        const buckets = last7DaysWIB()
        const map = new Map<string, number>()
        buckets.forEach((b) => map.set(b.date, 0))
        // use wibDateFromISO for grouping
        const { wibDateFromISO } = await import('@/lib/date')
        for (const r of (last7Raw ?? []) as { harga: number; created_at: string }[]) {
          const d = wibDateFromISO(r.created_at)
          if (map.has(d)) map.set(d, (map.get(d) ?? 0) + (r.harga ?? 0))
        }
        const last7days = buckets.map((b) => ({ date: b.date, total: map.get(b.date) ?? 0 }))
        return { today_revenue, today_count, today_expenses, last7days }
      } catch {
        return { today_revenue: 0, today_count: 0, today_expenses: 0, last7days: last7DaysWIB().map((b) => ({ date: b.date, total: 0 })) }
      }
    },
  })
}
