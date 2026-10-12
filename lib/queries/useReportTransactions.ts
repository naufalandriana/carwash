'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/Supabase'
import { qk } from './keys'
import { toAppTransaction } from './helpers'

export function useReportTransactions(from?: string, to?: string) {
  return useQuery({
    queryKey: qk.reportTransactions(from, to),
    staleTime: 45 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      const PAGE = 1000
      const all: unknown[] = []
      let offset = 0
      const gte = from ? `${from}T00:00:00+07:00` : null
      const lte = to ? `${to}T23:59:59.999+07:00` : null

      for (;;) {
        let q = supabase
          .from('transactions')
          .select('id,plat,model,type,karyawan,layanan,bayar,harga,status,tipe,created_at')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(offset, offset + PAGE - 1)
        if (gte) q = q.gte('created_at', gte)
        if (lte) q = q.lte('created_at', lte)
        const { data, error } = await q
        if (error) throw error
        const rows = (data ?? []) as unknown[]
        all.push(...rows)
        if (rows.length < PAGE) break
        offset += PAGE
        if (offset > 200000) break
      }
      return (all as never[]).map(toAppTransaction)
    },
  })
}
