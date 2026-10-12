'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/Supabase'
import { qk } from './keys'
import { monthKeyWIB } from '@/lib/date'

export function useMonthlyRevenue() {
  return useQuery({
    queryKey: qk.monthlyRevenue(),
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    queryFn: async () => {
      const PAGE = 1000
      const all: { created_at: string; harga: number }[] = []
      let offset = 0
      for (;;) {
        const { data, error } = await supabase
          .from('transactions')
          .select('created_at,harga')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(offset, offset + PAGE - 1)
        if (error) throw error
        const rows = (data ?? []) as { created_at: string; harga: number }[]
        all.push(...rows)
        if (rows.length < PAGE) break
        offset += PAGE
        if (offset > 100000) break
      }
      // group per bulan WIB
      const map = new Map<string, number>()
      for (const r of all) {
        const k = monthKeyWIB(r.created_at)
        if (!k) continue
        map.set(k, (map.get(k) ?? 0) + (r.harga ?? 0))
      }
      const sortedKeys = Array.from(map.keys()).sort()
      const points = sortedKeys.map((k) => ({ date: k, total: map.get(k) ?? 0 }))
      return { points, all }
    },
  })
}
