'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/Supabase'
import { qk } from '@/lib/queries/keys'

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const subscribedRef = useRef(false)

  useEffect(() => {
    if (subscribedRef.current) return
    subscribedRef.current = true

    const debouncedInvalidate = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        qc.invalidateQueries({ queryKey: qk.dashboardSummary() })
        qc.invalidateQueries({ queryKey: qk.queue() })
        qc.invalidateQueries({ queryKey: qk.recentActivity() })
        qc.invalidateQueries({ queryKey: qk.expenses() })
        // report & monthly are heavy; only invalidate if active (stale will refetch on focus)
        qc.invalidateQueries({ queryKey: ['report-transactions'] })
      }, 700)
    }

    const ch = supabase
      .channel('otowash-realtime-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, debouncedInvalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, debouncedInvalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, () => qc.invalidateQueries({ queryKey: qk.staff() }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, () => qc.invalidateQueries({ queryKey: qk.vehicles() }))
      .subscribe()
    channelRef.current = ch

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      channelRef.current = null
      subscribedRef.current = false
    }
  }, [qc])

  return <>{children}</>
}
