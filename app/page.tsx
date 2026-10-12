'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useUser, useAppStore } from '@/lib/Store'
import { useDashboardSummary } from '@/lib/queries/useDashboardSummary'
import { useTodayHourly } from '@/lib/queries/useTodayHourly'
import { useMonthlyRevenue } from '@/lib/queries/useMonthlyRevenue'
import { useQueue } from '@/lib/queries/useQueue'
import { useRecentActivity } from '@/lib/queries/useRecentActivity'
import { useExpensesQuery } from '@/lib/queries/useStaffVehiclesExpenses'
import Badge from '@/components/ui/Badge'
import Guard from '@/components/auth/Guard'
import { SkeletonStats, SkeletonList, SkeletonChart } from '@/components/ui/Skeleton'
import { formatTimeWIB as formatTimeWIBDate } from '@/lib/date'
import { useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/queries/keys'

function fmtRupiah(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID')
}
function getCreatedAt(tx: unknown): string {
  if (!tx || typeof tx !== 'object') return ''
  const o = tx as Record<string, unknown>
  const c = o['created_at'] ?? o['createdAt']
  if (typeof c === 'string') return c
  if (c) return String(c)
  return ''
}
function getHarga(tx: unknown): number {
  if (!tx || typeof tx !== 'object') return 0
  const v = (tx as Record<string, unknown>)['harga']
  if (typeof v === 'number' && !isNaN(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (!isNaN(n)) return n
  }
  return 0
}
function formatTimeWIB(dateStr: string): string {
  if (!dateStr) return '-'
  return formatTimeWIBDate(dateStr)
}
const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

interface ChartDataset {
  labels: string[]
  values: number[]
  dates: string[]
}

function TrendChart({ dataset }: { dataset: ChartDataset }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  const rafRef = useRef<number | null>(null)

  const vals = dataset.values
  const safeVals = useMemo(() => (vals.length > 0 ? vals : [0]), [vals])
  const peakI = useMemo(() => safeVals.indexOf(Math.max(...safeVals)), [safeVals])
  const displayIndex = hovered ?? peakI
  const displayVal = fmtRupiah(safeVals[displayIndex] ?? 0)
  const displayDate =
    (dataset.dates[displayIndex] ?? '') +
    (displayIndex === peakI && (safeVals[displayIndex] ?? 0) > 0 ? ' — pendapatan tertinggi' : '')

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const dpr = window.devicePixelRatio || 1
    const cssW = wrap.offsetWidth || 320
    const cssH = 190
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    canvas.style.width = cssW + 'px'
    canvas.style.height = cssH + 'px'
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const W = cssW
    const H = cssH
    const pad = { top: 16, right: 14, bottom: 32, left: 14 }
    const cw = W - pad.left - pad.right
    const ch = H - pad.top - pad.bottom
    const sv = safeVals
    const dataMin = Math.min(...sv)
    const dataMax = Math.max(...sv)
    const minV = dataMax === 0 ? 0 : dataMin * 0.88
    const maxV = dataMax === 0 ? 1 : dataMax * 1.06
    const rangeVal = maxV - minV || 1
    const toX = (i: number) => (sv.length === 1 ? pad.left + cw / 2 : pad.left + (i / (sv.length - 1)) * cw)
    const toY = (v: number) => pad.top + ch - ((v - minV) / rangeVal) * ch
    const isDark = document.documentElement.classList.contains('dark')
    const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'
    const labelColor = isDark ? '#c3c6d7' : '#898781'
    const lineColor = '#1a56f0'
    const zeroDotColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)'
    const areaTop = 'rgba(26,86,240,0.13)'
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
    sv.forEach((v, i) => {
      const x = toX(i)
      const y = toY(v)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.lineTo(toX(sv.length - 1), pad.top + ch)
    ctx.lineTo(toX(0), pad.top + ch)
    ctx.closePath()
    const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch)
    gradient.addColorStop(0, areaTop)
    gradient.addColorStop(1, 'rgba(26,86,240,0)')
    ctx.fillStyle = gradient
    ctx.fill()
    ctx.beginPath()
    sv.forEach((v, i) => {
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
    const labelStep = Math.max(1, Math.ceil(dataset.labels.length / 14))
    dataset.labels.forEach((lbl, i) => {
      if (i % labelStep !== 0) return
      ctx.fillText(lbl, toX(i), H - 8)
    })
    const showAllDots = sv.length <= 15
    if (showAllDots) {
      sv.forEach((v, i) => {
        if (i === (hovered ?? peakI)) return
        ctx.beginPath()
        ctx.arc(toX(i), toY(v), v > 0 ? 3 : 2, 0, Math.PI * 2)
        ctx.fillStyle = v > 0 ? lineColor : zeroDotColor
        ctx.fill()
      })
    }
    const dotI = hovered ?? peakI
    ctx.beginPath()
    ctx.arc(toX(dotI), toY(sv[dotI]), 4, 0, Math.PI * 2)
    ctx.fillStyle = lineColor
    ctx.fill()
    ctx.beginPath()
    ctx.arc(toX(dotI), toY(sv[dotI]), 7, 0, Math.PI * 2)
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
    ;(canvas as unknown as { _toX: (i: number) => number })._toX = toX
  }, [dataset.labels, hovered, peakI, safeVals])

  useEffect(() => {
    draw()
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver(draw)
    ro.observe(wrap)
    const mo = new MutationObserver(draw)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [draw])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        const mx = e.clientX - rect.left
        const toX = (canvas as unknown as { _toX?: (i: number) => number })._toX
        if (!toX) return
        let closest = 0
        let minDx = Infinity
        safeVals.forEach((_, i) => {
          const dx = Math.abs(toX(i) - mx)
          if (dx < minDx) {
            minDx = dx
            closest = i
          }
        })
        setHovered(closest)
      })
    },
    [safeVals]
  )
  const handleLeave = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setHovered(null)
  }, [])

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
          onMouseLeave={handleLeave}
        />
      </div>
    </div>
  )
}

