'use client'

import { useEffect, useRef } from 'react'
import { useAppStore } from './Store'

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const initStore = useAppStore((s) => s.initStore)
  const subscribeRealtime = useAppStore((s) => s.subscribeRealtime)
  const didInit = useRef(false)

  useEffect(() => {
    if (didInit.current) return
    didInit.current = true
    initStore()
    const unsub = subscribeRealtime()
    return () => unsub()
  }, [initStore, subscribeRealtime])

  return <>{children}</>
}
