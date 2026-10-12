'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser } from '@/lib/Store'
import { getGroupedNav, isActiveRoute } from '@/lib/navigation'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/queries/keys'

interface SidebarProps {
  open: boolean
  onClose: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export default function Sidebar({ open, onClose, collapsed = false, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname()
  const user = useUser()
  const grouped = getGroupedNav(user?.role)
  const qc = useQueryClient()
  const prefetch = (href: string) => {
    if (href === '/Laporan') qc.prefetchQuery({ queryKey: qk.reportTransactions(undefined, undefined) })
    if (href === '/Pengeluaran') qc.prefetchQuery({ queryKey: qk.expenses() })
    if (href === '/') {
      qc.prefetchQuery({ queryKey: qk.dashboardSummary() })
      qc.prefetchQuery({ queryKey: qk.queue() })
    }
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 lg:hidden ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
        aria-hidden
      />
      {/* aside: no overflow-hidden — button -right-3 won't clip. Only width animates. */}
      <aside
        className={`fixed top-0 lg:top-16 bottom-0 bg-surface-container-lowest border-r border-outline-variant/20 z-50 lg:z-30 flex flex-col lg:shrink-0
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${collapsed ? 'w-72 lg:w-[72px]' : 'w-72 lg:w-64'}
          lg:shadow-none shadow-xl transition-[width] duration-300 ease-in-out`}
        aria-label="Sidebar"
      >
        {/* Rail handle — tengah tinggi, setengah keluar */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 items-center justify-center rounded-full border border-outline-variant/30 bg-surface-container-lowest shadow-sm hover:shadow hover:border-outline-variant text-on-surface-variant hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand' : 'Ciutkan'}
          >
            <span className={`material-symbols-outlined text-[16px] transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} aria-hidden>
              chevron_left
            </span>
          </button>
        )}

        {/* Mobile close — desktop no header here */}
        <div className="flex lg:hidden items-center justify-end px-3 h-10 shrink-0 border-b border-outline-variant/20">
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container shrink-0" aria-label="Tutup menu">
            <span className="material-symbols-outlined text-on-surface-variant" aria-hidden>close</span>
          </button>
        </div>

        {/* Scroll — overflow here, not on aside */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain hide-scrollbar">
          <div className="px-3 pt-3 pb-3">

            <nav aria-label="Main" className="space-y-4">
              {Object.entries(grouped).map(([section, items]) => (
                <div key={section}>
                  {/* Label: h-4 fixed, centered. Collapsed = divider */}
                  <div className="relative h-4 mb-1 px-2 flex items-center">
                    <p className={`absolute inset-0 flex items-center text-[10px] font-bold tracking-widest uppercase text-on-surface-variant/50 whitespace-nowrap transition-opacity duration-200 ${collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} aria-hidden={collapsed}>
                      {section}
                    </p>
                    <span className={`absolute left-2 right-2 h-px bg-outline-variant/25 transition-opacity duration-200 ${collapsed ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} aria-hidden />
                  </div>
                  <div className="space-y-0.5">
                    {items.map((item) => {
                      const active = isActiveRoute(pathname, item.href)
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={onClose}
                          onMouseEnter={() => prefetch(item.href)}
                          onTouchStart={() => prefetch(item.href)}
                          title={collapsed ? item.label : undefined}
                          aria-current={active ? 'page' : undefined}
                          className={`group relative flex items-center h-9 px-2 rounded-xl text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active ? 'bg-primary text-white shadow-sm shadow-primary/20' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface active:bg-surface-container-high'}`}
                        >
                          <span className="w-9 h-9 shrink-0 flex items-center justify-center">
                            <span className={`material-symbols-outlined text-[19px] leading-none ${active ? 'icon-fill text-white' : ''}`} aria-hidden>{item.icon}</span>
                          </span>
                          <span className={`flex-1 min-w-0 truncate whitespace-nowrap leading-none transition-opacity duration-200 ${collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>{item.label}</span>
                          {collapsed && <span className="hidden lg:group-hover:block absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 bg-on-surface text-white text-xs px-2.5 py-1 rounded-lg whitespace-nowrap pointer-events-none shadow-lg z-20">{item.label}</span>}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </div>
        {/* Theme toggle — works on mobile drawer + desktop */}
        <div className="shrink-0 border-t border-outline-variant/20 px-3 py-3">
          <div className={`flex items-center gap-2 ${collapsed ? 'justify-center' : 'justify-between'}`}>
            <span className={`text-xs font-semibold text-on-surface-variant whitespace-nowrap transition-opacity duration-200 ${collapsed ? 'hidden' : 'block'}`}>Tema</span>
            <ThemeToggle />
          </div>
        </div>
      </aside>
    </>
  )
}
