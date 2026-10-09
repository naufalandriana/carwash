'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useMemo } from 'react'
import { useAppStore, useUser } from '@/lib/Store'
import Badge from '@/components/ui/Badge'
import Guard from '@/components/auth/Guard'
import BottomNavbar from '@/components/layout/ButtomNav'

// ─── Helpers ──────────────────────────────────────────────────────────────
function fmtRupiah(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID')
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function filterByDate(tx: { createdAt: string }, dateStr: string) {
  return tx.createdAt?.startsWith?.(dateStr) ?? false
}

function formatTimeWIB(dateStr: string): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr
  const time = date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
    hour12: false,
  })
  return `${time} WIB`
}

function getLast7Days() {
  const result: { label: string; date: string; total: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const label = d.toLocaleDateString('id-ID', { weekday: 'short' })
    result.push({ label, date: dateStr, total: 0 })
  }
  return result
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/** Poin-poin chart untuk bulan tertentu (step ~8 titik). */
function getMonthPointsFor(year: number, month: number) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const step = Math.max(1, Math.floor(daysInMonth / 8))
  const points: { label: string; date: string; total: number }[] = []
  for (let d = 1; d <= daysInMonth; d += step) {
    const dt = new Date(year, month, d)
    const dateStr = dt.toISOString().split('T')[0]
    points.push({ label: String(d), date: dateStr, total: 0 })
  }
  const last = new Date(year, month, daysInMonth)
  const lastStr = last.toISOString().split('T')[0]
  if (!points.some((p) => p.date === lastStr)) {
    points.push({ label: String(daysInMonth), date: lastStr, total: 0 })
  }
  return points
}

/** Daftar bulan yang tersedia berdasarkan transaksi (terbaru dulu). */
function getAvailableMonths(transactions: any[]): { value: string; label: string }[] {
  const set = new Set<string>()
  transactions.forEach((tx) => {
    const c = tx.createdAt
    if (!c) return
    const d = new Date(c)
    if (isNaN(d.getTime())) return
    set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  })
  return Array.from(set)
    .sort((a, b) => (a < b ? 1 : -1))
    .map((v) => {
      const [y, m] = v.split('-').map(Number)
      return { value: v, label: `${MONTH_NAMES[m - 1]} ${y}` }
    })
}

