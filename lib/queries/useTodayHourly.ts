'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/Supabase'
import { qk } from './keys'
import { todayWIB, wibDayRange, hourWIB } from '@/lib/date'

export function useTodayHourly() {
  const today = todayWIB()
  return useQuery({
    queryKey: qk.todayHourly(today),
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { start, end } = wibDayRange(today)
      const { data, error } = await supabase
        .from('transactions')
        .select('created_at,harga')
        .gte('created_at', start)
        .lte('created_at', end)
      if (error) throw error
      const points = Array.from({ length: 24 }, (_, i) => ({ label: String(i).padStart(2, '0'), hour: i, total: 0 }))
      for (const row of (data ?? []) as { created_at: string; harga: number }[]) {
        const h = hourWIB(row.created_at)
        if (h >= 0 && h < 24) points[h].total += row.harga ?? 0
      }
      return { points, raw: data ?? [] }
    },
  })
}
