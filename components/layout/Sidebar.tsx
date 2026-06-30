'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser } from '@/lib/Store'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const user = useUser()
  const isRestricted = user?.role === 'guest'

  const allNavItems = [
    { href: '/', label: 'Dashboard', icon: 'dashboard' },
    { href: '/Kendaraan', label: 'Kendaraan', icon: 'directions_car' },
    { href: '/Transaksi', label: 'Transaksi', icon: 'receipt_long' },
    { href: '/Laporan', label: 'Laporan', icon: 'assessment' },
    { href: '/Karyawan', label: 'Karyawan', icon: 'people' },
  ]

  const navItems = isRestricted
    ? allNavItems.filter(item => item.href === '/' || item.href === '/Transaksi')
    : allNavItems

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className={`fixed top-0 left-0 h-full w-72 bg-surface-container-lowest shadow-xl z-50 transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-outline-variant">
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-white text-[15px] icon-fill">water_drop</span>
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
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container">
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </div>
        <nav className="flex flex-col gap-1 p-4">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                pathname === item.href
                  ? 'bg-primary-container text-primary'
                  : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  )
}