'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS, isActiveRoute } from '@/lib/navigation'

// Bottom pill: visual preserved, items derived from shared config (order: Dashboard, Kendaraan, Input(Transaksi), Laporan, Karyawan)
const BOTTOM_ORDER = ['/', '/Kendaraan', '/Transaksi', '/Laporan', '/Karyawan']
const bottomItems = BOTTOM_ORDER.map((href) => NAV_ITEMS.find((n) => n.href === href)!).filter(Boolean)

export default function BottomNav() {
  const pathname = usePathname()

  return (
    // Pil penuh – fixed di tengah bawah, hanya muncul di mobile (md:hidden)
    <nav className="md:hidden fixed z-40 bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-lg h-16 bg-surface-container-lowest border border-outline-variant rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.08)] backdrop-blur-sm">
      <div className="grid h-full grid-cols-5 mx-auto">
        {bottomItems.map((item) => {
          const isInput = item.href === '/Transaksi'
          if (isInput) {
            const active = isActiveRoute(pathname, item.href)
            return (
              <div key={item.href} className="flex items-center justify-center">
                <Link
                  href={item.href}
                  className={`w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30 transition-all ${
                    active ? 'scale-110 ring-4 ring-primary/20' : 'hover:scale-105 active:scale-95'
                  }`}
                >
                  <span className="material-symbols-outlined text-white text-[28px] icon-fill" aria-hidden>
                    {item.mobileIcon || item.icon}
                  </span>
                  <span className="sr-only">{item.shortLabel || item.label}</span>
                </Link>
              </div>
            )
          }

          const active = isActiveRoute(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-center transition-colors ${active ? 'text-primary' : 'text-on-surface-variant'}`}
            >
              <span className={`material-symbols-outlined text-[26px] ${active ? 'icon-fill' : ''}`} aria-hidden>
                {item.mobileIcon || item.icon}
              </span>
              <span className="sr-only">{item.shortLabel || item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}