/** Poin-poin chart untuk semua data (aggregate per bulan). */
function getAllMonthsPoints(transactions: any[]) {
  if (transactions.length === 0) return []
  const dates = transactions
    .map((tx) => new Date(tx.createdAt))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())
  if (dates.length === 0) return []

  const oldest = dates[0]
  const newest = dates[dates.length - 1]
  const points: { label: string; date: string; total: number }[] = []
  let y = oldest.getFullYear()
  let m = oldest.getMonth()
  const endY = newest.getFullYear()
  const endM = newest.getMonth()
  let guard = 0
  while ((y < endY || (y === endY && m <= endM)) && guard < 120) {
    const dt = new Date(y, m, 1)
    const label = MONTH_SHORT[m]
    // kita pakai format YYYY-MM sebagai "date" agar mudah di-aggregate
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}`
    points.push({ label, date: dateStr, total: 0 })
    m++
    if (m > 11) { m = 0; y++ }
    guard++
  }
  return points
}

// ─── Chart Component ──────────────────────────────────────────────────────
interface ChartDataset {
  labels: string[]
  values: number[]
  dates: string[]
  /** true → semua value 0 / kosong */
  isEmpty?: boolean
}

function TrendChart({ dataset }: { dataset: ChartDataset }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState<number | null>(null)

  const vals = dataset.values
  const safeVals = vals.length > 0 ? vals : [0]
  const peakI = safeVals.indexOf(Math.max(...safeVals))
  const displayIndex = hovered ?? peakI
  const displayVal = fmtRupiah(safeVals[displayIndex] ?? 0)
  const displayDate =
    (dataset.dates[displayIndex] ?? '') +
    (displayIndex === peakI && (safeVals[displayIndex] ?? 0) > 0 ? ' — pendapatan tertinggi' : '')

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    const draw = () => {
      const W = wrap.offsetWidth || 320
      const H = 190
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const pad = { top: 16, right: 14, bottom: 32, left: 14 }
      const cw = W - pad.left - pad.right
      const ch = H - pad.top - pad.bottom

      const dataMin = Math.min(...safeVals)
      const dataMax = Math.max(...safeVals)
      // Kalau semua 0, pakai default range biar chart gak NaN
      const minV = dataMax === 0 ? 0 : dataMin * 0.88
      const maxV = dataMax === 0 ? 1 : dataMax * 1.06
      const rangeVal = maxV - minV || 1

      const toX = (i: number) =>
        safeVals.length === 1
          ? pad.left + cw / 2
          : pad.left + (i / (safeVals.length - 1)) * cw
      const toY = (v: number) => pad.top + ch - ((v - minV) / rangeVal) * ch

      const isDark = matchMedia('(prefers-color-scheme: dark)').matches
      const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'
      const labelColor = '#898781'
      const lineColor = '#1a56f0'
      const areaTop = isDark ? 'rgba(26,86,240,0.22)' : 'rgba(26,86,240,0.13)'

      ctx.clearRect(0, 0, W, H)

      ctx.strokeStyle = gridColor
      ctx.lineWidth = 0.5
      for (let i = 0; i <= 4; i++) {
        const y = pad.top + (ch / 4) * i
        ctx.beginPath()
        ctx.moveTo(pad.left, y)
        ctx.lineTo(W - pad.right, y)
        ctx.stroke()
      }

      ctx.beginPath()
      safeVals.forEach((v, i) => {
        const x = toX(i)
        const y = toY(v)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.lineTo(toX(safeVals.length - 1), pad.top + ch)
      ctx.lineTo(toX(0), pad.top + ch)
      ctx.closePath()
      const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch)
      gradient.addColorStop(0, areaTop)
      gradient.addColorStop(1, 'rgba(26,86,240,0)')
      ctx.fillStyle = gradient
      ctx.fill()

      ctx.beginPath()
      safeVals.forEach((v, i) => {
        const x = toX(i)
        const y = toY(v)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.strokeStyle = lineColor
      ctx.lineWidth = 2
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.stroke()

      ctx.fillStyle = labelColor
      ctx.font = '10px system-ui, sans-serif'
      ctx.textAlign = 'center'

      // Kalau titik > 12, tampilkan label setiap 2 titik biar gak numpuk
      const labelStep = dataset.labels.length > 12 ? 2 : 1
      dataset.labels.forEach((lbl, i) => {
        if (i % labelStep !== 0 && i !== dataset.labels.length - 1) return
        ctx.fillText(lbl, toX(i), H - 8)
      })

      const dotI = hovered ?? peakI
      ctx.beginPath()
      ctx.arc(toX(dotI), toY(safeVals[dotI]), 4, 0, Math.PI * 2)
      ctx.fillStyle = lineColor
      ctx.fill()
      ctx.beginPath()
      ctx.arc(toX(dotI), toY(safeVals[dotI]), 7, 0, Math.PI * 2)
      ctx.strokeStyle = lineColor
      ctx.lineWidth = 1.5
      ctx.stroke()

      if (hovered !== null) {
        ctx.beginPath()
        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'
        ctx.lineWidth = 1
        ctx.setLineDash([3, 3])
        ctx.moveTo(toX(hovered), pad.top)
        ctx.lineTo(toX(hovered), pad.top + ch)
        ctx.stroke()
        ctx.setLineDash([])
      }

      ;(canvas as any)._toX = toX
    }

    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [dataset, hovered, safeVals, peakI])

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const toX = (canvas as any)._toX as ((i: number) => number) | undefined
    if (!toX) return

    let closest = 0
    let minDx = Infinity
    safeVals.forEach((_, i) => {
      const dx = Math.abs(toX(i) - mx)
      if (dx < minDx) { minDx = dx; closest = i }
    })
    setHovered(closest)
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-2">
        <div className="min-w-0">
          <p className="text-xl font-extrabold text-on-surface truncate">{displayVal}</p>
          <p className="text-[11px] text-on-surface-variant mt-0.5 truncate">{displayDate || 'Belum ada data'}</p>
        </div>
      </div>
      <div ref={wrapRef} className="relative w-full h-[190px]">
        <canvas
          ref={canvasRef}
          className="block"
          role="img"
          aria-label="Grafik tren pendapatan"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHovered(null)}
        />
      </div>
    </div>
  )
}

// ─── Chart Range Picker ───────────────────────────────────────────────────
type ChartRange = 'today' | 'week' | 'month' | 'all'

function ChartRangePicker({
  range, selectedMonth, availableMonths, onChangeRange, onChangeMonth,
}: {
  range: ChartRange
  selectedMonth: string
  availableMonths: { value: string; label: string }[]
  onChangeRange: (r: ChartRange) => void
  onChangeMonth: (m: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  const label = useMemo(() => {
    if (range === 'today') return 'Hari Ini'
    if (range === 'week') return '7 Hari'
    if (range === 'all') return 'Semua'
    const m = availableMonths.find((x) => x.value === selectedMonth)
    return m?.label || 'Bulan'
  }, [range, selectedMonth, availableMonths])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t)) return
      if (popRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const toggleOpen = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
    }
    setOpen((p) => !p)
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggleOpen}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-container text-on-surface-variant text-xs font-semibold hover:bg-surface-container-high transition-colors"
      >
        <span className="material-symbols-outlined text-[14px]">calendar_month</span>
        <span className="truncate max-w-[100px]">{label}</span>
        <span className="material-symbols-outlined text-[14px]">{open ? 'expand_less' : 'expand_more'}</span>
      </button>

      {open && pos && (
        <div
          ref={popRef}
          style={{ position: 'fixed', top: pos.top, right: pos.right }}
          className="z-[100] w-52 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-2xl py-1 max-h-72 overflow-y-auto"
        >
          {[
            { key: 'today' as const, label: 'Hari Ini', icon: 'today' },
            { key: 'week' as const, label: '7 Hari Terakhir', icon: 'date_range' },
            { key: 'all' as const, label: 'Semua', icon: 'all_inclusive' },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => { onChangeRange(opt.key); setOpen(false) }}
              className={`w-full flex items-center gap-2 text-left px-3 py-2 text-sm hover:bg-surface-container-highest transition-colors ${
                range === opt.key ? 'bg-primary-container text-primary font-semibold' : 'text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{opt.icon}</span>
              {opt.label}
            </button>
          ))}

          <div className="border-t border-outline-variant my-1" />
          <p className="px-3 py-1 text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">
            Pilih Bulan
          </p>
          {availableMonths.length === 0 ? (
            <p className="px-3 py-2 text-xs text-on-surface-variant">Belum ada data</p>
          ) : (
            availableMonths.map((m) => (
              <button
                key={m.value}
                onClick={() => { onChangeMonth(m.value); setOpen(false) }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-container-highest transition-colors ${
                  range === 'month' && selectedMonth === m.value
                    ? 'bg-primary-container text-primary font-semibold'
                    : 'text-on-surface'
                }`}
              >
                {m.label}
              </button>
            ))
          )}
        </div>
      )}
    </>
  )
}

// ─── Section Title ────────────────────────────────────────────────────────
function SectionTitle({ icon, label, right }: { icon: string; label: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-3">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px] text-primary">{icon}</span>
        <h4 className="text-sm font-bold text-on-surface">{label}</h4>
      </div>
      {right}
    </div>
  )
}

// ─── Dashboard Content ────────────────────────────────────────────────────
function DashboardContent() {
  const { transactions, updateTransactionStatus, expenses, loading } = useAppStore()
  const user = useUser()
  const isGuest = user?.role === 'guest'
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // ── Chart range ──
  const [range, setRange] = useState<ChartRange>('today')
  const [selectedMonth, setSelectedMonth] = useState('')

  const availableMonths = useMemo(() => getAvailableMonths(transactions), [transactions])

  // Set bulan default = bulan paling baru
  useEffect(() => {
    if (!selectedMonth && availableMonths.length > 0) {
      setSelectedMonth(availableMonths[0].value)
    }
  }, [availableMonths, selectedMonth])

  // ── Hitung total pengeluaran hari ini ──────────────────────────────
  const todayExpenses = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    return expenses
      .filter((e) => {
        const d = new Date(e.created_at)
        return d >= start && d < end
      })
      .reduce((sum, e) => sum + e.nominal, 0)
  }, [expenses])

  const recentExpenses = useMemo(() => expenses.slice(0, 3), [expenses])

  const handleFinish = async (id: string) => {
    if (isGuest) return
    setUpdatingId(id)
    try {
      await updateTransactionStatus(id, 'Selesai')
    } catch (err) {
      console.error(err)
    } finally {
      setUpdatingId(null)
    }
  }

  const userName = user?.name || user?.role || 'User'
  const greeting = userName === 'User' ? 'User' : userName
  const now = new Date()
  const dayName = now.toLocaleDateString('id-ID', { weekday: 'long' })
  const dateFormatted = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

  const today = todayStr()
  const todayTxs = transactions.filter((tx) => filterByDate(tx as any, today))
  const todayRevenue = todayTxs.reduce((sum, tx) => sum + tx.harga, 0)
  const todayCount = todayTxs.length

  const queueTxs = transactions
    .filter((tx) => tx.status === 'Proses')
    .sort((a, b) => new Date((b as any).createdAt).getTime() - new Date((a as any).createdAt).getTime())
    .slice(0, 3)

  // ── Chart datasets ─────────────────────────────────────────────────
  // Today (per jam 00-23)
  const todayPoints = Array.from({ length: 24 }, (_, i) => ({
    label: `${i.toString().padStart(2, '0')}`,
    hour: i,
    total: 0,
  }))
  transactions.forEach((tx) => {
    const createdAt = (tx as any).createdAt
    if (!createdAt) return
    const date = new Date(createdAt)
    const now = new Date()
    if (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    ) {
      todayPoints[date.getHours()].total += tx.harga
    }
  })
  const todayDataset: ChartDataset = {
    labels: todayPoints.map((p) => p.label),
    values: todayPoints.map((p) => p.total),
    dates: todayPoints.map((p) => `${p.hour.toString().padStart(2, '0')}:00`),
  }

  // Week
  const weekPoints = getLast7Days()
  transactions.forEach((tx) => {
    const txDate = (tx as any).createdAt?.split('T')[0]
    if (!txDate) return
    const point = weekPoints.find((p) => p.date === txDate)
    if (point) point.total += tx.harga
  })
  const weekDataset: ChartDataset = {
    labels: weekPoints.map((p) => p.label),
    values: weekPoints.map((p) => p.total),
    dates: weekPoints.map((p) => p.date),
  }

  // Month (per bulan dipilih)
  const monthDataset: ChartDataset = useMemo(() => {
    if (!selectedMonth) {
      return { labels: [], values: [], dates: [] }
    }
    const [y, m] = selectedMonth.split('-').map(Number)
    const points = getMonthPointsFor(y, m - 1)
    transactions.forEach((tx) => {
      const txDate = (tx as any).createdAt?.split('T')[0]
      if (!txDate) return
      const point = points.find((p) => p.date === txDate)
      if (point) point.total += tx.harga
    })
    return {
      labels: points.map((p) => p.label),
      values: points.map((p) => p.total),
      dates: points.map((p) => p.date),
    }
  }, [transactions, selectedMonth])

  // All (aggregate per bulan)
  const allDataset: ChartDataset = useMemo(() => {
    const points = getAllMonthsPoints(transactions)
    transactions.forEach((tx) => {
      const c = (tx as any).createdAt
      if (!c) return
      const d = new Date(c)
      if (isNaN(d.getTime())) return
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const point = points.find((p) => p.date === key)
      if (point) point.total += tx.harga
    })
    return {
      labels: points.map((p) => p.label),
      values: points.map((p) => p.total),
      dates: points.map((p) => p.date),
    }
  }, [transactions])

  const dataset =
    range === 'today' ? todayDataset
      : range === 'week' ? weekDataset
        : range === 'month' ? monthDataset
          : allDataset

  // ── Aktivitas terbaru ──────────────────────────────────────────────
  const recentActivities = transactions.slice(0, 4).map((tx) => ({
    icon: tx.status === 'Selesai' ? 'check_circle' : 'autorenew',
    iconClass: tx.status === 'Selesai' ? 'text-success' : 'text-primary',
    bg: tx.status === 'Selesai' ? 'bg-success-container' : 'bg-secondary-container',
    title: `${tx.model} ${tx.status === 'Selesai' ? 'selesai' : 'diproses'}`,
    type: tx.type || null,
    sub: `${formatTimeWIB((tx as any).createdAt)} · ${tx.karyawan.split(',')[0]?.trim()} · ${fmtRupiah(tx.harga)}`,
  }))

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <main className="flex-1 p-4 pb-24 space-y-4 w-full max-w-3xl mx-auto">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[22px] font-extrabold text-on-surface leading-tight">
              Halo, {greeting} 👋
            </h2>
            <p className="text-sm text-on-surface-variant font-medium mt-0.5">
              Ringkasan bisnis hari ini
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[11px] text-on-surface-variant">{dayName}</p>
            <p className="text-xs font-bold text-on-surface">{dateFormatted}</p>
          </div>
        </div>

        {/* ── 3 Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Pendapatan */}
          <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80 rounded-2xl p-4 text-white shadow-lg shadow-primary/20">
            <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10" />
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-white text-[18px] icon-fill">
                  account_balance_wallet
                </span>
              </div>
              <p className="text-[10px] text-white/70 font-bold uppercase tracking-wider">
                Pendapatan hari ini
              </p>
              <h3 className="text-xl font-extrabold mt-0.5">{fmtRupiah(todayRevenue)}</h3>
              <p className="text-[11px] text-white/60 mt-1">
                {todayCount} transaksi
              </p>
            </div>
          </div>

          {/* Kendaraan */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
            <div className="w-9 h-9 rounded-xl bg-secondary-container flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-primary text-[18px] icon-fill">
                directions_car
              </span>
            </div>
            <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
              Kendaraan
            </p>
            <h3 className="text-xl font-extrabold mt-0.5 text-on-surface">{todayCount}</h3>
            <p className="text-[11px] text-on-surface-variant mt-1">
              Dicuci hari ini
            </p>
          </div>

          {/* Pengeluaran */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 flex flex-col">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-error-container flex items-center justify-center">
                <span className="material-symbols-outlined text-error text-[18px] icon-fill">
                  trending_down
                </span>
              </div>
              <Link
                href="/Pengeluaran"
                className="w-7 h-7 rounded-lg bg-error-container flex items-center justify-center hover:bg-error/20 transition-colors"
                aria-label="Tambah pengeluaran"
              >
                <span className="material-symbols-outlined text-error text-[16px]">add</span>
              </Link>
            </div>

            <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
              Pengeluaran hari ini
            </p>
            <h3 className="text-xl font-extrabold mt-0.5 text-error">
              {loading.expenses ? '...' : fmtRupiah(todayExpenses)}
            </h3>

            <div className="mt-3 space-y-2 flex-1">
              {loading.expenses ? (
                <p className="text-xs text-on-surface-variant">Memuat...</p>
              ) : recentExpenses.length === 0 ? (
                <p className="text-xs text-on-surface-variant">Belum ada pengeluaran</p>
              ) : (
                recentExpenses.map((exp) => (
                  <div key={exp.id} className="flex justify-between items-start text-xs gap-2">
                    <div className="min-w-0">
                      <p className="text-on-surface truncate font-medium">
                        {exp.nama_pengeluaran}
                      </p>
                      <p className="text-[10px] text-on-surface-variant">
                        {new Date(exp.created_at).toLocaleDateString('id-ID', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </p>
                    </div>
                    <span className="font-semibold text-error whitespace-nowrap text-[11px]">
                      Rp {exp.nominal.toLocaleString('id-ID')}
                    </span>
                  </div>
                ))
              )}
            </div>
            <Link
              href="/Pengeluaran"
              className="mt-3 text-center text-[11px] font-bold text-error hover:underline"
            >
              Lihat semua →
            </Link>
          </div>
        </div>

        {/* ── Antrian & Chart ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Antrian */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
            <SectionTitle
              icon="pending_actions"
              label="Antrian Aktif"
              right={
                !isGuest ? (
                  <Link href="/Transaksi" className="text-xs font-semibold text-primary flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[14px]">add</span>
                    Tambah
                  </Link>
                ) : (
                  <span className="text-[11px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full font-semibold">
                    {queueTxs.length} item
                  </span>
                )
              }
            />
            <div className="divide-y divide-outline-variant/50">
              {queueTxs.length === 0 ? (
                <div className="text-center py-6">
                  <span className="material-symbols-outlined text-[32px] text-on-surface-variant/40">
                    task_alt
                  </span>
                  <p className="text-xs text-on-surface-variant mt-1">Tidak ada antrian</p>
                </div>
              ) : (
                queueTxs.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                        tx.tipe === 'mobil' ? 'bg-secondary-container' : 'bg-error-container'
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-[17px] icon-fill ${
                          tx.tipe === 'mobil' ? 'text-primary' : 'text-error'
                        }`}
                      >
                        {tx.tipe === 'mobil' ? 'directions_car' : 'motorcycle'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-on-surface truncate">
                        {tx.plat} · {tx.model}
                      </p>
                      {tx.type && <p className="text-[11px] text-primary font-medium truncate">· {tx.type}</p>}
                      <p className="text-[11px] text-on-surface-variant truncate">
                        {tx.karyawan.split(',')[0]?.trim()} · {formatTimeWIB((tx as any).createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge status={tx.status} />
                      {!isGuest && (
                        <button
                          onClick={() => handleFinish(tx.id)}
                          disabled={updatingId === tx.id}
                          className="w-7 h-7 flex items-center justify-center rounded-full bg-primary hover:bg-primary/90 active:scale-90 transition-all disabled:opacity-50"
                          title="Tandai selesai"
                        >
                          {updatingId === tx.id ? (
                            <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          ) : (
                            <span className="material-symbols-outlined text-white text-[14px]">
                              arrow_forward_ios
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Chart */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
            <SectionTitle
              icon="trending_up"
              label="Tren Pendapatan"
              right={
                <ChartRangePicker
                  range={range}
                  selectedMonth={selectedMonth}
                  availableMonths={availableMonths}
                  onChangeRange={setRange}
                  onChangeMonth={(m) => {
                    setSelectedMonth(m)
                    setRange('month')
                  }}
                />
              }
            />
            <TrendChart dataset={dataset} />
          </div>
        </div>

        {/* ── Aktivitas terbaru ── */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
          <SectionTitle
            icon="history"
            label="Aktivitas Terbaru"
            right={
              <Link href="/Laporan" className="text-xs font-semibold text-primary">
                Lihat semua
              </Link>
            }
          />
          <div className="divide-y divide-outline-variant/50">
            {recentActivities.length === 0 ? (
              <div className="text-center py-6">
                <span className="material-symbols-outlined text-[32px] text-on-surface-variant/40">
                  inbox
                </span>
                <p className="text-xs text-on-surface-variant mt-1">Belum ada aktivitas</p>
              </div>
            ) : (
              recentActivities.map((act, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${act.bg}`}>
                    <span className={`material-symbols-outlined text-[17px] icon-fill ${act.iconClass}`}>
                      {act.icon}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-on-surface truncate">{act.title}</p>
                    {act.type && <p className="text-[11px] text-primary font-medium truncate">· {act.type}</p>}
                    <p className="text-[11px] text-on-surface-variant truncate">{act.sub}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
      <BottomNavbar />
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Guard>
      <DashboardContent />
    </Guard>
  )
}