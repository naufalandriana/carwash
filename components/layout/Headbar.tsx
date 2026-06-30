'use client'

import { useEffect, useRef, useState } from 'react'
import { useAppStore, useUser } from '@/lib/Store'

interface HeadbarProps {
  onMenuClick: () => void
}

export default function Headbar({ onMenuClick }: HeadbarProps) {
  const user = useUser()
  const { logout } = useAppStore()
  const [showDropdown, setShowDropdown] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Tutup dropdown kalau klik di luar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    if (loggingOut) return
    setLoggingOut(true)
    setShowDropdown(false)

    // 1. Bersihkan state Zustand
    logout()

    // 2. Bersihkan localStorage & sessionStorage
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch {
      // ignore
    }

    // 3. Hard redirect ke login
    window.location.href = '/login'
  }

  // Ambil inisial dari user.name
  const getInitials = () => {
    if (!user) return '?'
    if (user.name) {
      const names = user.name.split(' ')
      if (names.length >= 2) {
        return (names[0][0] + names[1][0]).toUpperCase()
      }
      return user.name.slice(0, 2).toUpperCase()
    }
    return user.role === 'admin' ? 'AD' : 'GU'
  }

  // Label untuk tampilan di dropdown
  const getDisplayName = () => {
    if (!user) return 'User'
    return user.name || (user.role === 'admin' ? 'Administrator' : 'Guest')
  }

  return (
    <header className="h-14 sticky top-0 bg-surface-container-lowest border-b border-outline-variant flex items-center z-40 px-4">
      <div className="w-full flex justify-between items-center">
        {/* Kiri: menu + logo tumpuk */}
        <div className="flex items-center gap-2">
          <button
            onClick={onMenuClick}
            className="hidden lg:flex w-9 h-9 items-center justify-center rounded-full hover:bg-surface-container active:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-on-surface-variant text-[22px]">menu</span>
          </button>

          {/* Logo + Teks Tumpuk */}
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0">
              <img src="../../favicon.ico" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-black text-[16px] text-primary tracking-tight leading-none">
                Cahaya
              </span>
              <span className="font-medium text-[10px] text-on-surface-variant tracking-wide leading-none mt-0.5">
                Car &amp; Bike Wash
              </span>
            </div>
          </div>
        </div>

        {/* Kanan: notifikasi + profil modern */}
        <div className="flex items-center gap-2">
          {/* Notifikasi */}
          <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors relative">
            <span className="material-symbols-outlined text-on-surface-variant text-[22px]">notifications</span>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full border-2 border-white"></span>
          </button>

          {/* Avatar + dropdown modern */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(v => !v)}
              className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full hover:bg-surface-container active:bg-surface-container-high transition-all duration-200"
            >
              {/* Avatar dengan inisial */}
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shadow-sm">
                {getInitials()}
              </div>
              {/* Panah kecil ke bawah */}
              <span
                className={`material-symbols-outlined text-on-surface-variant text-[20px] transition-transform duration-200 ${
                  showDropdown ? 'rotate-180' : ''
                }`}
              >
                expand_more
              </span>
            </button>

            {/* Dropdown animasi */}
            <div
              className={`absolute right-0 mt-2 w-56 origin-top-right transition-all duration-200 ease-out ${
                showDropdown
                  ? 'opacity-100 scale-100 translate-y-0 visible'
                  : 'opacity-0 scale-95 -translate-y-1 invisible'
              }`}
            >
              <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-lg overflow-hidden">
                {/* Header profil */}
                <div className="px-4 pt-4 pb-3 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center text-white text-base font-bold shadow-md">
                    {getInitials()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">
                      {getDisplayName()}
                    </p>
                    <p className="text-xs text-on-surface-variant capitalize mt-0.5">
                      {user?.role}
                    </p>
                  </div>
                </div>
                {/* Garis pemisah */}
                <div className="border-t border-outline-variant" />
                {/* Tombol logout */}
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-error hover:bg-error-container/20 active:bg-error-container/40 transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[20px]">logout</span>
                  {loggingOut ? 'Logging out...' : 'Logout'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}