type ChartRange = 'today' | 'week' | 'all'
function ChartRangePicker({ range, onChangeRange }: { range: ChartRange; onChangeRange: (r: ChartRange) => void }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const label = useMemo(() => {
    if (range === 'today') return 'Hari Ini'
    if (range === 'week') return '7 Hari'
    return 'Semua'
  }, [range])
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
  const options: { key: ChartRange; label: string; icon: string }[] = [
    { key: 'today', label: 'Hari Ini', icon: 'today' },
    { key: 'week', label: '7 Hari Terakhir', icon: 'date_range' },
    { key: 'all', label: 'Semua', icon: 'all_inclusive' },
  ]
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
          className="z-[100] w-52 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-2xl py-1"
        >
          {options.map((opt) => (
            <button
              key={opt.key}
              onClick={() => {
                onChangeRange(opt.key)
                setOpen(false)
              }}
              className={`w-full flex items-center gap-2 text-left px-3 py-2 text-sm hover:bg-surface-container-highest transition-colors ${range === opt.key ? 'bg-primary-container text-primary font-semibold' : 'text-on-surface'}`}
            >
              <span className="material-symbols-outlined text-[16px]">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

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

function DashboardContent() {
  const user = useUser()
  const isGuest = user?.role === 'guest'
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [range, setRange] = useState<ChartRange>('today')
  const summaryQ = useDashboardSummary()
  const hourlyQ = useTodayHourly()
  const monthlyQ = useMonthlyRevenue()
  const queueQ = useQueue()
  const recentQ = useRecentActivity()
  const expensesQ = useExpensesQuery()
  const updateStatus = useAppStore((s) => s.updateTransactionStatus)
  const qc = useQueryClient()

  const expenses = expensesQ.data ?? []
  const isInitialLoading = summaryQ.isLoading && !summaryQ.data && !hourlyQ.data
  const todayExpensesVal = summaryQ.data?.today_expenses ?? 0
  const recentExpenses = useMemo(() => expenses.slice(0, 3), [expenses])

  const handleFinish = async (id: string) => {
    if (isGuest) return
    setUpdatingId(id)
    try {
      await updateStatus(id, 'Selesai')
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
  const todayRevenue = summaryQ.data?.today_revenue ?? 0
  const todayCount = summaryQ.data?.today_count ?? 0
  const queueTxs = queueQ.data ?? []
  const queueSlice = useMemo(() => queueTxs.slice(0, 3), [queueTxs])

  const todayDataset: ChartDataset = useMemo(() => {
    const pts = hourlyQ.data?.points ?? Array.from({ length: 24 }, (_, i) => ({ label: String(i).padStart(2, '0'), hour: i, total: 0 }))
    return {
      labels: pts.map((p) => p.label),
      values: pts.map((p) => p.total),
      dates: pts.map((p) => `${String(p.hour).padStart(2, '0')}:00`),
    }
  }, [hourlyQ.data])

  const weekDataset: ChartDataset = useMemo(() => {
    const days = summaryQ.data?.last7days ?? []
    const labels = days.map((d) => {
      const dt = new Date(`${d.date}T12:00:00+07:00`)
      return dt.toLocaleDateString('id-ID', { weekday: 'short', timeZone: 'Asia/Jakarta' })
    })
    return {
      labels,
      values: days.map((d) => d.total),
      dates: days.map((d) => d.date),
    }
  }, [summaryQ.data])

  const allDataset: ChartDataset = useMemo(() => {
    const points = monthlyQ.data?.points ?? []
    return {
      labels: points.map((p) => String(Number(p.date.split('-')[1]))),
      values: points.map((p) => p.total),
      dates: points.map((p) => {
        const [y, m] = p.date.split('-').map(Number)
        return `${MONTH_NAMES[m - 1]} ${y}`
      }),
    }
  }, [monthlyQ.data])

  const dataset = range === 'today' ? todayDataset : range === 'week' ? weekDataset : allDataset

  const recentActivities = useMemo(() => {
    const list = recentQ.data ?? []
    return list.slice(0, 4).map((tx) => ({
      icon: tx.status === 'Selesai' ? 'check_circle' : 'autorenew',
      iconClass: tx.status === 'Selesai' ? 'text-success' : 'text-primary',
      bg: tx.status === 'Selesai' ? 'bg-success-container' : 'bg-secondary-container',
      title: `${tx.model} ${tx.status === 'Selesai' ? 'selesai' : 'diproses'}`,
      type: (tx as { type?: string }).type || null,
      sub: `${formatTimeWIB(getCreatedAt(tx))} · ${tx.karyawan.split(',')[0]?.trim()} · ${fmtRupiah(getHarga(tx))}`,
    }))
  }, [recentQ.data])

  useEffect(() => {
    const doPrefetch = () => {
      qc.prefetchQuery({ queryKey: qk.reportTransactions(undefined, undefined) })
    }
    const w = window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void }
    let id: number | ReturnType<typeof setTimeout> | undefined
    if (w.requestIdleCallback) id = w.requestIdleCallback(doPrefetch, { timeout: 4000 }) as unknown as number
    else id = setTimeout(doPrefetch, 2500)
    return () => {
      if (w.cancelIdleCallback && typeof id === 'number') w.cancelIdleCallback(id as number)
      else clearTimeout(id as ReturnType<typeof setTimeout>)
    }
  }, [qc])

  if (isInitialLoading) {
    return (
      <div className="w-full space-y-4 lg:space-y-6">
        <SkeletonStats />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4 xl:gap-6">
          <SkeletonList rows={3} />
          <SkeletonChart />
        </div>
        <SkeletonList rows={4} />
      </div>
    )
  }

  const isFetching = summaryQ.isFetching || hourlyQ.isFetching || queueQ.isFetching

  return (
    <div className="w-full space-y-4 lg:space-y-6">
      <div className="space-y-4 lg:space-y-6 w-full">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[22px] font-extrabold text-on-surface leading-tight">Halo, {greeting} 👋</h2>
            <p className="text-sm text-on-surface-variant font-medium mt-0.5">Ringkasan bisnis hari ini</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[11px] text-on-surface-variant">{dayName}</p>
            <p className="text-xs font-bold text-on-surface">{dateFormatted}</p>
            {isFetching && <p className="text-[10px] text-on-surface-variant mt-1">memperbarui…</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4 xl:gap-5">
          <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80 rounded-2xl p-4 text-white shadow-lg shadow-primary/20">
            <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10" />
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-white text-[18px] icon-fill">account_balance_wallet</span>
              </div>
              <p className="text-[10px] text-white/70 font-bold uppercase tracking-wider">Pendapatan hari ini</p>
              <h3 className="text-xl font-extrabold mt-0.5">{fmtRupiah(todayRevenue)}</h3>
              <p className="text-[11px] text-white/60 mt-1">{todayCount} transaksi</p>
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
            <div className="w-9 h-9 rounded-xl bg-secondary-container flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-primary text-[18px] icon-fill">directions_car</span>
            </div>
            <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Kendaraan</p>
            <h3 className="text-xl font-extrabold mt-0.5 text-on-surface">{todayCount}</h3>
            <p className="text-[11px] text-on-surface-variant mt-1">Dicuci hari ini</p>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 flex flex-col">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-error-container flex items-center justify-center">
                <span className="material-symbols-outlined text-error text-[18px] icon-fill">trending_down</span>
              </div>
              <Link href="/Pengeluaran" className="w-7 h-7 rounded-lg bg-error-container flex items-center justify-center hover:bg-error/20 transition-colors" aria-label="Tambah pengeluaran">
                <span className="material-symbols-outlined text-error text-[16px]">add</span>
              </Link>
            </div>
            <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Pengeluaran hari ini</p>
            <h3 className="text-xl font-extrabold mt-0.5 text-error">{expensesQ.isLoading && !expensesQ.data ? '...' : fmtRupiah(todayExpensesVal)}</h3>
            <div className="mt-3 space-y-2 flex-1">
              {expensesQ.isLoading && !expensesQ.data ? (
                <p className="text-xs text-on-surface-variant">Memuat...</p>
              ) : recentExpenses.length === 0 ? (
                <p className="text-xs text-on-surface-variant">Belum ada pengeluaran</p>
              ) : (
                recentExpenses.map((exp) => (
                  <div key={exp.id} className="flex justify-between items-start text-xs gap-2">
                    <div className="min-w-0">
                      <p className="text-on-surface truncate font-medium">{exp.nama_pengeluaran}</p>
                      <p className="text-[10px] text-on-surface-variant">
                        {new Date(exp.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })}
                      </p>
                    </div>
                    <span className="font-semibold text-error whitespace-nowrap text-[11px]">Rp {exp.nominal.toLocaleString('id-ID')}</span>
                  </div>
                ))
              )}
            </div>
            <Link href="/Pengeluaran" className="mt-3 text-center text-[11px] font-bold text-error hover:underline">
              Lihat semua →
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4 xl:gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
            <SectionTitle
              icon="pending_actions"
              label="Antrian Aktif"
              right={
                !isGuest ? (
                  <Link href="/Transaksi" className="text-xs font-semibold text-primary flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[14px]">add</span> Tambah
                  </Link>
                ) : (
                  <span className="text-[11px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full font-semibold">{queueSlice.length} item</span>
                )
              }
            />
            <div className="divide-y divide-outline-variant/50">
              {queueQ.isLoading && !queueQ.data ? (
                <p className="text-xs text-on-surface-variant py-6 text-center">Memuat...</p>
              ) : queueSlice.length === 0 ? (
                <div className="text-center py-6">
                  <span className="material-symbols-outlined text-[32px] text-on-surface-variant/40">task_alt</span>
                  <p className="text-xs text-on-surface-variant mt-1">Tidak ada antrian</p>
                </div>
              ) : (
                queueSlice.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${tx.tipe === 'mobil' ? 'bg-secondary-container' : 'bg-error-container'}`}>
                      <span className={`material-symbols-outlined text-[17px] icon-fill ${tx.tipe === 'mobil' ? 'text-primary' : 'text-error'}`}>{tx.tipe === 'mobil' ? 'directions_car' : 'motorcycle'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-on-surface truncate">{tx.plat} · {tx.model}</p>
                      {(tx as unknown as { type?: string }).type && <p className="text-[11px] text-primary font-medium truncate">· {(tx as unknown as { type?: string }).type}</p>}
                      <p className="text-[11px] text-on-surface-variant truncate">{tx.karyawan.split(',')[0]?.trim()} · {formatTimeWIB(getCreatedAt(tx))}</p>
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
                          {updatingId === tx.id ? <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-white text-[14px]">arrow_forward_ios</span>}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
            <SectionTitle icon="trending_up" label="Tren Pendapatan" right={<ChartRangePicker range={range} onChangeRange={setRange} />} />
            <TrendChart dataset={dataset} />
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
          <SectionTitle icon="history" label="Aktivitas Terbaru" right={<Link href="/Laporan" className="text-xs font-semibold text-primary">Lihat semua</Link>} />
          <div className="divide-y divide-outline-variant/50">
            {recentQ.isLoading && !recentQ.data ? (
              <p className="text-xs text-on-surface-variant py-6 text-center">Memuat...</p>
            ) : recentActivities.length === 0 ? (
              <div className="text-center py-6">
                <span className="material-symbols-outlined text-[32px] text-on-surface-variant/40">inbox</span>
                <p className="text-xs text-on-surface-variant mt-1">Belum ada aktivitas</p>
              </div>
            ) : (
              recentActivities.map((act, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${act.bg}`}>
                    <span className={`material-symbols-outlined text-[17px] icon-fill ${act.iconClass}`}>{act.icon}</span>
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
      </div>
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
