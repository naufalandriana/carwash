'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useMemo } from 'react'
import { useAppStore, useUser } from '@/lib/Store'
import Badge from '@/components/ui/Badge'
import Guard from '@/components/auth/Guard'
import Headbar from '@/components/layout/Headbar'
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

function getMonthPoints() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const step = Math.max(1, Math.floor(daysInMonth / 8))
  const points: { label: string; date: string; total: number }[] = []
  for (let d = 1; d <= daysInMonth; d += step) {
    const dt = new Date(year, month, d)
    const dateStr = dt.toISOString().split('T')[0]
    const label = String(d)
    points.push({ label, date: dateStr, total: 0 })
  }
  const last = new Date(year, month, daysInMonth)
  const lastStr = last.toISOString().split('T')[0]
  if (!points.some(p => p.date === lastStr)) {
    points.push({ label: String(daysInMonth), date: lastStr, total: 0 })
  }
  return points
}

// ─── Chart Component ──────────────────────────────────────────────────────
interface ChartDataset {
  labels: string[]
  values: number[]
  dates: string[]
}

function TrendChart({ dataset }: { dataset: ChartDataset }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState<number | null>(null)

  const vals = dataset.values
  const peakI = vals.indexOf(Math.max(...vals))
  const displayIndex = hovered ?? peakI
  const displayVal = fmtRupiah(vals[displayIndex])
  const displayDate =
    dataset.dates[displayIndex] +
    (displayIndex === peakI ? ' — pendapatan tertinggi' : '')

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

      const minV = Math.min(...vals) * 0.88
      const maxV = Math.max(...vals) * 1.06

      const toX = (i: number) => pad.left + (i / (vals.length - 1)) * cw
      const toY = (v: number) => pad.top + ch - ((v - minV) / (maxV - minV)) * ch

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
      vals.forEach((v, i) => {
        const x = toX(i)
        const y = toY(v)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.lineTo(toX(vals.length - 1), pad.top + ch)
      ctx.lineTo(toX(0), pad.top + ch)
      ctx.closePath()
      const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch)
      gradient.addColorStop(0, areaTop)
      gradient.addColorStop(1, 'rgba(26,86,240,0)')
      ctx.fillStyle = gradient
      ctx.fill()

      ctx.beginPath()
      vals.forEach((v, i) => {
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
      dataset.labels.forEach((lbl, i) => {
        ctx.fillText(lbl, toX(i), H - 8)
      })

      const dotI = hovered ?? peakI
      ctx.beginPath()
      ctx.arc(toX(dotI), toY(vals[dotI]), 4, 0, Math.PI * 2)
      ctx.fillStyle = lineColor
      ctx.fill()
      ctx.beginPath()
      ctx.arc(toX(dotI), toY(vals[dotI]), 7, 0, Math.PI * 2)
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
  }, [dataset, hovered, vals, peakI])

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const toX = (canvas as any)._toX as ((i: number) => number) | undefined
    if (!toX) return

    let closest = 0
    let minDx = Infinity
    vals.forEach((_, i) => {
      const dx = Math.abs(toX(i) - mx)
      if (dx < minDx) { minDx = dx; closest = i }
    })
    setHovered(closest)
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-2">
        <div>
          <p className="text-xl font-medium text-on-surface">{displayVal}</p>
          <p className="text-[11px] text-on-surface-variant mt-0.5">{displayDate}</p>
        </div>
      </div>
      <div ref={wrapRef} className="relative w-full h-[190px]">
        <canvas
          ref={canvasRef}
          className="block"
          role="img"
          aria-label="Grafik tren pendapatan harian"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHovered(null)}
        />
      </div>
    </div>
  )
}

