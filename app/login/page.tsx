'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/Store'

export default function LoginPage() {
  const router = useRouter()
  const { login, user } = useAppStore()

  // Kalau udah login, langsung ke halaman utama
  useEffect(() => {
    if (user) {
      router.push('/')
    }
  }, [user, router])

  const handleLogin = (role: 'admin' | 'guest') => {
    const name = role === 'admin' ? 'Administrator' : 'Guest User'
    login({ role, name })
    router.push('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-lg">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-white text-2xl icon-fill">water_drop</span>
          </div>
          <h1 className="text-2xl font-extrabold text-on-surface">Cahaya Steam</h1>
          <p className="text-sm text-on-surface-variant">Pilih peran untuk login</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => handleLogin('admin')}
            className="w-full h-14 bg-primary text-white rounded-xl font-semibold text-base shadow-md shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[22px]">admin_panel_settings</span>
            Login sebagai Admin
          </button>

          <button
            onClick={() => handleLogin('guest')}
            className="w-full h-14 bg-surface-container border-2 border-outline-variant text-on-surface rounded-xl font-semibold text-base hover:bg-surface-container-high transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[22px]">visibility</span>
            Login sebagai Guest
          </button>
        </div>
      </div>
    </div>
  )
}