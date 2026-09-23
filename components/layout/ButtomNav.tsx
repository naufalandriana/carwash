'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/', label: 'Beranda', icon: 'dashboard' },
  { href: '/Kendaraan', label: 'Kendaraan', icon: 'directions_car' },
  { href: '/Transaksi', label: 'Input', icon: 'add_circle' }, // di tengah
  { href: '/Laporan', label: 'Laporan', icon: 'assessment' },
  { href: '/Karyawan', label: 'Karyawan', icon: 'badge' },
]

export default function BottomNav() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    const base = href.split('?')[0]
    if (base === '/') return pathname === '/'
    return pathname.startsWith(base)
  }

  return (
    // Pil penuh – fixed di tengah bawah, hanya muncul di mobile (md:hidden)
    <nav className="md:hidden fixed z-40 bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-lg h-16 bg-surface-container-lowest border border-outline-variant rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.08)] backdrop-blur-sm">
      <div className="grid h-full grid-cols-5 mx-auto">
        {navItems.map((item) => {
          // Tombol Input – di kolom tengah, bikin melingkar lebih besar
          if (item.label === 'Input') {
            const active = isActive(item.href)
            return (
              <div key={item.href} className="flex items-center justify-center">
                <Link
                  href={item.href}
                  className={`w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30 transition-all ${
                    active ? 'scale-110 ring-4 ring-primary/20' : 'hover:scale-105 active:scale-95'
                  }`}
                >
                  <span className="material-symbols-outlined text-white text-[28px] icon-fill">
                    {item.icon}
                  </span>
                  <span className="sr-only">{item.label}</span>
                </Link>
              </div>
            )
          }

          // Tombol biasa (ikon doang, tanpa teks)
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-center transition-colors ${
                active ? 'text-primary' : 'text-on-surface-variant'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[26px] ${
                  active ? 'icon-fill' : ''
                }`}
              >
                {item.icon}
              </span>
              <span className="sr-only">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}