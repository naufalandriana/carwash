'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/Store'

export default function LoginPage() {
  const router = useRouter()
  const { user, authenticateAdmin, error, clearError } = useAppStore()

  const [showAdminForm, setShowAdminForm] = useState(false)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // Kalau udah login, langsung ke halaman utama
  useEffect(() => {
    if (user) {
      router.push('/')
    }
  }, [user, router])

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await authenticateAdmin(password)
      router.push('/')
    } catch (err) {
      console.error('Login error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleGuestLogin = async () => {
    setLoading(true)
    try {
      // Set cookie session dulu lewat API (buat middleware)
      await fetch('/api/auth/guest', { method: 'POST' })
      // Baru update Zustand store (buat UI)
      useAppStore.getState().login({ role: 'guest', name: 'Guest User' })
      router.push('/')
    } catch (err) {
      console.error('Guest login error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    setShowAdminForm(false)
    clearError()
    setPassword('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-lg">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-white text-2xl icon-fill">
              water_drop
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-on-surface">Cahaya Steam</h1>
          <p className="text-sm text-on-surface-variant">
            {showAdminForm ? 'Masukkan password admin' : 'Pilih peran untuk login'}
          </p>
        </div>

        {!showAdminForm ? (
          // ── Role Selection ──
          <div className="space-y-3">
            <button
              onClick={() => setShowAdminForm(true)}
              className="w-full h-14 bg-primary text-white rounded-xl font-semibold text-base shadow-md shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[22px]">admin_panel_settings</span>
              Login sebagai Admin
            </button>

            <button
              onClick={handleGuestLogin}
              disabled={loading}
              className="w-full h-14 bg-surface-container border-2 border-outline-variant text-on-surface rounded-xl font-semibold text-base hover:bg-surface-container-high transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-on-surface border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span className="material-symbols-outlined text-[22px]">visibility</span>
                  Login sebagai Guest
                </>
              )}
            </button>
          </div>
        ) : (
          // ── Password Form ──
          <form onSubmit={handleAdminLogin} className="space-y-4">
            {error && (
              <div className="p-3 bg-error/10 border border-error rounded-lg text-error text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-on-surface mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  clearError()
                }}
                placeholder="Masukkan password"
                disabled={loading}
                autoComplete="current-password"
                autoFocus
                className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-lg text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full h-14 bg-primary text-white rounded-xl font-semibold text-base shadow-md shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Sedang login...
                </>
              ) : (
                'Login'
              )}
            </button>

            <button
              type="button"
              onClick={handleBack}
              disabled={loading}
              className="w-full h-12 bg-transparent text-primary rounded-xl font-semibold text-base hover:bg-primary/5 transition-colors disabled:opacity-50"
            >
              Kembali
            </button>
          </form>
        )}
      </div>
    </div>
  )
}