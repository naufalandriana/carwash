'use client'

import { useState, useCallback } from 'react'
import { useAppStore } from './Store'

export function useLogout() {
  const { logout } = useAppStore()
  const [loggingOut, setLoggingOut] = useState(false)

  const doLogout = useCallback(async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {}
    logout()
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch {}
    window.location.href = '/login'
  }, [logout, loggingOut])

  return { doLogout, loggingOut }
}
