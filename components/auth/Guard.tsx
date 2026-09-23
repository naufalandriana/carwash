'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/Store'

interface GuardProps {
  children: React.ReactNode
  allowedRoles?: ('admin' | 'guest')[]
  redirectTo?: string
}

export default function Guard({ children, allowedRoles, redirectTo = '/login' }: GuardProps) {
  const router = useRouter()
  const user = useUser()
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Kasih waktu 300ms buat store hydrate dari localStorage
    const timer = setTimeout(() => {
      setIsReady(true)
    }, 300)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!isReady) return

    // Cek dari store dulu, kalo ga ada cek localStorage langsung
    let currentUser = user
    if (!currentUser && typeof window !== 'undefined') {
      const stored = localStorage.getItem('otowash_user')
      if (stored) {
        try {
          currentUser = JSON.parse(stored)
        } catch (e) {}
      }
    }

    if (!currentUser) {
      router.push(redirectTo)
      return
    }

    if (allowedRoles && !allowedRoles.includes(currentUser.role as 'admin' | 'guest')) {
      router.push('/')
    }
  }, [isReady, user, allowedRoles, redirectTo, router])

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Setelah ready, cek sekali lagi
  let currentUser = user
  if (!currentUser && typeof window !== 'undefined') {
    const stored = localStorage.getItem('otowash_user')
    if (stored) {
      try {
        currentUser = JSON.parse(stored)
      } catch (e) {}
    }
  }

  if (!currentUser) return null
  if (allowedRoles && !allowedRoles.includes(currentUser.role as 'admin' | 'guest')) return null

  return <>{children}</>
}