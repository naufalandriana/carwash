'use client'

export type NavItem = {
  href: string
  label: string
  shortLabel?: string
  icon: string
  mobileIcon?: string
  section: string
  roles?: ('admin' | 'guest')[]
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', shortLabel: 'Beranda', icon: 'dashboard', section: 'Utama' },
  { href: '/Transaksi', label: 'Transaksi', shortLabel: 'Input', icon: 'receipt_long', mobileIcon: 'add_circle', section: 'Utama' },
  { href: '/Kendaraan', label: 'Kendaraan', icon: 'directions_car', section: 'Data Master', roles: ['admin'] },
  { href: '/Karyawan', label: 'Karyawan', icon: 'people', mobileIcon: 'badge', section: 'Data Master', roles: ['admin'] },
  { href: '/Laporan', label: 'Laporan', icon: 'assessment', section: 'Keuangan', roles: ['admin'] },
  { href: '/Pengeluaran', label: 'Pengeluaran', icon: 'payments', section: 'Keuangan', roles: ['admin'] },
]

export function isActiveRoute(pathname: string | null, href: string): boolean {
  if (!pathname) return false
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(href + '/')
}

export function getFilteredNavItems(role?: string | null): NavItem[] {
  if (role === 'guest') {
    return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes('guest'))
  }
  return NAV_ITEMS
}

export function getGroupedNav(role?: string | null): Record<string, NavItem[]> {
  const filtered = getFilteredNavItems(role)
  const groups: Record<string, NavItem[]> = {}
  for (const item of filtered) {
    if (!groups[item.section]) groups[item.section] = []
    groups[item.section].push(item)
  }
  return groups
}

export function getPageMeta(pathname: string | null): { title: string; breadcrumb: string[] } {
  if (!pathname || pathname === '/') return { title: 'Dashboard', breadcrumb: ['Home'] }
  const item = NAV_ITEMS.find((n) => pathname === n.href || pathname.startsWith(n.href + '/'))
  if (item) return { title: item.label, breadcrumb: ['Home', item.label] }
  const seg = pathname.split('/').filter(Boolean).pop() || 'Halaman'
  const title = seg.charAt(0).toUpperCase() + seg.slice(1)
  return { title, breadcrumb: ['Home', title] }
}
