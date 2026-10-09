'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useAppStore, useUser, useVehiclesDB, useModelOptions } from '@/lib/Store'
import Toast from '@/components/ui/Toast'
import Guard from '@/components/auth/Guard'
import type { Transaction } from '@/lib/Data'

// ─── Formatters ──────────────────────────────────────────────────────────────
function fmtRupiah(n?: number) {
  if (n === undefined || n === null) return 'Rp 0'
  return 'Rp ' + n.toLocaleString('id-ID')
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function fmtDateInput(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getDayLabel(dateStr?: string): string {
  if (!dateStr) return 'Tanpa Tanggal'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return 'Tanpa Tanggal'
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((today - target) / 86400000)
  if (diffDays === 0) return 'Hari Ini'
  if (diffDays === 1) return 'Kemarin'
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  }).format(d)
}

// ─── Types ────────────────────────────────────────────────────────────────────
type LayananKey = 'expres' | 'hidrolik'
type BayarKey = 'tunai' | 'qris' | 'transfer'
type PresetKey = 'today' | '7d' | 'month' | 'all' | 'custom'

const layananLabel: Record<LayananKey, string> = {
  expres: 'Expres Wash',
  hidrolik: 'Hidrolik Wash',
}
const bayarLabel: Record<BayarKey, string> = {
  tunai: 'Tunai',
  qris: 'QRIS',
  transfer: 'Transfer',
}
const layananKeyMap: Record<string, LayananKey> = {
  'Expres Wash': 'expres',
  'Hidrolik Wash': 'hidrolik',
}
const bayarKeyMap: Record<string, BayarKey> = {
  Tunai: 'tunai',
  QRIS: 'qris',
  Transfer: 'transfer',
}
const layananItems: { key: LayananKey; label: string; sub: string }[] = [
  { key: 'expres', label: 'Expres Wash', sub: 'Cuci cepat + kering' },
  { key: 'hidrolik', label: 'Hidrolik Wash', sub: 'Cuci dengan hidrolik + poles' },
]
const bayarItems: { key: BayarKey; label: string; icon: string }[] = [
  { key: 'tunai', label: 'Tunai', icon: 'payments' },
  { key: 'qris', label: 'QRIS', icon: 'qr_code_scanner' },
  { key: 'transfer', label: 'Transfer', icon: 'account_balance' },
]

const presetOptions: { value: PresetKey; label: string; icon: string }[] = [
  { value: 'today', label: 'Hari Ini', icon: 'today' },
  { value: '7d', label: '7 Hari', icon: 'date_range' },
  { value: 'month', label: 'Bulan Ini', icon: 'calendar_month' },
  { value: 'all', label: 'Semua', icon: 'all_inclusive' },
  { value: 'custom', label: 'Custom', icon: 'tune' },
]

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const PER_PAGE_OPTIONS = [5, 10, 25, 50, 100]

// ─── Preset date range ───────────────────────────────────────────────────────
function monthRangeFromValue(value: string): { from: string; to: string } {
  const [y, m] = value.split('-').map(Number)
  const start = new Date(y, m - 1, 1)
  const end = new Date(y, m, 0)
  return { from: fmtDateInput(start), to: fmtDateInput(end) }
}

function getPeriodRange(
  preset: PresetKey,
  selectedMonth: string,
  selectedMonthLabel: string
): { from?: string; to?: string; label: string } {
  const now = new Date()
  switch (preset) {
    case 'today':
      return { from: fmtDateInput(now), to: fmtDateInput(now), label: 'Hari Ini' }
    case '7d': {
      const s = new Date(now); s.setDate(s.getDate() - 6)
      return { from: fmtDateInput(s), to: fmtDateInput(now), label: '7 Hari' }
    }
    case 'month': {
      if (!selectedMonth) return { label: 'Bulan Ini' }
      const { from, to } = monthRangeFromValue(selectedMonth)
      return { from, to, label: selectedMonthLabel || 'Bulan Ini' }
    }
    case 'all':
    default:
      return { label: 'Semua' }
  }
}

function generateMonthOptions(oldestIso: string, newestIso: string): { value: string; label: string }[] {
  const oldest = new Date(oldestIso)
  const newest = new Date(newestIso)
  const months: { value: string; label: string }[] = []
  let y = newest.getFullYear()
  let m = newest.getMonth()
  const endY = oldest.getFullYear()
  const endM = oldest.getMonth()
  let guard = 0
  while ((y > endY || (y === endY && m >= endM)) && guard < 240) {
    months.push({ value: `${y}-${String(m + 1).padStart(2, '0')}`, label: `${MONTH_NAMES[m]} ${y}` })
    m -= 1
    if (m < 0) { m = 11; y -= 1 }
    guard += 1
  }
  return months
}

// ─── Dropdown Component ───────────────────────────────────────────────────────
interface DropdownProps {
  options: { value: string; label: string }[]
  value: string
  onChange: (val: string) => void
  placeholder?: string
  className?: string
}
function Dropdown({ options, value, onChange, placeholder = 'Pilih', className = '' }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const label = options.find((o) => o.value === value)?.label || placeholder

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="h-9 w-full px-3 pr-8 bg-surface-container border border-outline-variant rounded-full text-xs font-semibold flex items-center justify-between gap-1 hover:bg-surface-container-high transition-colors focus:outline-none"
      >
        <span className="truncate">{label}</span>
        <span className="material-symbols-outlined text-[16px] text-on-surface-variant absolute right-2">
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full min-w-[140px] bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg py-1 max-h-52 overflow-y-auto">
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false) }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-surface-container-highest transition-colors ${
                o.value === value ? 'bg-primary-container text-primary font-semibold' : 'text-on-surface'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Month Chip with popover ─────────────────────────────────────────────────
function MonthPresetChip({
  active, months, value, onSelect, onActivate,
}: {
  active: boolean
  months: { value: string; label: string }[]
  value: string
  onSelect: (v: string) => void
  onActivate: () => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const label = months.find((m) => m.value === value)?.label

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (btnRef.current?.contains(target)) return
      if (popRef.current?.contains(target)) return
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
    onActivate()
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 6, left: r.left })
    }
    setOpen((p) => !p)
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggleOpen}
        className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
          active
            ? 'bg-primary text-white shadow-sm shadow-primary/30'
            : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
        }`}
      >
        <span className="material-symbols-outlined text-[15px]">calendar_month</span>
        {active && label ? label : 'Bulan Ini'}
        <span className="material-symbols-outlined text-[15px]">{open ? 'expand_less' : 'expand_more'}</span>
      </button>

      {open && pos && (
        <div
          ref={popRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
          className="z-[100] w-48 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-2xl py-1 max-h-56 overflow-y-auto"
        >
          {months.length === 0 ? (
            <p className="px-4 py-2 text-xs text-on-surface-variant">Memuat daftar bulan...</p>
          ) : (
            months.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => { onSelect(m.value); setOpen(false) }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-surface-container-highest transition-colors ${
                  m.value === value ? 'bg-primary-container text-primary font-semibold' : 'text-on-surface'
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

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  icon, iconBg, iconColor, label, value, sub,
}: {
  icon: string; iconBg: string; iconColor: string; label: string; value: string; sub?: string
}) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-3.5">
      <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center mb-2.5`}>
        <span className={`material-symbols-outlined ${iconColor} text-[16px] icon-fill`}>{icon}</span>
      </div>
      <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wide">{label}</p>
      <h3 className="text-sm font-extrabold mt-0.5 text-on-surface truncate">{value}</h3>
      {sub && <p className="text-[10px] text-on-surface-variant mt-0.5 truncate">{sub}</p>}
    </div>
  )
}

