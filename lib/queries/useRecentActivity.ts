'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/Supabase'
import { qk } from './keys'
import { toAppTransaction } from './helpers'

export function useRecentActivity() {
  return useQuery({
    queryKey: qk.recentActivity(),
    staleTime: 20 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('id,plat,model,type,karyawan,layanan,bayar,harga,status,tipe,created_at')
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return (data ?? []).map((r) => toAppTransaction(r as never))
    },
  })
}
