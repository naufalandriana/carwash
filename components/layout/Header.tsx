'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useUser } from '@/lib/Store'
import { useLogout } from '@/lib/useLogout'
import { getPageMeta } from '@/lib/navigation'

interface HeaderProps {
  onMenuClick: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname()
  const user = useUser()
  const { doLogout, loggingOut } = useLogout()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const meta = getPageMeta(pathname)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ type: 'error', text: 'Semua field harus diisi' })
      return
    }
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password baru minimal 6 karakter' })
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Konfirmasi password tidak cocok' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal mengubah password')
      setMessage({ type: 'success', text: data.message || 'Password berhasil diubah' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => {
        setShowChangePassword(false)
        setMessage(null)
      }, 1800)
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Terjadi kesalahan' })
    } finally {
      setLoading(false)
    }
  }

  const getInitials = () => {
    if (!user) return '?'
    if (user.name) {
      const p = user.name.split(' ')
      if (p.length >= 2) return (p[0][0] + p[1][0]).toUpperCase()
      return user.name.slice(0, 2).toUpperCase()
    }
    return user.role === 'admin' ? 'AD' : 'GU'
  }
  const getDisplayName = () => {
    if (!user) return 'User'
    return user.name || (user.role === 'admin' ? 'Administrator' : 'Guest')
  }

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-40 h-14 lg:h-16 flex items-center border-b border-outline-variant/30 bg-surface-container-lowest/80 backdrop-blur-xl supports-[backdrop-filter]:bg-surface-container-lowest/70">
        {/* inner container matches main content: same max-w + px so logo vs page body align, plus vertical center */}
        <div className="w-full max-w-[1600px] mx-auto px-4 lg:px-6 xl:px-8 2xl:px-10 flex items-center justify-between gap-4 min-w-0 h-full">
          {/* Left — hamburger (mobile) + brand + title/breadcrumb */}
          <div className="flex items-center gap-3 min-w-0 h-full">
            <button
              onClick={onMenuClick}
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-container active:bg-surface-container-high transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Buka menu"
            >
              <span className="material-symbols-outlined text-on-surface-variant text-[22px]" aria-hidden>menu</span>
            </button>
            {/* Brand — always visible */}
            <div className="flex items-center gap-2.5 min-w-0 h-9">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                <img src="/favicon.ico" alt="Logo" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col justify-center leading-tight min-w-0 hidden min-[360px]:flex">
                <span className="font-black text-[15px] text-primary tracking-tight leading-none truncate">Cahaya Steam</span>
                <span className="font-medium text-[10px] text-on-surface-variant leading-none mt-0.5 truncate">Car &amp; Bike Wash</span>
              </div>
            </div>
            {/* Desktop — title di atas, breadcrumb bawah:  Home > Kendaraan  */}
            <div className="hidden lg:flex flex-col justify-center min-w-0 h-full ml-3 pl-5 border-l border-outline-variant/30">
              <h1 className="text-[15px] font-bold text-on-surface leading-none truncate">{meta.title}</h1>
              <nav className="flex items-center gap-1 text-[11px] leading-none mt-1" aria-label="Breadcrumb">
                {meta.breadcrumb.map((b, i) => (
                  <span key={b} className="flex items-center gap-1">
                    {i > 0 && <span className="text-outline-variant mx-0.5" aria-hidden>›</span>}
                    <span className={i === meta.breadcrumb.length - 1 ? 'text-on-surface-variant font-semibold' : 'text-on-surface-variant/60'}>{b}</span>
                  </span>
                ))}
              </nav>
            </div>
          </div>

          {/* Right — notifications + avatar. Pengeluaran / desktop nav now in sidebar sections, not header. */}
          <div className="flex items-center gap-1 lg:gap-2 shrink-0">
            {/* Desktop: collapse handled by Sidebar toggle in layout; header keeps clean */}
            <button
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors relative"
              aria-label="Notifikasi"
            >
              <span className="material-symbols-outlined text-on-surface-variant text-[22px]" aria-hidden>notifications</span>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full border-2 border-white" aria-hidden></span>
            </button>

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown((v) => !v)}
                className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full hover:bg-surface-container active:bg-surface-container-high transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Menu profil"
                aria-expanded={showDropdown}
                aria-haspopup="menu"
              >
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shadow-sm">{getInitials()}</div>
                <span className={`hidden sm:inline material-symbols-outlined text-on-surface-variant text-[18px] transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} aria-hidden>expand_more</span>
              </button>
              <div
                className={`absolute right-0 mt-2 w-56 origin-top-right transition-all duration-200 ease-out ${showDropdown ? 'opacity-100 scale-100 translate-y-0 visible' : 'opacity-0 scale-95 -translate-y-1 invisible'}`}
                role="menu"
              >
                <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-lg overflow-hidden">
                  <div className="px-4 pt-4 pb-3 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center text-white text-base font-bold shadow-md">{getInitials()}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-on-surface truncate">{getDisplayName()}</p>
                      <p className="text-xs text-on-surface-variant capitalize mt-0.5">{user?.role}</p>
                    </div>
                  </div>
                  <div className="border-t border-outline-variant" />
                  {user?.role === 'admin' && (
                    <>
                      <button
                        onClick={() => {
                          setShowDropdown(false)
                          setShowChangePassword(true)
                          setMessage(null)
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-on-surface hover:bg-surface-container/50 transition-colors focus-visible:outline-none focus-visible:bg-surface-container"
                        role="menuitem"
                      >
                        <span className="material-symbols-outlined text-[20px]" aria-hidden>lock</span> Ganti Password
                      </button>
                      <div className="border-t border-outline-variant" />
                    </>
                  )}
                  <button
                    onClick={doLogout}
                    disabled={loggingOut}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-error hover:bg-error-container/20 active:bg-error-container/40 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:bg-error-container/30"
                    role="menuitem"
                  >
                    <span className="material-symbols-outlined text-[20px]" aria-hidden>logout</span> {loggingOut ? 'Logging out...' : 'Logout'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {showChangePassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-md p-6 border border-outline-variant">
            <h2 className="text-xl font-bold text-on-surface mb-1">Ganti Password</h2>
            <p className="text-sm text-on-surface-variant mb-4">Masukkan password lama dan password baru Anda.</p>
            <form onSubmit={handleChangePassword}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-on-surface-variant mb-1">Password Saat Ini</label>
                  <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full px-3 py-2 bg-surface-container rounded-lg border border-outline-variant focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-on-surface" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface-variant mb-1">Password Baru</label>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-2 bg-surface-container rounded-lg border border-outline-variant focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-on-surface" required minLength={6} />
                  <p className="text-xs text-on-surface-variant mt-1">Minimal 6 karakter</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface-variant mb-1">Konfirmasi Password Baru</label>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 bg-surface-container rounded-lg border border-outline-variant focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-on-surface" required />
                </div>
                {message && <div className={`text-sm p-2 rounded-lg ${message.type === 'success' ? 'bg-success-container text-on-success-container' : 'bg-error-container text-on-error-container'}`}>{message.text}</div>}
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => { setShowChangePassword(false); setMessage(null); setCurrentPassword(''); setNewPassword(''); setConfirmPassword('') }} className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" disabled={loading}>Batal</button>
                  <button type="submit" disabled={loading} className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"> {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />} {loading ? 'Menyimpan...' : 'Simpan'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
