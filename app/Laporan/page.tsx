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
    year: 'numeric',
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
    second: '2-digit',
    hour12: false,
  }).format(date)
}

function fmtDateInput(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

const presetOptions: { value: PresetKey; label: string }[] = [
  { value: 'today', label: 'Hari Ini' },
  { value: '7d', label: '7 Hari' },
  { value: 'month', label: 'Bulan Ini' },
  { value: 'all', label: 'Semua' },
  { value: 'custom', label: 'Custom' },
]

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

// ─── Preset date range ───────────────────────────────────────────────────────
function monthRangeFromValue(value: string): { from: string; to: string } {
  const [y, m] = value.split('-').map(Number)
  const start = new Date(y, m - 1, 1)
  const end = new Date(y, m, 0) // hari terakhir bulan tsb
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

// Bangun daftar bulan yang benar-benar punya data, dari transaksi tertua s/d terbaru.
// Diurutkan dari terbaru ke terlama, supaya default pilihan = bulan paling baru yang ada datanya.
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
        className="h-9 w-full px-3 pr-8 bg-surface-container border border-outline-variant rounded-full text-sm font-medium flex items-center justify-between gap-1 hover:bg-surface-container-highest transition-colors focus:outline-none"
      >
        <span className="truncate">{label}</span>
        <span className="material-symbols-outlined text-[18px] text-on-surface-variant absolute right-2">
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full min-w-[160px] bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg py-1 max-h-52 overflow-y-auto">
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

// ─── Chip "Bulan Ini" yang dropdown-nya nempel langsung di chip itu sendiri ──
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

  // Klik di luar tombol ATAU di luar popover → tutup
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

  // Scroll/resize saat popover terbuka → tutup, biar gak nongkrong di posisi basi
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
        className={`flex-shrink-0 flex items-center gap-1 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
          active ? 'bg-primary text-white shadow-md' : 'bg-surface-container text-on-surface-variant border border-outline-variant hover:bg-surface-container-high'
        }`}
      >
        {active && label ? label : 'Bulan Ini'}
        <span className="material-symbols-outlined text-[16px]">{open ? 'expand_less' : 'expand_more'}</span>
      </button>

      {/* position: fixed + z-index tertinggi → selalu di layer paling atas, gak ketutup/kepotong elemen lain */}
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
  icon, iconBg, iconColor, label, value,
}: { icon: string; iconBg: string; iconColor: string; label: string; value: string }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
      <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center mb-3`}>
        <span className={`material-symbols-outlined ${iconColor} text-[18px] icon-fill`}>{icon}</span>
      </div>
      <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wide">{label}</p>
      <h3 className="text-base font-extrabold mt-0.5 text-on-surface truncate">{value}</h3>
    </div>
  )
}

// ─── Section divider ──────────────────────────────────────────────────────────
function SectionTitle({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="material-symbols-outlined text-[18px] text-primary">{icon}</span>
      <h4 className="text-sm font-bold text-on-surface">{label}</h4>
    </div>
  )
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

  // ── Tabs ──
  const [activeTab, setActiveTab] = useState<'history' | 'report'>('history')

  // ── History filters ──
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'mobil' | 'motor'>('all')
  const [filterModel, setFilterModel] = useState('all')
  const [filterLayanan, setFilterLayanan] = useState('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // ── Report state ──
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

  // ── Dropdown "Bulan Ini" (diisi otomatis dari data transaksi di DB) ──
  const [availableMonths, setAvailableMonths] = useState<{ value: string; label: string }[]>([])
  const [selectedMonth, setSelectedMonth] = useState('')
  const monthsLoadedRef = useRef(false)
  const currentMonthLabel = useMemo(
    () => availableMonths.find((m) => m.value === selectedMonth)?.label ?? '',
    [availableMonths, selectedMonth]
  )

  // ── Report sub-tab ──
  const [reportTab, setReportTab] = useState<'transaksi' | 'pengeluaran'>('transaksi')

  // ── Edit modal ──
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

  // ── Load report (transaksi sesuai periode) ──
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

  // Sekali masuk tab Laporan: ambil daftar bulan yang tersedia + pengeluaran.
  // Tidak diulang tiap ganti preset, supaya tidak ada fetch dobel yang bikin lambat.
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

  // Muat ulang data transaksi tiap periode berubah.
  useEffect(() => {
    if (activeTab !== 'report') return
    if (preset === 'month' && !selectedMonth) return // tunggu daftar bulan siap dulu
    loadReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, preset, selectedMonth, customFrom, customTo])

  // ── History filter options ──
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
      if (search.trim()) {
        const q = search.toLowerCase()
        return tx.plat.toLowerCase().includes(q) ||
          tx.model.toLowerCase().includes(q) ||
          (tx.type ?? '').toLowerCase().includes(q)
      }
      return true
    })
  }, [transactions, filterType, filterModel, filterLayanan, search])

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

  const reportTopKaryawan = useMemo(() => {
    const summary: Record<string, { total: number; sendiri: number; bareng: number; pendapatan: number }> = {}
    reportFiltered.forEach((tx) => {
      const ops = tx.karyawan.split(',').map((n) => n.trim()).filter(Boolean)
      const bagian = (tx.harga || 0) / (ops.length || 1)
      ops.forEach((name) => {
        if (!summary[name]) summary[name] = { total: 0, sendiri: 0, bareng: 0, pendapatan: 0 }
        summary[name].total++
        summary[name].pendapatan += bagian
        if (ops.length === 1) summary[name].sendiri++
        else summary[name].bareng++
      })
    })
    return Object.entries(summary).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.total - a.total)
  }, [reportFiltered])

  // ── Expense stats (filter by same period, dihitung di client) ──
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

  // ── Report dropdown options (khusus sub-tab Transaksi) ──
  const reportModelOptions = useMemo(() => {
    const v = reportFilters.type === 'all' ? vehiclesDB : vehiclesDB.filter((v) => v.tipe === reportFilters.type)
    return ['all', ...new Set(v.map((v) => v.name))]
  }, [vehiclesDB, reportFilters.type])
  const reportLayananOptions = useMemo(() => {
    const u = new Set(reportData.map((tx) => tx.layanan).filter(Boolean))
    return ['all', ...Array.from(u)]
  }, [reportData])

  // ── Periode label helper ──
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

  // ── Handle advance status ──
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

  // ── Export Excel: TRANSAKSI (terfilter) ──
  const exportToExcel = async () => {
    if (!isAdmin) return
    if (reportFiltered.length === 0) { showToast('Tidak ada data untuk diekspor!', false); return }
    try {
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()

      // Info filter aktif untuk keterangan
      const filterParts: string[] = []
      if (reportFilters.type !== 'all') filterParts.push(`Jenis: ${reportFilters.type === 'mobil' ? 'Mobil' : 'Motor'}`)
      if (reportFilters.model !== 'all') filterParts.push(`Model: ${reportFilters.model}`)
      if (reportFilters.layanan !== 'all') filterParts.push(`Layanan: ${reportFilters.layanan}`)
      const filterInfo = filterParts.length > 0 ? ` | Filter: ${filterParts.join(', ')}` : ''

      const addSheet = (data: (Transaction & { id: string })[], name: string) => {
        const ws = wb.addWorksheet(name)

        // Title row
        ws.mergeCells('A1:L1')
        const titleCell = ws.getCell('A1')
        titleCell.value = `LAPORAN TRANSAKSI - ${periodeText.toUpperCase()}${filterInfo ? ' | ' + filterInfo : ''}`
        titleCell.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }
        ws.getRow(1).height = 26
        ws.getRow(2).height = 6

        // Header row (row 3)
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

        // Total row
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

  // ── Export Excel: PENGELUARAN (terfilter) ──
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

      // Title row
      ws.mergeCells('A1:F1')
      const titleCell = ws.getCell('A1')
      titleCell.value = `LAPORAN PENGELUARAN - ${periodeText.toUpperCase()}`
      titleCell.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } }
      ws.getRow(1).height = 26
      ws.getRow(2).height = 6

      // Header row (row 3)
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

      // Total row
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

  const hasActiveFilter = search !== '' || filterType !== 'all' || filterModel !== 'all' || filterLayanan !== 'all'
  const resetFilters = () => { setSearch(''); setFilterType('all'); setFilterModel('all'); setFilterLayanan('all') }

  const exportCount = reportTab === 'transaksi' ? reportFiltered.length : expenseStats.filtered.length
  const exportHandler = reportTab === 'transaksi' ? exportToExcel : exportExpensesToExcel

  return (
    <div className="space-y-5 pb-24">
      <Toast {...toast} onHide={() => setToast((t) => ({ ...t, visible: false }))} />

      {/* Page Header */}
      <div>
        <h2 className="text-[22px] font-extrabold text-on-surface">Riwayat & Laporan</h2>
        <p className="text-sm text-on-surface-variant mt-0.5">Pantau semua transaksi dan performa</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex bg-surface-container-lowest border border-outline-variant rounded-2xl p-1 gap-1">
        {(['history', 'report'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === tab ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            {tab === 'history' ? 'Riwayat Transaksi' : 'Laporan'}
          </button>
        ))}
      </div>

      {/* ═══════════════════ TAB LAPORAN ═══════════════════ */}
      {activeTab === 'report' ? (
        <div className="space-y-4">
          {/* ── Periode Card ── */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 space-y-3">
            <SectionTitle icon="calendar_month" label="Periode Laporan" />

            {/* Chip row */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
              {presetOptions.map((opt) => (
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
                    className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                      preset === opt.value
                        ? 'bg-primary text-white shadow-md'
                        : 'bg-surface-container text-on-surface-variant border border-outline-variant hover:bg-surface-container-high'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              ))}
            </div>

            {/* Custom range inputs */}
            {preset === 'custom' && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[10px] text-on-surface-variant font-semibold uppercase block mb-1">Dari</label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="w-full h-10 px-3 bg-surface-container border border-outline-variant rounded-xl text-sm focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-on-surface-variant font-semibold uppercase block mb-1">Sampai</label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="w-full h-10 px-3 bg-surface-container border border-outline-variant rounded-xl text-sm focus:border-primary outline-none"
                  />
                </div>
              </div>
            )}

            {/* Filter tambahan - HANYA untuk sub-tab Transaksi */}
            {reportTab === 'transaksi' && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                <Dropdown
                  options={[{ value: 'all', label: 'Semua' }, { value: 'mobil', label: 'Mobil' }, { value: 'motor', label: 'Motor' }]}
                  value={reportFilters.type}
                  onChange={(v) => setReportFilters((f) => ({ ...f, type: v as any, model: 'all' }))}
                />
                <Dropdown
                  options={[{ value: 'all', label: 'Model' }, ...reportModelOptions.filter((m) => m !== 'all').map((m) => ({ value: m, label: m }))]}
                  value={reportFilters.model}
                  onChange={(v) => setReportFilters((f) => ({ ...f, model: v }))}
                />
                <Dropdown
                  options={[{ value: 'all', label: 'Layanan' }, ...reportLayananOptions.filter((l) => l !== 'all').map((l) => ({ value: l, label: l }))]}
                  value={reportFilters.layanan}
                  onChange={(v) => setReportFilters((f) => ({ ...f, layanan: v }))}
                />
              </div>
            )}

            {/* Footer info */}
            <div className="flex items-center justify-between pt-1 border-t border-outline-variant/50">
              <span className="text-xs text-on-surface-variant">
                {reportLoading
                  ? 'Memuat data...'
                  : reportTab === 'transaksi'
                    ? `${reportFiltered.length} transaksi`
                    : `${expenseStats.filtered.length} pengeluaran`}
              </span>
              <button
                onClick={handleRefresh}
                disabled={reportLoading}
                className="h-8 px-3 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center gap-1 transition disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                Refresh
              </button>
            </div>
          </div>

          {/* ── Report sub-tab ── */}
          <div className="flex bg-surface-container-lowest border border-outline-variant rounded-xl p-1 gap-1">
            {(['transaksi', 'pengeluaran'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setReportTab(t)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  reportTab === t ? 'bg-primary text-white shadow' : 'text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {t === 'transaksi' ? 'payments' : 'receipt_long'}
                </span>
                {t === 'transaksi' ? 'Transaksi' : 'Pengeluaran'}
              </button>
            ))}
          </div>

          {/* ══ SUB-TAB: TRANSAKSI ══ */}
          {reportTab === 'transaksi' && (
            <div className="space-y-4">
              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                <StatCard icon="trending_up" iconBg="bg-secondary-container" iconColor="text-primary" label="Total Pendapatan" value={fmtRupiah(reportStats.total)} />
                <StatCard icon="receipt_long" iconBg="bg-success-container" iconColor="text-success" label="Unit Dicuci" value={`${reportStats.count} unit`} />
                <StatCard icon="monitoring" iconBg="bg-tertiary-container" iconColor="text-tertiary" label="Rata-rata" value={fmtRupiah(reportStats.avg)} />
                <StatCard icon="star" iconBg="bg-error-container" iconColor="text-error" label="Terpopuler" value={reportStats.populer ? `${reportStats.populer[0]}` : '-'} />
              </div>

              {/* Mobil vs Motor */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-primary text-[20px] icon-fill">directions_car</span>
                    <p className="text-xs font-semibold text-on-surface">Mobil</p>
                  </div>
                  <p className="text-sm font-extrabold text-on-surface">{reportStats.perTipe.mobil.count} unit</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">{fmtRupiah(reportStats.perTipe.mobil.total)}</p>
                </div>
                <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-error text-[20px] icon-fill">motorcycle</span>
                    <p className="text-xs font-semibold text-on-surface">Motor</p>
                  </div>
                  <p className="text-sm font-extrabold text-on-surface">{reportStats.perTipe.motor.count} unit</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">{fmtRupiah(reportStats.perTipe.motor.total)}</p>
                </div>
              </div>

              {/* Top operator */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <SectionTitle icon="emoji_events" label="Top Operator" />
                  <span className="text-xs text-on-surface-variant bg-surface-container px-2 py-1 rounded-full">
                    {reportStats.count} unit
                  </span>
                </div>
                {reportTopKaryawan.length > 0 ? (
                  <div className="space-y-3">
                    {reportTopKaryawan.slice(0, 3).map((item, i) => (
                      <div key={item.name} className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-slate-100 text-slate-600' : 'bg-orange-100 text-orange-700'
                        }`}>
                          #{i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-on-surface truncate">{item.name}</p>
                          <p className="text-[11px] text-on-surface-variant">
                            Sendiri: {item.sendiri} · Bareng: {item.bareng}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-on-surface">{item.total} unit</p>
                          <p className="text-[11px] text-primary">{fmtRupiah(Math.round(item.pendapatan))}</p>
                        </div>
                      </div>
                    ))}
                    {reportTopKaryawan.length > 3 && (
                      <p className="text-xs text-on-surface-variant text-center">+{reportTopKaryawan.length - 3} lainnya</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-on-surface-variant">Belum ada data</p>
                )}
              </div>
            </div>
          )}

          {/* ══ SUB-TAB: PENGELUARAN ══ */}
          {reportTab === 'pengeluaran' && (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-3">
                <StatCard icon="money_off" iconBg="bg-error-container" iconColor="text-error" label="Total Pengeluaran" value={fmtRupiah(expenseStats.total)} />
                <StatCard icon="receipt" iconBg="bg-surface-container" iconColor="text-on-surface-variant" label="Jumlah Transaksi" value={`${expenseStats.count} item`} />
              </div>

              {/* Net profit card */}
              <div className={`rounded-2xl p-4 border ${netProfit >= 0 ? 'bg-success-container/30 border-success/30' : 'bg-error-container/30 border-error/30'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`material-symbols-outlined text-[20px] icon-fill ${netProfit >= 0 ? 'text-success' : 'text-error'}`}>
                    {netProfit >= 0 ? 'trending_up' : 'trending_down'}
                  </span>
                  <p className="text-xs font-semibold text-on-surface">Laba Bersih (Pendapatan – Pengeluaran)</p>
                </div>
                <p className={`text-xl font-extrabold ${netProfit >= 0 ? 'text-success' : 'text-error'}`}>
                  {netProfit >= 0 ? '' : '-'}{fmtRupiah(Math.abs(netProfit))}
                </p>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {fmtRupiah(reportStats.total)} pendapatan · {fmtRupiah(expenseStats.total)} pengeluaran
                </p>
              </div>

              {/* By kategori */}
              {expenseStats.topKategori.length > 0 && (
                <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
                  <SectionTitle icon="category" label="Pengeluaran per Kategori" />
                  <div className="space-y-2">
                    {expenseStats.topKategori.map(([kat, total]) => {
                      const pct = expenseStats.total > 0 ? Math.round((total / expenseStats.total) * 100) : 0
                      return (
                        <div key={kat}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium text-on-surface">{kat}</span>
                            <span className="text-on-surface-variant">{fmtRupiah(total)} ({pct}%)</span>
                          </div>
                          <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
                            <div className="h-full bg-error rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* List pengeluaran */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
                <SectionTitle icon="list_alt" label={`Rincian (${expenseStats.filtered.length} item)`} />
                {expenseStats.filtered.length === 0 ? (
                  <p className="text-xs text-on-surface-variant">Tidak ada pengeluaran di periode ini</p>
                ) : (
                  <div className="space-y-2">
                    {expenseStats.filtered.map((e) => (
                      <div key={e.id} className="flex items-start justify-between gap-3 py-2 border-b border-outline-variant/30 last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-on-surface truncate">{e.nama_pengeluaran}</p>
                          <p className="text-[11px] text-on-surface-variant">
                            {e.kategori && <span>{e.kategori} · </span>}
                            {new Date(e.created_at).toLocaleDateString('id-ID')}
                          </p>
                          {e.keterangan && <p className="text-[11px] text-on-surface-variant/70 truncate">{e.keterangan}</p>}
                        </div>
                        <span className="text-sm font-bold text-error shrink-0">
                          {fmtRupiah(e.nominal)}
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
        <>
          {/* Filter bar */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-3 space-y-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-[18px]">search</span>
              <input
                type="text"
                placeholder="Cari plat, model, atau tipe..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 bg-surface-container border border-outline-variant rounded-full text-sm focus:border-primary outline-none"
              />
            </div>
            <div className="flex gap-2">
              <Dropdown
                options={[{ value: 'all', label: 'Kendaraan' }, { value: 'mobil', label: 'Mobil' }, { value: 'motor', label: 'Motor' }]}
                value={filterType}
                onChange={(v) => { setFilterType(v as any); setFilterModel('all') }}
                className="flex-1"
              />
              <Dropdown
                options={[{ value: 'all', label: 'Model' }, ...modelOptionsFilter.filter((m) => m !== 'all').map((m) => ({ value: m, label: m }))]}
                value={filterModel}
                onChange={setFilterModel}
                className="flex-1"
              />
              <Dropdown
                options={[{ value: 'all', label: 'Layanan' }, ...layananOptions.filter((l) => l !== 'all').map((l) => ({ value: l, label: l }))]}
                value={filterLayanan}
                onChange={setFilterLayanan}
                className="flex-1"
              />
              {hasActiveFilter && (
                <button
                  onClick={resetFilters}
                  className="h-9 w-9 shrink-0 flex items-center justify-center bg-error-container text-error rounded-full active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-[18px]">filter_list_off</span>
                </button>
              )}
            </div>
          </div>

          {/* Transaction list */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-bold text-on-surface">Daftar Transaksi</h4>
              <span className="text-xs text-on-surface-variant bg-surface-container px-2 py-1 rounded-full">{filteredTx.length} data</span>
            </div>

            {filteredTx.length === 0 ? (
              <div className="text-center py-12 text-on-surface-variant text-sm bg-surface-container-lowest border border-outline-variant rounded-2xl">
                <span className="material-symbols-outlined text-[40px] mb-2 block opacity-40">inbox</span>
                Tidak ada transaksi
              </div>
            ) : (
              filteredTx.map((tx) => {
                const statusIndex = ['Menunggu', 'Proses', 'Selesai'].indexOf(tx.status)
                const canAdvance = isAdmin && tx.status !== 'Selesai'
                return (
                  <div key={tx.id} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 flex flex-col gap-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tx.tipe === 'mobil' ? 'bg-secondary-container' : 'bg-error-container'}`}>
                          <span className={`material-symbols-outlined text-[20px] icon-fill ${tx.tipe === 'mobil' ? 'text-primary' : 'text-error'}`}>
                            {tx.tipe === 'mobil' ? 'directions_car' : 'motorcycle'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-on-surface">{tx.plat}</p>
                          <p className="text-xs text-on-surface-variant">
                            {tx.model}{tx.type && <span className="opacity-70"> · {tx.type}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1.5">
                        <p className="text-sm font-extrabold text-primary">{fmtRupiah(tx.harga)}</p>
                        <div className="flex items-center gap-1.5">
                          <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                            statusIndex === 2 ? 'bg-success-container text-success'
                              : statusIndex === 1 ? 'bg-tertiary-container text-tertiary'
                              : 'bg-error-container text-error'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              statusIndex === 2 ? 'bg-success' : statusIndex === 1 ? 'bg-tertiary' : 'bg-error'
                            }`} />
                            {tx.status}
                          </span>
                          {canAdvance && (
                            <button
                              onClick={() => handleAdvanceStatus(tx.id, tx.status)}
                              disabled={updatingId === tx.id}
                              className="w-6 h-6 flex items-center justify-center rounded-full bg-primary active:scale-90 transition-all disabled:opacity-50"
                            >
                              {updatingId === tx.id
                                ? <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                : <span className="material-symbols-outlined text-white" style={{ fontSize: '14px' }}>arrow_forward_ios</span>
                              }
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => openEditModal(tx)}
                              className="w-6 h-6 flex items-center justify-center rounded-full bg-yellow-400 active:scale-90 transition-all"
                            >
                              <span className="material-symbols-outlined text-white" style={{ fontSize: '14px' }}>edit</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-outline-variant/50 pt-2 mt-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs text-on-surface-variant flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">water_drop</span>{tx.layanan}
                        </span>
                        <span className="text-xs text-on-surface-variant flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">person</span>{tx.karyawan.split(' ')[0]}
                        </span>
                        <span className="text-xs text-outline flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">payments</span>{tx.bayar}
                        </span>
                      </div>
                      <div className="text-right text-[11px] text-outline leading-tight">
                        <div>{formatDate(tx.waktu)}</div>
                        <div>{formatTime(tx.waktu)}</div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </>
      )}

      {/* ─── Tombol Ekspor Excel (floating, selalu kejangkau) ─────────────── */}
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

      {/* ─── MODAL EDIT TRANSAKSI ──────────────────────────────────────────── */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full sm:max-w-lg bg-surface-container-lowest border border-outline-variant rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
            {/* Modal header */}
            <div className="sticky top-0 bg-surface-container-lowest border-b border-outline-variant px-6 py-4 flex items-center justify-between rounded-t-3xl">
              <h3 className="text-lg font-bold text-on-surface">Edit Transaksi</h3>
              <button onClick={() => setEditingTx(null)} className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px] text-on-surface-variant">close</span>
              </button>
            </div>
            <div className="p-6 space-y-5">
              {/* Jenis kendaraan */}
              <div>
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide block mb-2">Jenis Kendaraan</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-surface-container rounded-2xl">
                  {(['mobil', 'motor'] as const).map((type) => (
                    <button key={type} type="button"
                      onClick={() => { setEditVehicleType(type); setEditModel(''); setEditOperators([]) }}
                      className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all ${
                        editVehicleType === type ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">{type === 'mobil' ? 'directions_car' : 'motorcycle'}</span>
                      {type === 'mobil' ? 'Mobil' : 'Motor'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Plat */}
              <div>
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide block mb-1">Nomor Plat</label>
                <input type="text" placeholder="B 1234 XYZ" value={editPlate}
                  onChange={(e) => setEditPlate(e.target.value.toUpperCase().slice(0, 10))}
                  className="w-full h-12 px-4 bg-surface-container border-2 border-outline-variant rounded-xl text-lg font-extrabold tracking-widest uppercase focus:border-primary transition-colors"
                />
              </div>

              {/* Model */}
              <div>
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide block mb-2">Model</label>
                <div className="flex flex-wrap gap-2">
                  {modelOptions.length === 0
                    ? <p className="text-sm text-on-surface-variant">Belum ada data model</p>
                    : modelOptions.map((m) => (
                      <button key={m} type="button" onClick={() => setEditModel(m)}
                        className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-all ${
                          editModel === m ? 'bg-primary text-white shadow-md' : 'bg-surface-container border border-outline-variant text-on-surface-variant'
                        }`}
                      >{m}</button>
                    ))
                  }
                </div>
              </div>

              {/* Tipe/Merk */}
              <div>
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide block mb-1">Tipe / Merk</label>
                <input type="text" value={editType} onChange={(e) => setEditType(e.target.value)} maxLength={50}
                  placeholder={editVehicleType === 'mobil' ? 'Innova, Avanza...' : 'Scoopy, Vario...'}
                  className="w-full h-11 px-4 bg-surface-container border-2 border-outline-variant rounded-xl text-sm focus:border-primary transition-colors"
                />
              </div>

              {/* Layanan */}
              <div>
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide block mb-2">Layanan</label>
                <div className="space-y-2">
                  {layananItems.map((item) => (
                    <label key={item.key}
                      className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-colors ${
                        editLayanan === item.key ? 'border-primary bg-primary/5' : 'border-outline-variant'
                      }`}
                    >
                      <input type="radio" name="edit-layanan" value={item.key}
                        checked={editLayanan === item.key} onChange={() => setEditLayanan(item.key)}
                        className="w-4 h-4 accent-primary"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{item.label}</p>
                        <p className="text-xs text-on-surface-variant">{item.sub}</p>
                      </div>
                      <span className="text-sm font-bold text-primary">Rp {(editPrices[item.key] ?? 0).toLocaleString('id-ID')}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Operator */}
              <div ref={editDropdownRef}>
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide block mb-2">Operator</label>
                <div className="relative">
                  <div onClick={() => setEditDropdownOpen(!editDropdownOpen)}
                    className="w-full min-h-[48px] px-4 py-2 bg-surface-container-lowest border-2 border-outline-variant rounded-xl cursor-pointer flex items-center flex-wrap gap-1.5"
                  >
                    {editOperators.length === 0
                      ? <span className="text-on-surface-variant text-sm">Pilih operator...</span>
                      : editOperators.map((op) => (
                        <span key={op} className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-sm font-medium">
                          {op}
                          {editVehicleType === 'mobil' && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); toggleEditOperator(op) }}
                              className="w-4 h-4 rounded-full flex items-center justify-center">
                              <span className="material-symbols-outlined text-[12px]">close</span>
                            </button>
                          )}
                        </span>
                      ))
                    }
                    <span className="ml-auto material-symbols-outlined text-[20px] text-on-surface-variant">
                      {editDropdownOpen ? 'expand_less' : 'expand_more'}
                    </span>
                  </div>
                  {editDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg max-h-52 overflow-y-auto py-1">
                      {operatorOptions.map((op) => (
                        <label key={op.nama} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container cursor-pointer">
                          <input type={editVehicleType === 'motor' ? 'radio' : 'checkbox'}
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

              {/* Metode bayar */}
              <div>
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide block mb-2">Metode Bayar</label>
                <div className="grid grid-cols-3 gap-2">
                  {bayarItems.map((item) => (
                    <label key={item.key}
                      className={`flex flex-col items-center gap-1.5 p-3 border-2 rounded-xl cursor-pointer text-center transition-colors ${
                        editBayar === item.key ? 'bg-primary-container border-primary' : 'border-outline-variant'
                      }`}
                    >
                      <input type="radio" name="edit-bayar" value={item.key}
                        checked={editBayar === item.key} onChange={() => setEditBayar(item.key)} className="hidden"
                      />
                      <span className={`material-symbols-outlined text-[22px] ${editBayar === item.key ? 'text-primary icon-fill' : 'text-on-surface-variant'}`}>{item.icon}</span>
                      <span className={`text-xs ${editBayar === item.key ? 'font-semibold text-primary' : 'text-on-surface-variant'}`}>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs text-on-surface-variant">Total</p>
                    <h3 className="text-2xl font-extrabold text-primary">Rp {(editPrices[editLayanan] ?? 0).toLocaleString('id-ID')}</h3>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-white icon-fill">sell</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button onClick={() => setEditingTx(null)}
                  className="flex-1 h-12 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface-variant">
                  Batal
                </button>
                <button onClick={handleSaveEdit}
                  className="flex-1 h-12 rounded-xl bg-primary text-white text-sm font-semibold shadow-lg shadow-primary/20 active:scale-95 transition">
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