// ─── Section Title ───────────────────────────────────────────────────────────
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

// ─── Status chip config ──────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string; icon: string }> = {
  Menunggu: { bg: 'bg-error-container', text: 'text-error', dot: 'bg-error', icon: 'schedule' },
  Proses:   { bg: 'bg-tertiary-container', text: 'text-tertiary', dot: 'bg-tertiary', icon: 'autorenew' },
  Selesai:  { bg: 'bg-success-container', text: 'text-success', dot: 'bg-success', icon: 'check_circle' },
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function LaporanContent() {
  const {
    transactions, expenses, updateTransactionStatus, updateTransaction,
    fetchReportTransactions, fetchExpenses, fetchTransactionDateRange,
  } = useAppStore()
  const user = useUser()
  const vehiclesDB = useVehiclesDB()
  const isAdmin = user?.role === 'admin'

  const [toast, setToast] = useState({ visible: false, message: '', success: true })
  const showToast = (message: string, success = true) => setToast({ visible: true, message, success })

  const [activeTab, setActiveTab] = useState<'history' | 'report'>('history')

  // History filters
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'mobil' | 'motor'>('all')
  const [filterModel, setFilterModel] = useState('all')
  const [filterLayanan, setFilterLayanan] = useState('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'Menunggu' | 'Proses' | 'Selesai'>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Report state
  const [reportData, setReportData] = useState<(Transaction & { id: string })[]>([])
  const [reportLoading, setReportLoading] = useState(false)
  const [preset, setPreset] = useState<PresetKey>('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [reportFilters, setReportFilters] = useState({
    type: 'all' as 'all' | 'mobil' | 'motor',
    model: 'all',
    layanan: 'all',
  })

  // ── Table pagination ──
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const [availableMonths, setAvailableMonths] = useState<{ value: string; label: string }[]>([])
  const [selectedMonth, setSelectedMonth] = useState('')
  const monthsLoadedRef = useRef(false)
  const currentMonthLabel = useMemo(
    () => availableMonths.find((m) => m.value === selectedMonth)?.label ?? '',
    [availableMonths, selectedMonth]
  )

  const [reportTab, setReportTab] = useState<'transaksi' | 'pengeluaran'>('transaksi')

  // Edit modal
  const [editingTx, setEditingTx] = useState<(Transaction & { id: string }) | null>(null)
  const [editVehicleType, setEditVehicleType] = useState<'mobil' | 'motor'>('mobil')
  const [editPlate, setEditPlate] = useState('')
  const [editModel, setEditModel] = useState('')
  const [editType, setEditType] = useState('')
  const [editLayanan, setEditLayanan] = useState<LayananKey>('expres')
  const [editBayar, setEditBayar] = useState<BayarKey>('tunai')
  const [editOperators, setEditOperators] = useState<string[]>([])
  const [editDropdownOpen, setEditDropdownOpen] = useState(false)
  const editDropdownRef = useRef<HTMLDivElement>(null)

  const allStaff = useAppStore((s) => s.staff)
  const operatorOptions = allStaff.filter((s) => s.jabatan === 'Operator')
  const modelOptions = useModelOptions(editVehicleType)

  const editPrices = useMemo(() => {
    const v = vehiclesDB.find((v) => v.name === editModel)
    if (!v) return { expres: 0, hidrolik: 0 }
    return { expres: v.price_expres ?? 0, hidrolik: v.price_hidrolik ?? 0 }
  }, [editModel, vehiclesDB])

  const openEditModal = (tx: Transaction & { id: string }) => {
    setEditingTx(tx)
    setEditVehicleType(tx.tipe)
    setEditPlate(tx.plat)
    setEditModel(tx.model)
    setEditType(tx.type || '')
    setEditLayanan(layananKeyMap[tx.layanan] || 'expres')
    setEditBayar(bayarKeyMap[tx.bayar] || 'tunai')
    setEditOperators(tx.karyawan.split(',').map((s) => s.trim()).filter(Boolean))
    setEditDropdownOpen(false)
  }

  const handleSaveEdit = async () => {
    if (!editingTx) return
    if (!editModel) { showToast('Pilih model kendaraan!', false); return }
    if (editOperators.length === 0) { showToast('Pilih minimal 1 operator!', false); return }
    try {
      await updateTransaction(editingTx.id, {
        plat: editPlate || 'N/A',
        model: editModel,
        type: editType.trim() || undefined,
        karyawan: editOperators.join(', '),
        layanan: layananLabel[editLayanan] as any,
        bayar: bayarLabel[editBayar] as any,
        harga: editPrices[editLayanan],
        tipe: editVehicleType,
      })
      showToast('Transaksi berhasil diupdate')
      setEditingTx(null)
      if (activeTab === 'report') loadReport()
    } catch {
      showToast('Gagal update transaksi', false)
    }
  }

  const toggleEditOperator = (name: string) => {
    if (editVehicleType === 'motor') { setEditOperators([name]); setEditDropdownOpen(false); return }
    setEditOperators((prev) => prev.includes(name) ? prev.filter((op) => op !== name) : [...prev, name])
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (editDropdownRef.current && !editDropdownRef.current.contains(e.target as Node))
        setEditDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Load report
  const loadReport = async () => {
    setReportLoading(true)
    try {
      let from: string | undefined
      let to: string | undefined
      if (preset === 'custom') {
        from = customFrom || undefined
        to = customTo || undefined
      } else if (preset !== 'all') {
        const r = getPeriodRange(preset, selectedMonth, currentMonthLabel)
        from = r.from; to = r.to
      }
      const data = await fetchReportTransactions(from, to)
      setReportData(data)
    } catch {
      showToast('Gagal memuat laporan', false)
    } finally {
      setReportLoading(false)
    }
  }

  const handleRefresh = async () => {
    await Promise.all([loadReport(), fetchExpenses()])
  }

  useEffect(() => {
    if (activeTab !== 'report') return
    if (!monthsLoadedRef.current) {
      monthsLoadedRef.current = true
      fetchTransactionDateRange().then((range) => {
        if (!range) return
        const months = generateMonthOptions(range.oldest, range.newest)
        setAvailableMonths(months)
        setSelectedMonth((cur) => cur || months[0]?.value || '')
      })
    }
    if (expenses.length === 0) fetchExpenses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'report') return
    if (preset === 'month' && !selectedMonth) return
    loadReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, preset, selectedMonth, customFrom, customTo])

  // History filter options
  const allModels = useMemo(() => vehiclesDB.map((v) => ({ name: v.name, type: v.tipe })), [vehiclesDB])
  const modelOptionsFilter = useMemo(() => {
    const filtered = filterType === 'all' ? allModels : allModels.filter((m) => m.type === filterType)
    return ['all', ...new Set(filtered.map((m) => m.name))]
  }, [allModels, filterType])
  const layananOptions = useMemo(() => {
    const u = new Set(transactions.map((tx) => tx.layanan).filter(Boolean))
    return ['all', ...Array.from(u)]
  }, [transactions])

  const filteredTx = useMemo(() => {
    return transactions.filter((tx) => {
      if (filterType !== 'all' && tx.tipe !== filterType) return false
      if (filterModel !== 'all' && tx.model !== filterModel) return false
      if (filterLayanan !== 'all' && tx.layanan !== filterLayanan) return false
      if (filterStatus !== 'all' && tx.status !== filterStatus) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return tx.plat.toLowerCase().includes(q) ||
          tx.model.toLowerCase().includes(q) ||
          (tx.type ?? '').toLowerCase().includes(q) ||
          tx.karyawan.toLowerCase().includes(q)
      }
      return true
    })
  }, [transactions, filterType, filterModel, filterLayanan, filterStatus, search])

  // ── Antrian (dari SEMUA transaksi, bukan filter) ──
  const antrian = useMemo(() => {
    let menunggu = 0
    let proses = 0
    transactions.forEach((tx) => {
      if (tx.status === 'Menunggu') menunggu++
      else if (tx.status === 'Proses') proses++
    })
    return { menunggu, proses, total: menunggu + proses }
  }, [transactions])

  // ── History stats (dari filteredTx) ──
  const historyStats = useMemo(() => {
    let total = 0
    let mobilCount = 0
    let motorCount = 0
    let menunggu = 0
    let proses = 0
    let selesai = 0

    filteredTx.forEach((tx) => {
      total += tx.harga || 0
      if (tx.tipe === 'mobil') mobilCount++
      else motorCount++
      if (tx.status === 'Menunggu') menunggu++
      else if (tx.status === 'Proses') proses++
      else if (tx.status === 'Selesai') selesai++
    })

    return { total, mobilCount, motorCount, menunggu, proses, selesai }
  }, [filteredTx])

  // Group by day
  const groupedTx = useMemo(() => {
    const groups: Record<string, { label: string; items: (Transaction & { id: string })[]; total: number }> = {}
    filteredTx.forEach((tx) => {
      const label = getDayLabel(tx.waktu)
      if (!groups[label]) groups[label] = { label, items: [], total: 0 }
      groups[label].items.push(tx)
      groups[label].total += tx.harga || 0
    })
    return Object.values(groups).sort((a, b) => {
      const order = (label: string) => label === 'Hari Ini' ? 0 : label === 'Kemarin' ? 1 : 2
      const oa = order(a.label), ob = order(b.label)
      if (oa !== ob) return oa - ob
      const da = a.items[0]?.waktu ? new Date(a.items[0].waktu).getTime() : 0
      const db = b.items[0]?.waktu ? new Date(b.items[0].waktu).getTime() : 0
      return db - da
    })
  }, [filteredTx])

  // ── Report filtered ──
  const reportFiltered = useMemo(() => {
    return reportData.filter((tx) => {
      if (reportFilters.type !== 'all' && tx.tipe !== reportFilters.type) return false
      if (reportFilters.model !== 'all' && tx.model !== reportFilters.model) return false
      if (reportFilters.layanan !== 'all' && tx.layanan !== reportFilters.layanan) return false
      return true
    })
  }, [reportData, reportFilters])

  const reportStats = useMemo(() => {
    const total = reportFiltered.reduce((s, t) => s + (t.harga || 0), 0)
    const count = reportFiltered.length
    const avg = count ? Math.round(total / count) : 0
    const freq: Record<string, number> = {}
    reportFiltered.forEach((tx) => { freq[tx.layanan] = (freq[tx.layanan] || 0) + 1 })
    const populer = Object.entries(freq).sort((a, b) => b[1] - a[1])[0] ?? null
    const perTipe = { mobil: { count: 0, total: 0 }, motor: { count: 0, total: 0 } }
    reportFiltered.forEach((tx) => {
      if (tx.tipe === 'mobil') { perTipe.mobil.count++; perTipe.mobil.total += tx.harga || 0 }
      else { perTipe.motor.count++; perTipe.motor.total += tx.harga || 0 }
    })
    return { total, count, avg, populer, perTipe }
  }, [reportFiltered])

  // ── Pagination derived ──
  const totalPages = Math.max(1, Math.ceil(reportFiltered.length / perPage))
  const safePage = Math.min(page, totalPages)
  const startIdx = (safePage - 1) * perPage
  const endIdx = Math.min(startIdx + perPage, reportFiltered.length)
  const paginatedData = useMemo(
    () => reportFiltered.slice(startIdx, endIdx),
    [reportFiltered, startIdx, endIdx]
  )

  // Reset page saat filter / perPage berubah
  useEffect(() => { setPage(1) }, [reportFilters, preset, selectedMonth, customFrom, customTo, reportData])
  useEffect(() => { setPage(1) }, [perPage])

  const expenseStats = useMemo(() => {
    let filtered = expenses
    if (preset !== 'all') {
      let from: string | undefined
      let to: string | undefined
      if (preset === 'custom') {
        from = customFrom || undefined
        to = customTo || undefined
      } else {
        const r = getPeriodRange(preset, selectedMonth, currentMonthLabel)
        from = r.from; to = r.to
      }
      filtered = expenses.filter((e) => {
        const d = new Date(e.created_at)
        if (from && d < new Date(`${from}T00:00:00+07:00`)) return false
        if (to && d > new Date(`${to}T23:59:59.999+07:00`)) return false
        return true
      })
    }
    const total = filtered.reduce((s, e) => s + e.nominal, 0)
    const count = filtered.length
    const byKategori: Record<string, number> = {}
    filtered.forEach((e) => {
      const k = e.kategori || 'Lainnya'
      byKategori[k] = (byKategori[k] || 0) + e.nominal
    })
    const topKategori = Object.entries(byKategori).sort((a, b) => b[1] - a[1])
    return { total, count, topKategori, filtered }
  }, [expenses, preset, selectedMonth, currentMonthLabel, customFrom, customTo])

  const netProfit = reportStats.total - expenseStats.total

  const reportModelOptions = useMemo(() => {
    const v = reportFilters.type === 'all' ? vehiclesDB : vehiclesDB.filter((v) => v.tipe === reportFilters.type)
    return ['all', ...new Set(v.map((v) => v.name))]
  }, [vehiclesDB, reportFilters.type])
  const reportLayananOptions = useMemo(() => {
    const u = new Set(reportData.map((tx) => tx.layanan).filter(Boolean))
    return ['all', ...Array.from(u)]
  }, [reportData])

  const periodeLabel = useMemo(() => {
    if (preset === 'all') return 'Semua'
    if (preset === 'custom') {
      if (customFrom && customTo) return `${customFrom}_${customTo}`
      return 'Custom'
    }
    if (preset === 'month') return (currentMonthLabel || 'Bulan_Ini').replace(/\s+/g, '_')
    return getPeriodRange(preset, selectedMonth, currentMonthLabel).label.replace(/\s+/g, '_')
  }, [preset, selectedMonth, currentMonthLabel, customFrom, customTo])

  const periodeText = useMemo(() => {
    if (preset === 'all') return 'Semua Periode'
    if (preset === 'custom') return `${customFrom || '-'} s/d ${customTo || '-'}`
    if (preset === 'month') return currentMonthLabel || 'Bulan Ini'
    return getPeriodRange(preset, selectedMonth, currentMonthLabel).label
  }, [preset, selectedMonth, currentMonthLabel, customFrom, customTo])

  const handleAdvanceStatus = async (id: string, current: Transaction['status']) => {
    if (!isAdmin || current === 'Selesai') return
    const next = current === 'Menunggu' ? 'Proses' : 'Selesai'
    setUpdatingId(id)
    try {
      await updateTransactionStatus(id, next)
      showToast(`Status diubah ke ${next}`)
    } catch {
      showToast('Gagal mengubah status!', false)
    } finally {
      setUpdatingId(null)
    }
  }

  // ── Export Excel: TRANSAKSI ──
  const exportToExcel = async () => {
    if (!isAdmin) return
    if (reportFiltered.length === 0) { showToast('Tidak ada data untuk diekspor!', false); return }
    try {
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()

      const filterParts: string[] = []
      if (reportFilters.type !== 'all') filterParts.push(`Jenis: ${reportFilters.type === 'mobil' ? 'Mobil' : 'Motor'}`)
      if (reportFilters.model !== 'all') filterParts.push(`Model: ${reportFilters.model}`)
      if (reportFilters.layanan !== 'all') filterParts.push(`Layanan: ${reportFilters.layanan}`)
      const filterInfo = filterParts.length > 0 ? ` | Filter: ${filterParts.join(', ')}` : ''

      const addSheet = (data: (Transaction & { id: string })[], name: string) => {
        const ws = wb.addWorksheet(name)

        ws.mergeCells('A1:L1')
        const titleCell = ws.getCell('A1')
        titleCell.value = `LAPORAN TRANSAKSI - ${periodeText.toUpperCase()}${filterInfo ? ' | ' + filterInfo : ''}`
        titleCell.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }
        ws.getRow(1).height = 26
        ws.getRow(2).height = 6

        const headers = [
          'No', 'Tanggal', 'Jam', 'Plat', 'Model', 'Jenis',
          'Tipe/Merk', 'Layanan', 'Karyawan', 'Metode Bayar', 'Harga (Rp)', 'Status',
        ]
        const headerRow = ws.getRow(3)
        headers.forEach((h, i) => {
          const cell = headerRow.getCell(i + 1)
          cell.value = h
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF1E3A8A' } },
            bottom: { style: 'thin', color: { argb: 'FF1E3A8A' } },
            left: { style: 'thin', color: { argb: 'FF1E3A8A' } },
            right: { style: 'thin', color: { argb: 'FF1E3A8A' } },
          }
        })
        headerRow.height = 24

        ws.columns = [
          { width: 6 }, { width: 12 }, { width: 10 }, { width: 14 },
          { width: 18 }, { width: 10 }, { width: 16 }, { width: 18 },
          { width: 18 }, { width: 14 }, { width: 16 }, { width: 12 },
        ]

        data.forEach((tx, idx) => {
          const row = ws.addRow([
            idx + 1,
            formatDate(tx.waktu),
            formatTime(tx.waktu),
            tx.plat,
            tx.model,
            tx.tipe === 'mobil' ? 'Mobil' : 'Motor',
            tx.type ?? '',
            tx.layanan,
            tx.karyawan,
            tx.bayar,
            tx.harga || 0,
            tx.status,
          ])
          if (idx % 2 === 1) {
            row.eachCell((cell) => {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
            })
          }
          row.getCell(11).numFmt = 'Rp #,##0'
          row.getCell(11).alignment = { horizontal: 'right' }
          row.eachCell((cell) => {
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
              bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
              left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
              right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            }
          })
        })

        const totalHarga = data.reduce((s, t) => s + (t.harga || 0), 0)
        const totalRow = ws.addRow(['', '', '', '', '', '', '', '', '', 'TOTAL', totalHarga, ''])
        totalRow.getCell(10).font = { bold: true }
        totalRow.getCell(11).numFmt = 'Rp #,##0'
        totalRow.getCell(11).alignment = { horizontal: 'right' }
        totalRow.getCell(11).font = { bold: true }
        totalRow.getCell(11).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } }

        ws.views = [{ state: 'frozen', ySplit: 3 }]
      }

      addSheet(reportFiltered, 'Semua')
      const mobilTx = reportFiltered.filter((t) => t.tipe === 'mobil')
      const motorTx = reportFiltered.filter((t) => t.tipe === 'motor')
      if (mobilTx.length) addSheet(mobilTx, 'Mobil')
      if (motorTx.length) addSheet(motorTx, 'Motor')

      const buffer = await wb.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Laporan_Transaksi_${periodeLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
      showToast(`Berhasil export ${reportFiltered.length} transaksi!`)
    } catch (err) {
      console.error(err)
      showToast('Gagal mengekspor laporan!', false)
    }
  }

  // ── Export Excel: PENGELUARAN ──
  const exportExpensesToExcel = async () => {
    if (!isAdmin) return
    if (expenseStats.filtered.length === 0) {
      showToast('Tidak ada pengeluaran untuk diekspor!', false)
      return
    }
    try {
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Pengeluaran')

      ws.mergeCells('A1:F1')
      const titleCell = ws.getCell('A1')
      titleCell.value = `LAPORAN PENGELUARAN - ${periodeText.toUpperCase()}`
      titleCell.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } }
      ws.getRow(1).height = 26
      ws.getRow(2).height = 6

      const headers = ['No', 'Tanggal', 'Nama Pengeluaran', 'Kategori', 'Nominal (Rp)', 'Keterangan']
      const headerRow = ws.getRow(3)
      headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1)
        cell.value = h
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB91C1C' } }
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFB91C1C' } },
          bottom: { style: 'thin', color: { argb: 'FFB91C1C' } },
          left: { style: 'thin', color: { argb: 'FFB91C1C' } },
          right: { style: 'thin', color: { argb: 'FFB91C1C' } },
        }
      })
      headerRow.height = 24

      ws.columns = [
        { width: 6 }, { width: 14 }, { width: 30 },
        { width: 16 }, { width: 18 }, { width: 28 },
      ]

      expenseStats.filtered.forEach((e, idx) => {
        const row = ws.addRow([
          idx + 1,
          new Date(e.created_at).toLocaleDateString('id-ID'),
          e.nama_pengeluaran,
          e.kategori || '-',
          e.nominal,
          e.keterangan || '-',
        ])
        row.getCell(5).numFmt = 'Rp #,##0'
        row.getCell(5).alignment = { horizontal: 'right' }
        if (idx % 2 === 1) {
          row.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } }
          })
        }
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          }
        })
      })

      const totalRow = ws.addRow(['', '', '', 'TOTAL', expenseStats.total, ''])
      totalRow.getCell(4).font = { bold: true }
      totalRow.getCell(5).numFmt = 'Rp #,##0'
      totalRow.getCell(5).alignment = { horizontal: 'right' }
      totalRow.getCell(5).font = { bold: true }
      totalRow.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }

      ws.views = [{ state: 'frozen', ySplit: 3 }]

      const buffer = await wb.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Laporan_Pengeluaran_${periodeLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
      showToast(`Berhasil export ${expenseStats.filtered.length} pengeluaran!`)
    } catch (err) {
      console.error(err)
      showToast('Gagal mengekspor laporan!', false)
    }
  }

  const hasActiveFilter =
    search !== '' || filterType !== 'all' || filterModel !== 'all' ||
    filterLayanan !== 'all' || filterStatus !== 'all'

  const resetFilters = () => {
    setSearch(''); setFilterType('all'); setFilterModel('all')
    setFilterLayanan('all'); setFilterStatus('all')
  }

  const exportCount = reportTab === 'transaksi' ? reportFiltered.length : expenseStats.filtered.length
  const exportHandler = reportTab === 'transaksi' ? exportToExcel : exportExpensesToExcel

  return (
    <div className="p-4 space-y-5 pb-24 w-full max-w-3xl mx-auto">
      <Toast {...toast} onHide={() => setToast((t) => ({ ...t, visible: false }))} />

      {/* ═══ Header ═══ */}
      <div>
        <h2 className="text-[22px] font-extrabold text-on-surface">Riwayat & Laporan</h2>
        <p className="text-sm text-on-surface-variant font-medium mt-0.5">
          Pantau semua transaksi dan performa
        </p>
      </div>

      {/* ═══ Tab Switcher ═══ */}
      <div className="flex bg-surface-container-lowest border border-outline-variant rounded-2xl p-1 gap-1">
        {(['history', 'report'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === tab
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            {tab === 'history' ? 'Riwayat Transaksi' : 'Laporan'}
          </button>
        ))}
      </div>

      {/* ═══════════════════ TAB LAPORAN ═══════════════════ */}
      {activeTab === 'report' ? (
        <div className="space-y-4">
          {/* Hero card */}
          <div
            className={`relative overflow-hidden rounded-2xl p-5 shadow-lg text-white ${
              reportTab === 'pengeluaran' && netProfit < 0
                ? 'bg-gradient-to-br from-error via-error to-error/80 shadow-error/20'
                : 'bg-gradient-to-br from-primary via-primary to-primary/80 shadow-primary/20'
            }`}
          >
            <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/10" />
            <div className="absolute -right-2 -bottom-8 w-24 h-24 rounded-full bg-white/5" />
            <div className="relative">
              <div className="flex items-center gap-2 opacity-90">
                <span className="material-symbols-outlined text-[16px]">
                  {reportTab === 'pengeluaran' ? 'account_balance_wallet' : 'payments'}
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-wider">
                  {reportTab === 'pengeluaran' ? 'Laba Bersih' : 'Total Pendapatan'} · {periodeText}
                </p>
              </div>
              <p className="text-3xl font-extrabold mt-1.5 tracking-tight">
                {reportTab === 'pengeluaran'
                  ? (netProfit >= 0 ? '' : '-') + fmtRupiah(Math.abs(netProfit))
                  : fmtRupiah(reportStats.total)}
              </p>
              <div className="flex items-center gap-3 mt-3 text-[11px] font-medium opacity-90">
                {reportTab === 'pengeluaran' ? (
                  <>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">trending_up</span>
                      {fmtRupiah(reportStats.total)} masuk
                    </span>
                    <span className="w-1 h-1 rounded-full bg-white/60" />
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">trending_down</span>
                      {fmtRupiah(expenseStats.total)} keluar
                    </span>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">receipt_long</span>
                      {reportStats.count} unit
                    </span>
                    <span className="w-1 h-1 rounded-full bg-white/60" />
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">monitoring</span>
                      Rata-rata {fmtRupiah(reportStats.avg)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Periode Card */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 space-y-3">
            <SectionTitle
              icon="calendar_month"
              label="Periode Laporan"
              right={
                <button
                  onClick={handleRefresh}
                  disabled={reportLoading}
                  className="h-8 px-3 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center gap-1 transition disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {reportLoading ? 'hourglass_top' : 'refresh'}
                  </span>
                  {reportLoading ? 'Memuat' : 'Refresh'}
                </button>
              }
            />

            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
              {presetOptions.map((opt) =>
                opt.value === 'month' ? (
                  <MonthPresetChip
                    key={opt.value}
                    active={preset === 'month'}
                    months={availableMonths}
                    value={selectedMonth}
                    onSelect={setSelectedMonth}
                    onActivate={() => setPreset('month')}
                  />
                ) : (
                  <button
                    key={opt.value}
                    onClick={() => setPreset(opt.value)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      preset === opt.value
                        ? 'bg-primary text-white shadow-sm shadow-primary/30'
                        : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">{opt.icon}</span>
                    {opt.label}
                  </button>
                )
              )}
            </div>

            {preset === 'custom' && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[10px] text-on-surface-variant font-semibold uppercase block mb-1">
                    Dari
                  </label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="w-full h-10 px-3 bg-surface-container border border-outline-variant rounded-xl text-sm focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-on-surface-variant font-semibold uppercase block mb-1">
                    Sampai
                  </label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="w-full h-10 px-3 bg-surface-container border border-outline-variant rounded-xl text-sm focus:border-primary outline-none"
                  />
                </div>
              </div>
            )}

            {reportTab === 'transaksi' && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                <Dropdown
                  options={[
                    { value: 'all', label: 'Semua' },
                    { value: 'mobil', label: 'Mobil' },
                    { value: 'motor', label: 'Motor' },
                  ]}
                  value={reportFilters.type}
                  onChange={(v) => setReportFilters((f) => ({ ...f, type: v as any, model: 'all' }))}
                />
                <Dropdown
                  options={[
                    { value: 'all', label: 'Model' },
                    ...reportModelOptions.filter((m) => m !== 'all').map((m) => ({ value: m, label: m })),
                  ]}
                  value={reportFilters.model}
                  onChange={(v) => setReportFilters((f) => ({ ...f, model: v }))}
                />
                <Dropdown
                  options={[
                    { value: 'all', label: 'Layanan' },
                    ...reportLayananOptions.filter((l) => l !== 'all').map((l) => ({ value: l, label: l })),
                  ]}
                  value={reportFilters.layanan}
                  onChange={(v) => setReportFilters((f) => ({ ...f, layanan: v }))}
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-outline-variant/50">
              <span className="text-xs text-on-surface-variant font-medium">
                {reportLoading
                  ? 'Memuat data...'
                  : reportTab === 'transaksi'
                    ? `${reportFiltered.length} transaksi`
                    : `${expenseStats.filtered.length} pengeluaran`}
              </span>
              <span className="text-[11px] text-primary font-semibold">{periodeText}</span>
            </div>
          </div>

          {/* Sub-tab */}
          <div className="flex bg-surface-container-lowest border border-outline-variant rounded-xl p-1 gap-1">
            {(['transaksi', 'pengeluaran'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setReportTab(t)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  reportTab === t
                    ? 'bg-primary text-white shadow'
                    : 'text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {t === 'transaksi' ? 'payments' : 'receipt_long'}
                </span>
                {t === 'transaksi' ? 'Transaksi' : 'Pengeluaran'}
              </button>
            ))}
          </div>

          {/* ══ SUB-TAB: TRANSAKSI (TABEL) ══ */}
          {reportTab === 'transaksi' && (
            <div className="space-y-3">
              {/* Compact stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <StatCard
                  icon="receipt_long"
                  iconBg="bg-success-container"
                  iconColor="text-success"
                  label="Total Unit"
                  value={`${reportStats.count} unit`}
                  sub={fmtRupiah(reportStats.total)}
                />
                <StatCard
                  icon="monitoring"
                  iconBg="bg-tertiary-container"
                  iconColor="text-tertiary"
                  label="Rata-rata"
                  value={fmtRupiah(reportStats.avg)}
                  sub="per unit"
                />
                <StatCard
                  icon="directions_car"
                  iconBg="bg-secondary-container"
                  iconColor="text-primary"
                  label="Mobil"
                  value={`${reportStats.perTipe.mobil.count} unit`}
                  sub={fmtRupiah(reportStats.perTipe.mobil.total)}
                />
                <StatCard
                  icon="motorcycle"
                  iconBg="bg-error-container"
                  iconColor="text-error"
                  label="Motor"
                  value={`${reportStats.perTipe.motor.count} unit`}
                  sub={fmtRupiah(reportStats.perTipe.motor.total)}
                />
              </div>

              {/* Tabel Modern */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden">
                {/* Header + Show entries */}
                <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary">table_chart</span>
                    <h4 className="text-sm font-bold text-on-surface">Daftar Transaksi</h4>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant font-medium">
                    <span>Show</span>
                    <select
                      value={perPage}
                      onChange={(e) => setPerPage(Number(e.target.value))}
                      className="h-8 px-2 pr-6 bg-surface-container border border-outline-variant rounded-lg text-xs font-semibold text-on-surface focus:border-primary outline-none cursor-pointer"
                    >
                      {PER_PAGE_OPTIONS.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                    <span>data</span>
                  </div>
                </div>

                {/* Table */}
                {reportFiltered.length === 0 ? (
                  <div className="text-center py-12">
                    <span className="material-symbols-outlined text-[40px] text-on-surface-variant/40">
                      inbox
                    </span>
                    <p className="text-sm text-on-surface-variant mt-2">
                      Tidak ada transaksi di periode ini
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px]">
                      <thead>
                        <tr className="bg-surface-container/70 border-b border-outline-variant">
                          <th className="text-left text-[10px] font-bold text-on-surface-variant uppercase tracking-wider px-3 py-2.5 w-10">#</th>
                          <th className="text-left text-[10px] font-bold text-on-surface-variant uppercase tracking-wider px-3 py-2.5">Tanggal</th>
                          <th className="text-left text-[10px] font-bold text-on-surface-variant uppercase tracking-wider px-3 py-2.5">Plat</th>
                          <th className="text-left text-[10px] font-bold text-on-surface-variant uppercase tracking-wider px-3 py-2.5">Kendaraan</th>
                          <th className="text-left text-[10px] font-bold text-on-surface-variant uppercase tracking-wider px-3 py-2.5">Layanan</th>
                          <th className="text-left text-[10px] font-bold text-on-surface-variant uppercase tracking-wider px-3 py-2.5">Operator</th>
                          <th className="text-right text-[10px] font-bold text-on-surface-variant uppercase tracking-wider px-3 py-2.5">Harga</th>
                          <th className="text-left text-[10px] font-bold text-on-surface-variant uppercase tracking-wider px-3 py-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedData.map((tx, idx) => {
                          const s = STATUS_STYLE[tx.status] || STATUS_STYLE.Menunggu
                          const ops = tx.karyawan.split(',').map((n) => n.trim()).filter(Boolean)
                          const globalIdx = startIdx + idx + 1
                          return (
                            <tr
                              key={tx.id}
                              className="border-b border-outline-variant/50 last:border-0 hover:bg-surface-container/40 transition-colors"
                            >
                              <td className="px-3 py-2.5 text-xs text-on-surface-variant font-medium">
                                {globalIdx}
                              </td>
                              <td className="px-3 py-2.5 text-xs text-on-surface-variant whitespace-nowrap">
                                <div className="font-semibold text-on-surface">{formatDate(tx.waktu)}</div>
                                <div className="text-[10px] opacity-70">{formatTime(tx.waktu)}</div>
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <span className="text-xs font-extrabold text-on-surface tracking-wide">
                                  {tx.plat}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-xs">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`material-symbols-outlined text-[16px] icon-fill ${
                                      tx.tipe === 'mobil' ? 'text-primary' : 'text-error'
                                    }`}
                                  >
                                    {tx.tipe === 'mobil' ? 'directions_car' : 'motorcycle'}
                                  </span>
                                  <div className="min-w-0">
                                    <div className="font-semibold text-on-surface truncate">{tx.model}</div>
                                    {tx.type && (
                                      <div className="text-[10px] text-on-surface-variant truncate">{tx.type}</div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-semibold">
                                  {tx.layanan}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-xs">
                                {ops.length === 1 ? (
                                  <span className="font-medium text-on-surface">{ops[0]}</span>
                                ) : (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className="font-medium text-on-surface">{ops[0]}</span>
                                    <span className="text-[10px] text-amber-600 font-bold">
                                      +{ops.length - 1}
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-xs text-right whitespace-nowrap font-bold text-primary">
                                {fmtRupiah(tx.harga)}
                              </td>
                              <td className="px-3 py-2.5">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${s.bg} ${s.text}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                                  {tx.status}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination footer */}
                {reportFiltered.length > 0 && (
                  <div className="px-4 py-3 border-t border-outline-variant flex items-center justify-between gap-3 flex-wrap bg-surface-container/30">
                    <p className="text-xs text-on-surface-variant font-medium">
                      Menampilkan <span className="font-bold text-on-surface">{startIdx + 1}</span>–
                      <span className="font-bold text-on-surface">{endIdx}</span> dari{' '}
                      <span className="font-bold text-on-surface">{reportFiltered.length}</span>
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={safePage === 1}
                        className="h-8 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-xs font-semibold text-on-surface-variant flex items-center gap-1 hover:bg-surface-container active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none"
                      >
                        <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                        Prev
                      </button>
                      <span className="h-8 px-3 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center">
                        {safePage} / {totalPages}
                      </span>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={safePage === totalPages}
                        className="h-8 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-xs font-semibold text-on-surface-variant flex items-center gap-1 hover:bg-surface-container active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none"
                      >
                        Next
                        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ SUB-TAB: PENGELUARAN ══ */}
          {reportTab === 'pengeluaran' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  icon="money_off"
                  iconBg="bg-error-container"
                  iconColor="text-error"
                  label="Total Pengeluaran"
                  value={fmtRupiah(expenseStats.total)}
                />
                <StatCard
                  icon="receipt"
                  iconBg="bg-surface-container"
                  iconColor="text-on-surface-variant"
                  label="Jumlah Item"
                  value={`${expenseStats.count} item`}
                />
              </div>

              {expenseStats.topKategori.length > 0 && (
                <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
                  <SectionTitle icon="category" label="Pengeluaran per Kategori" />
                  <div className="space-y-3">
                    {expenseStats.topKategori.map(([kat, total]) => {
                      const pct = expenseStats.total > 0 ? Math.round((total / expenseStats.total) * 100) : 0
                      return (
                        <div key={kat}>
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="font-semibold text-on-surface">{kat}</span>
                            <span className="text-on-surface-variant font-medium">
                              {fmtRupiah(total)} <span className="opacity-70">({pct}%)</span>
                            </span>
                          </div>
                          <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
                            <div
                              className="h-full bg-error rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
                <SectionTitle
                  icon="list_alt"
                  label="Rincian Pengeluaran"
                  right={
                    <span className="text-[11px] text-on-surface-variant bg-surface-container px-2 py-1 rounded-full font-semibold">
                      {expenseStats.filtered.length} item
                    </span>
                  }
                />
                {expenseStats.filtered.length === 0 ? (
                  <div className="text-center py-6">
                    <span className="material-symbols-outlined text-[32px] text-on-surface-variant/40">
                      receipt_long
                    </span>
                    <p className="text-xs text-on-surface-variant mt-1">
                      Tidak ada pengeluaran di periode ini
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {expenseStats.filtered.map((e) => (
                      <div
                        key={e.id}
                        className="flex items-start justify-between gap-3 p-3 rounded-xl bg-surface-container/60"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-on-surface truncate">
                            {e.nama_pengeluaran}
                          </p>
                          <p className="text-[11px] text-on-surface-variant mt-0.5">
                            {e.kategori && (
                              <span className="px-1.5 py-0.5 rounded bg-error-container text-error font-semibold mr-1.5">
                                {e.kategori}
                              </span>
                            )}
                            {new Date(e.created_at).toLocaleDateString('id-ID', {
                              day: '2-digit', month: 'short', year: 'numeric',
                            })}
                          </p>
                          {e.keterangan && (
                            <p className="text-[11px] text-on-surface-variant/70 truncate mt-0.5">
                              {e.keterangan}
                            </p>
                          )}
                        </div>
                        <span className="text-sm font-bold text-error shrink-0">
                          -{fmtRupiah(e.nominal)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ═══════════════════ TAB RIWAYAT ═══════════════════ */
        <div className="space-y-4">
          {/* ═══ Note Antrian ═══ */}
          <div
            className={`rounded-2xl border p-4 transition-all ${
              antrian.total > 0
                ? 'bg-amber-500/10 border-amber-500/30'
                : 'bg-success-container/30 border-success/30'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                  antrian.total > 0 ? 'bg-amber-500/20' : 'bg-success/20'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[22px] icon-fill ${
                    antrian.total > 0 ? 'text-amber-600' : 'text-success'
                  }`}
                >
                  {antrian.total > 0 ? 'pending_actions' : 'task_alt'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-on-surface">
                  {antrian.total > 0
                    ? `${antrian.total} antrian perlu diselesaikan`
                    : 'Semua antrian selesai'}
                </p>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {antrian.total > 0
                    ? `${antrian.menunggu} menunggu · ${antrian.proses} sedang diproses`
                    : 'Kerja bagus! Tidak ada transaksi yang tertunda'}
                </p>
              </div>
              {antrian.total > 0 && (
                <span className="relative flex h-3 w-3 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-60" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                </span>
              )}
            </div>
          </div>

          {/* ═══ Filter Bar ═══ */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 space-y-3">
            <SectionTitle
              icon="filter_alt"
              label="Filter & Pencarian"
              right={
                hasActiveFilter ? (
                  <button
                    onClick={resetFilters}
                    className="h-7 px-2.5 rounded-full bg-error-container text-error text-[11px] font-semibold flex items-center gap-1 active:scale-95 transition-all"
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                    Reset
                  </button>
                ) : (
                  <span className="text-[11px] text-on-surface-variant font-medium">
                    {filteredTx.length} hasil
                  </span>
                )
              }
            />

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-[18px]">
                search
              </span>
              <input
                type="text"
                placeholder="Cari plat, model, tipe, atau operator..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-11 pl-10 pr-3 bg-surface-container border border-outline-variant rounded-xl text-sm font-medium focus:border-primary outline-none"
              />
            </div>

            <div className="flex gap-2">
              <Dropdown
                options={[
                  { value: 'all', label: 'Kendaraan' },
                  { value: 'mobil', label: 'Mobil' },
                  { value: 'motor', label: 'Motor' },
                ]}
                value={filterType}
                onChange={(v) => { setFilterType(v as any); setFilterModel('all') }}
                className="flex-1"
              />
              <Dropdown
                options={[
                  { value: 'all', label: 'Model' },
                  ...modelOptionsFilter.filter((m) => m !== 'all').map((m) => ({ value: m, label: m })),
                ]}
                value={filterModel}
                onChange={setFilterModel}
                className="flex-1"
              />
              <Dropdown
                options={[
                  { value: 'all', label: 'Layanan' },
                  ...layananOptions.filter((l) => l !== 'all').map((l) => ({ value: l, label: l })),
                ]}
                value={filterLayanan}
                onChange={setFilterLayanan}
                className="flex-1"
              />
            </div>

            {/* Status chips */}
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                  filterStatus === 'all'
                    ? 'bg-primary text-white'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                Semua ({filteredTx.length})
              </button>
              {(['Menunggu', 'Proses', 'Selesai'] as const).map((st) => {
                const s = STATUS_STYLE[st]
                const count =
                  st === 'Menunggu' ? historyStats.menunggu
                    : st === 'Proses' ? historyStats.proses
                      : historyStats.selesai
                const isActive = filterStatus === st
                return (
                  <button
                    key={st}
                    onClick={() => setFilterStatus(isActive ? 'all' : st)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
                      isActive
                        ? `${s.bg} ${s.text} ring-2 ring-offset-1 ring-current`
                        : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                    {st} ({count})
                  </button>
                )
              })}
            </div>
          </div>

          {/* ═══ List Transaksi (grouped by day) ═══ */}
          {filteredTx.length === 0 ? (
            <div className="text-center py-12 bg-surface-container-lowest border border-outline-variant rounded-2xl">
              <span className="material-symbols-outlined text-[48px] mb-2 block opacity-30">inbox</span>
              <p className="text-sm font-semibold text-on-surface">Tidak ada transaksi</p>
              <p className="text-xs text-on-surface-variant mt-1">
                Coba ubah filter atau reset pencarian
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {groupedTx.map((group) => (
                <div key={group.label} className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-primary">
                        calendar_today
                      </span>
                      <h4 className="text-xs font-bold text-on-surface uppercase tracking-wide">
                        {group.label}
                      </h4>
                      <span className="text-[11px] text-on-surface-variant font-medium">
                        · {group.items.length} transaksi
                      </span>
                    </div>
                    <span className="text-xs font-bold text-primary">
                      {fmtRupiah(group.total)}
                    </span>
                  </div>

                  {group.items.map((tx) => {
                    const s = STATUS_STYLE[tx.status] || STATUS_STYLE.Menunggu
                    const canAdvance = isAdmin && tx.status !== 'Selesai'
                    const operators = tx.karyawan.split(',').map((n) => n.trim()).filter(Boolean)
                    return (
                      <div
                        key={tx.id}
                        className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden"
                      >
                        <div className="p-4 flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div
                              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                                tx.tipe === 'mobil' ? 'bg-secondary-container' : 'bg-error-container'
                              }`}
                            >
                              <span
                                className={`material-symbols-outlined text-[22px] icon-fill ${
                                  tx.tipe === 'mobil' ? 'text-primary' : 'text-error'
                                }`}
                              >
                                {tx.tipe === 'mobil' ? 'directions_car' : 'motorcycle'}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-base font-extrabold text-on-surface tracking-wide">
                                {tx.plat}
                              </p>
                              <p className="text-xs text-on-surface-variant truncate">
                                {tx.model}
                                {tx.type && <span className="opacity-70"> · {tx.type}</span>}
                              </p>
                              <p className="text-[11px] text-outline mt-0.5 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px]">schedule</span>
                                {formatTime(tx.waktu)}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <p className="text-base font-extrabold text-primary leading-tight">
                              {fmtRupiah(tx.harga)}
                            </p>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold mt-1.5 ${s.bg} ${s.text}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                              {tx.status}
                            </span>
                          </div>
                        </div>

                        <div className="px-4 pb-3 flex items-center gap-3 flex-wrap text-[11px]">
                          <span className="flex items-center gap-1 text-on-surface-variant">
                            <span className="material-symbols-outlined text-[13px] text-primary">
                              water_drop
                            </span>
                            <span className="font-semibold">{tx.layanan}</span>
                          </span>
                          <span className="flex items-center gap-1 text-on-surface-variant">
                            <span className="material-symbols-outlined text-[13px]">group</span>
                            {operators.length > 1
                              ? `${operators.length} operator`
                              : operators[0] || '-'}
                          </span>
                          <span className="flex items-center gap-1 text-on-surface-variant">
                            <span className="material-symbols-outlined text-[13px]">payments</span>
                            {tx.bayar}
                          </span>
                          {operators.length > 1 && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 font-bold text-[10px]">
                              BARENGAN
                            </span>
                          )}
                        </div>

                        {operators.length > 1 && (
                          <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                            {operators.map((op) => (
                              <span
                                key={op}
                                className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold"
                              >
                                {op}
                              </span>
                            ))}
                          </div>
                        )}

                        {isAdmin && (
                          <div className="border-t border-outline-variant/50 px-4 py-2.5 flex items-center justify-between bg-surface-container/40">
                            <span className="text-[11px] text-on-surface-variant font-medium">
                              {formatDate(tx.waktu)}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openEditModal(tx)}
                                className="h-8 px-3 rounded-lg bg-yellow-400/15 text-yellow-700 text-[11px] font-bold flex items-center gap-1 active:scale-95 transition-all"
                              >
                                <span className="material-symbols-outlined text-[14px]">edit</span>
                                Edit
                              </button>
                              {canAdvance && (
                                <button
                                  onClick={() => handleAdvanceStatus(tx.id, tx.status)}
                                  disabled={updatingId === tx.id}
                                  className="h-8 px-3 rounded-lg bg-primary text-white text-[11px] font-bold flex items-center gap-1 active:scale-95 transition-all disabled:opacity-50"
                                >
                                  {updatingId === tx.id ? (
                                    <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                  ) : (
                                    <span className="material-symbols-outlined text-[14px]">
                                      arrow_forward
                                    </span>
                                  )}
                                  {tx.status === 'Menunggu' ? 'Proses' : 'Selesai'}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ Floating Export ═══ */}
      {isAdmin && activeTab === 'report' && (
        <button
          onClick={exportHandler}
          disabled={reportLoading || exportCount === 0}
          className={`fixed bottom-24 right-4 z-30 h-12 pl-4 pr-5 rounded-full shadow-xl flex items-center gap-2 font-semibold text-sm text-white active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none ${
            reportTab === 'transaksi' ? 'bg-success shadow-success/30' : 'bg-error shadow-error/30'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          Ekspor ({exportCount})
        </button>
      )}

      {/* ═══ MODAL EDIT TRANSAKSI ═══ */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full sm:max-w-lg bg-surface-container-lowest border border-outline-variant rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-surface-container-lowest border-b border-outline-variant px-6 py-4 flex items-center justify-between rounded-t-3xl z-10">
              <h3 className="text-lg font-bold text-on-surface">Edit Transaksi</h3>
              <button
                onClick={() => setEditingTx(null)}
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[20px] text-on-surface-variant">close</span>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide block mb-2">
                  Jenis Kendaraan
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-surface-container rounded-2xl">
                  {(['mobil', 'motor'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => { setEditVehicleType(type); setEditModel(''); setEditOperators([]) }}
                      className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all ${
                        editVehicleType === type ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {type === 'mobil' ? 'directions_car' : 'motorcycle'}
                      </span>
                      {type === 'mobil' ? 'Mobil' : 'Motor'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide block mb-1">
                  Nomor Plat
                </label>
                <input
                  type="text"
                  placeholder="B 1234 XYZ"
                  value={editPlate}
                  onChange={(e) => setEditPlate(e.target.value.toUpperCase().slice(0, 10))}
                  className="w-full h-12 px-4 bg-surface-container border-2 border-outline-variant rounded-xl text-lg font-extrabold tracking-widest uppercase focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide block mb-2">
                  Model
                </label>
                <div className="flex flex-wrap gap-2">
                  {modelOptions.length === 0 ? (
                    <p className="text-sm text-on-surface-variant">Belum ada data model</p>
                  ) : (
                    modelOptions.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setEditModel(m)}
                        className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-all ${
                          editModel === m
                            ? 'bg-primary text-white shadow-md'
                            : 'bg-surface-container border border-outline-variant text-on-surface-variant'
                        }`}
                      >
                        {m}
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide block mb-1">
                  Tipe / Merk
                </label>
                <input
                  type="text"
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  maxLength={50}
                  placeholder={editVehicleType === 'mobil' ? 'Innova, Avanza...' : 'Scoopy, Vario...'}
                  className="w-full h-11 px-4 bg-surface-container border-2 border-outline-variant rounded-xl text-sm focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide block mb-2">
                  Layanan
                </label>
                <div className="space-y-2">
                  {layananItems.map((item) => (
                    <label
                      key={item.key}
                      className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-colors ${
                        editLayanan === item.key ? 'border-primary bg-primary/5' : 'border-outline-variant'
                      }`}
                    >
                      <input
                        type="radio"
                        name="edit-layanan"
                        value={item.key}
                        checked={editLayanan === item.key}
                        onChange={() => setEditLayanan(item.key)}
                        className="w-4 h-4 accent-primary"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{item.label}</p>
                        <p className="text-xs text-on-surface-variant">{item.sub}</p>
                      </div>
                      <span className="text-sm font-bold text-primary">
                        Rp {(editPrices[item.key] ?? 0).toLocaleString('id-ID')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div ref={editDropdownRef}>
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide block mb-2">
                  Operator
                </label>
                <div className="relative">
                  <div
                    onClick={() => setEditDropdownOpen(!editDropdownOpen)}
                    className="w-full min-h-[48px] px-4 py-2 bg-surface-container-lowest border-2 border-outline-variant rounded-xl cursor-pointer flex items-center flex-wrap gap-1.5"
                  >
                    {editOperators.length === 0 ? (
                      <span className="text-on-surface-variant text-sm">Pilih operator...</span>
                    ) : (
                      editOperators.map((op) => (
                        <span
                          key={op}
                          className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-sm font-medium"
                        >
                          {op}
                          {editVehicleType === 'mobil' && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); toggleEditOperator(op) }}
                              className="w-4 h-4 rounded-full flex items-center justify-center"
                            >
                              <span className="material-symbols-outlined text-[12px]">close</span>
                            </button>
                          )}
                        </span>
                      ))
                    )}
                    <span className="ml-auto material-symbols-outlined text-[20px] text-on-surface-variant">
                      {editDropdownOpen ? 'expand_less' : 'expand_more'}
                    </span>
                  </div>
                  {editDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg max-h-52 overflow-y-auto py-1">
                      {operatorOptions.map((op) => (
                        <label
                          key={op.nama}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container cursor-pointer"
                        >
                          <input
                            type={editVehicleType === 'motor' ? 'radio' : 'checkbox'}
                            name={editVehicleType === 'motor' ? 'edit-op' : undefined}
                            checked={editOperators.includes(op.nama)}
                            onChange={() => toggleEditOperator(op.nama)}
                            className="w-4 h-4 accent-primary"
                          />
                          <span className="text-sm font-medium">{op.nama}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-on-surface-variant mt-1">
                  {editVehicleType === 'motor' ? 'Pilih 1 operator' : 'Bisa pilih beberapa'}
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide block mb-2">
                  Metode Bayar
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {bayarItems.map((item) => (
                    <label
                      key={item.key}
                      className={`flex flex-col items-center gap-1.5 p-3 border-2 rounded-xl cursor-pointer text-center transition-colors ${
                        editBayar === item.key ? 'bg-primary-container border-primary' : 'border-outline-variant'
                      }`}
                    >
                      <input
                        type="radio"
                        name="edit-bayar"
                        value={item.key}
                        checked={editBayar === item.key}
                        onChange={() => setEditBayar(item.key)}
                        className="hidden"
                      />
                      <span
                        className={`material-symbols-outlined text-[22px] ${
                          editBayar === item.key ? 'text-primary icon-fill' : 'text-on-surface-variant'
                        }`}
                      >
                        {item.icon}
                      </span>
                      <span
                        className={`text-xs ${
                          editBayar === item.key ? 'font-semibold text-primary' : 'text-on-surface-variant'
                        }`}
                      >
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs text-on-surface-variant">Total</p>
                    <h3 className="text-2xl font-extrabold text-primary">
                      Rp {(editPrices[editLayanan] ?? 0).toLocaleString('id-ID')}
                    </h3>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-white icon-fill">sell</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setEditingTx(null)}
                  className="flex-1 h-12 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface-variant"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 h-12 rounded-xl bg-primary text-white text-sm font-semibold shadow-lg shadow-primary/20 active:scale-95 transition"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function LaporanPage() {
  return (
    <Guard allowedRoles={['admin', 'guest']}>
      <LaporanContent />
    </Guard>
  )
}