// ─── Dashboard Content ────────────────────────────────────────────────────
function DashboardContent() {
  const {
    transactions,
    updateTransactionStatus,
    expenses,
    loading,
  } = useAppStore()
  const user = useUser()
  const isGuest = user?.role === 'guest'
  const [range, setRange] = useState<'today' | 'week' | 'month'>('today')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // ── Hitung total pengeluaran hari ini ──────────────────────────────
  const todayExpenses = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    return expenses
      .filter(e => {
        const d = new Date(e.created_at)
        return d >= start && d < end
      })
      .reduce((sum, e) => sum + e.nominal, 0)
  }, [expenses])

  // ── Ambil 3 pengeluaran terakhir ──────────────────────────────────
  const recentExpenses = useMemo(() => expenses.slice(0, 3), [expenses])

  // ── Handle finish status ───────────────────────────────────────────
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

  // ── Data greeting & tanggal ────────────────────────────────────────
  const userName = user?.name || user?.role || 'User'
  const greeting = userName === 'User' ? 'User' : userName
  const now = new Date()
  const dayName = now.toLocaleDateString('id-ID', { weekday: 'long' })
  const dateFormatted = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

  const today = todayStr()
  const todayTxs = transactions.filter(tx => filterByDate(tx as any, today))
  const todayRevenue = todayTxs.reduce((sum, tx) => sum + tx.harga, 0)
  const todayCount = todayTxs.length

  // ── Antrian aktif ──────────────────────────────────────────────────
  const queueTxs = transactions
    .filter(tx => tx.status === 'Proses')
    .sort((a, b) => new Date((b as any).createdAt).getTime() - new Date((a as any).createdAt).getTime())
    .slice(0, 3)

  // ── Chart data ──────────────────────────────────────────────────────
  const getTodayPoints = () => {
  return Array.from({ length: 24 }, (_, i) => ({
    label: `${i.toString().padStart(2, '0')}`,
    hour: i,
    total: 0,
  }))
  }

  const todayPoints = getTodayPoints()

  transactions.forEach(tx => {
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
    labels: todayPoints.map(p => p.label),
    values: todayPoints.map(p => p.total),
    dates: todayPoints.map(p => `${p.hour}:00`),
  }

  const weekPoints = getLast7Days()
  transactions.forEach(tx => {
    const txDate = (tx as any).createdAt?.split('T')[0]
    if (!txDate) return
    const point = weekPoints.find(p => p.date === txDate)
    if (point) point.total += tx.harga
  })
  const weekDataset: ChartDataset = {
    labels: weekPoints.map(p => p.label),
    values: weekPoints.map(p => p.total),
    dates: weekPoints.map(p => p.date),
  }

  const monthPoints = getMonthPoints()
  transactions.forEach(tx => {
    const txDate = (tx as any).createdAt?.split('T')[0]
    if (!txDate) return
    const point = monthPoints.find(p => p.date === txDate)
    if (point) point.total += tx.harga
  })
  const monthDataset: ChartDataset = {
    labels: monthPoints.map(p => p.label),
    values: monthPoints.map(p => p.total),
    dates: monthPoints.map(p => p.date),
  }

  const dataset =
  range === 'today'
    ? todayDataset
    : range === 'month'
    ? monthDataset
    : weekDataset

  // ── Aktivitas terbaru ──────────────────────────────────────────────
  const recentActivities = transactions.slice(0, 4).map(tx => ({
    icon: tx.status === 'Selesai' ? 'check_circle' : 'autorenew',
    iconClass: tx.status === 'Selesai' ? 'text-green-600' : 'text-primary',
    bg: tx.status === 'Selesai' ? 'bg-green-50' : 'bg-secondary-container',
    title: `${tx.model} ${tx.status === 'Selesai' ? 'selesai' : 'diproses'}`,
    type: tx.type || null,
    sub: `${formatTimeWIB((tx as any).createdAt)} · ${tx.karyawan.split(' ')[0]} · ${fmtRupiah(tx.harga)}`,
  }))

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <main className="flex-1 pb-24">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-medium text-on-surface leading-tight">
                Halo, {greeting} 👋
              </h2>
              <p className="text-sm text-on-surface-variant mt-0.5">Ringkasan bisnis hari ini</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-on-surface-variant">{dayName}</p>
              <p className="text-xs font-medium text-on-surface">{dateFormatted}</p>
            </div>
          </div>

          {/* ─── 3 Cards ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-2.5">
            {/* Card Pendapatan */}
            <div className="col-span-3 sm:col-span-1 bg-primary rounded-2xl p-4 text-white transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/30">
              <div className="flex justify-between items-start mb-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-[18px] icon-fill">account_balance_wallet</span>
                </div>
                <span className="text-[11px] font-medium bg-white/15 px-2.5 py-1 rounded-full">↑ 5.4%</span>
              </div>
              <p className="text-[11px] text-white/65 font-medium uppercase tracking-wider">Pendapatan hari ini</p>
              <h3 className="text-xl font-medium mt-0.5">{fmtRupiah(todayRevenue)}</h3>
              <p className="text-[11px] text-white/50 mt-1">+Rp 840rb dari kemarin</p>
            </div>

            {/* Card Kendaraan */}
            <div className="col-span-3 sm:col-span-1 bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl hover:border-primary/30">
              <div className="w-9 h-9 rounded-xl bg-secondary-container flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-primary text-[18px] icon-fill">directions_car</span>
              </div>
              <p className="text-[11px] text-on-surface-variant font-medium uppercase tracking-wider">Kendaraan</p>
              <h3 className="text-xl font-medium mt-0.5">{todayCount}</h3>
              <p className="text-[11px] text-on-surface-variant mt-1">
                <span className="text-green-600 font-medium">+12%</span> vs kemarin
              </p>
            </div>

            {/* ─── Card Pengeluaran ────────────────────────────────────── */}
            <div className="col-span-3 sm:col-span-1 bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 flex flex-col transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl hover:border-error/30">
              <div className="flex items-start justify-between mb-2">
                <div className="w-9 h-9 rounded-xl bg-error-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-error text-[18px]">trending_down</span>
                </div>
                <Link
                  href="/Pengeluaran"
                  className="flex items-center gap-0.5 text-xs font-medium text-on-surface-variant hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px] text-error">add</span>
                </Link>
              </div>

              <p className="text-[11px] text-on-surface-variant font-medium uppercase tracking-wider">Pengeluaran Hari Ini</p>
              <h3 className="text-xl font-medium mt-0.5 text-error">
                {loading.expenses ? '...' : fmtRupiah(todayExpenses)}
              </h3>

              {/* Daftar 3 pengeluaran terakhir */}
              <div className="mt-3 space-y-2 flex-1">
                {loading.expenses ? (
                  <p className="text-xs text-on-surface-variant">Memuat...</p>
                ) : recentExpenses.length === 0 ? (
                  <p className="text-xs text-on-surface-variant">Belum ada pengeluaran</p>
                ) : (
                  recentExpenses.map((exp) => (
                    <div key={exp.id} className="flex justify-between items-start text-xs">
                      <div>
                        <p className="text-on-surface truncate max-w-[140px] font-medium">
                          {exp.nama_pengeluaran}
                        </p>

                        <p className="text-[11px] text-on-surface-variant">
                          {new Date(exp.created_at).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </div>

                      <span className="font-semibold text-error whitespace-nowrap">
                        Rp {exp.nominal.toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <Link
                href="/Pengeluaran"
                className="mt-3 text-center text-xs font-medium text-error hover:underline"
              >
                Lihat semua →
              </Link>
            </div>
          </div>

          {/* ─── Antrian & Chart ──────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-on-surface">Antrian aktif</h4>
                {!isGuest && (
                  <Link href="/Transaksi" className="text-xs font-medium text-primary flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[14px]">add</span> Tambah
                  </Link>
                )}
              </div>
              <div className="divide-y divide-outline-variant">
                {queueTxs.length === 0 ? (
                  <p className="text-sm text-on-surface-variant py-2">Tidak ada antrian</p>
                ) : (
                  queueTxs.map((tx) => (
                    <div key={tx.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${tx.tipe === 'mobil' ? 'bg-secondary-container' : 'bg-error-container'}`}>
                        <span className={`material-symbols-outlined text-[17px] icon-fill ${tx.tipe === 'mobil' ? 'text-primary' : 'text-error'}`}>
                          {tx.tipe === 'mobil' ? 'directions_car' : 'motorcycle'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-on-surface truncate">{tx.plat} · {tx.model}</p>
                        {tx.type && <p className="text-xs text-primary font-medium truncate">· {tx.type}</p>}
                        <p className="text-xs text-on-surface-variant">{tx.karyawan.split(' ')[0]} · {formatTimeWIB((tx as any).createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge status={tx.status} />
                        {!isGuest && (
                          <button
                            onClick={() => handleFinish(tx.id)}
                            disabled={updatingId === tx.id}
                            className="w-6 h-6 flex items-center justify-center rounded-full bg-primary hover:bg-primary-dark active:scale-90 transition-all disabled:opacity-50"
                            title="Tandai selesai"
                          >
                            {updatingId === tx.id ? (
                              <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            ) : (
                              <span className="material-symbols-outlined text-white text-[14px]">arrow_forward_ios</span>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-on-surface">Tren pendapatan</h4>
                <select
                  value={range}
                  onChange={(e) => setRange(e.target.value as 'today' | 'week' | 'month')}
                  className="text-xs bg-surface-container px-2.5 py-1.5 rounded-lg border-none text-on-surface-variant font-medium outline-none"
                >
                  <></>
                  <option value="today">Hari ini</option>
                  <option value="week">Minggu ini</option>
                  <option value="month">Bulan ini</option>
                </select>
              </div>
              <TrendChart dataset={dataset} />
            </div>
          </div>

          {/* ─── Aktivitas terbaru ────────────────────────────────────────── */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-on-surface">Aktivitas terbaru</h4>
              <Link href="/Laporan" className="text-xs font-medium text-primary">
                Lihat semua
              </Link>
            </div>
            <div className="divide-y divide-outline-variant">
              {recentActivities.length === 0 ? (
                <p className="text-sm text-on-surface-variant py-2">Belum ada aktivitas</p>
              ) : (
                recentActivities.map((act, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${act.bg}`}>
                      <span className={`material-symbols-outlined text-[17px] icon-fill ${act.iconClass}`}>
                        {act.icon}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-on-surface">{act.title}</p>
                      {act.type && <p className="text-xs text-primary font-medium">· {act.type}</p>}
                      <p className="text-xs text-on-surface-variant">{act.sub}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
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