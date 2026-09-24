'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useAppStore, useUser } from '@/lib/Store'
import Toast from '@/components/ui/Toast'
import BottomNavbar from '@/components/layout/ButtomNav'
import type { Expense } from '@/lib/Data'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtRupiah(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID')
}

function parseRupiah(s: string): number {
  return parseInt(s.replace(/\./g, ''), 10) || 0
}

function formatRupiah(value: string): string {
  const angka = value.replace(/\D/g, '')
  return angka.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

function fmtDateInput(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

// ─── Period filter types ───────────────────────────────────────────────────
type PresetKey = 'today' | 'month' | 'custom' | 'all'

const presetOptions: { value: PresetKey; label: string }[] = [
  { value: 'today', label: 'Hari Ini' },
  { value: 'month', label: 'Bulan Ini' },
  { value: 'custom', label: 'Custom' },
  { value: 'all', label: 'Semua' },
]

function monthRangeFromValue(value: string): { from: string; to: string } {
  const [y, m] = value.split('-').map(Number)
  const start = new Date(y, m - 1, 1)
  const end = new Date(y, m, 0)
  return { from: fmtDateInput(start), to: fmtDateInput(end) }
}

// Ambil daftar bulan yang benar-benar ada datanya dari list expenses (client-side)
function getAvailableMonths(expenses: Expense[]): { value: string; label: string }[] {
  const set = new Set<string>()
  expenses.forEach((e) => {
    const d = new Date(e.created_at)
    set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  })
  return Array.from(set)
    .sort((a, b) => (a < b ? 1 : -1)) // terbaru dulu
    .map((v) => {
      const [y, m] = v.split('-').map(Number)
      return { value: v, label: `${MONTH_NAMES[m - 1]} ${y}` }
    })
}

function getPeriodRange(
  preset: PresetKey,
  selectedMonth: string,
  customFrom: string,
  customTo: string
): { from?: string; to?: string } {
  const now = new Date()
  switch (preset) {
    case 'today':
      return { from: fmtDateInput(now), to: fmtDateInput(now) }
    case 'month':
      if (!selectedMonth) return {}
      return monthRangeFromValue(selectedMonth)
    case 'custom':
      return { from: customFrom || undefined, to: customTo || undefined }
    case 'all':
    default:
      return {}
  }
}

// ─── Chip "Bulan Ini" dengan dropdown popover (sama seperti di Laporan) ──────
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
        className={`flex-shrink-0 flex items-center gap-1 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
          active ? 'bg-primary text-white shadow-md' : 'bg-surface-container text-on-surface-variant border border-outline-variant hover:bg-surface-container-high'
        }`}
      >
        {active && label ? label : 'Bulan Ini'}
        <span className="material-symbols-outlined text-[16px]">{open ? 'expand_less' : 'expand_more'}</span>
      </button>

      {open && pos && (
        <div
          ref={popRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
          className="z-[100] w-48 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-2xl py-1 max-h-56 overflow-y-auto"
        >
          {months.length === 0 ? (
            <p className="px-4 py-2 text-xs text-on-surface-variant">Belum ada data</p>
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

// ─── Blank form ───────────────────────────────────────────────────────────────
const blankForm = { nama: '', kategori: '', nominal: '', keterangan: '' }

// ─── Kategori tetap (fixed list) ──────────────────────────────────────────────
const KATEGORI_OPTIONS = [
  { value: 'Operasional', icon: 'bolt', desc: 'Listrik, air, makan, bensin, dll' },
  { value: 'Obat', icon: 'medication', desc: 'Obat & kebutuhan medis' },
  { value: 'Sabun', icon: 'soap', desc: 'Sabun & bahan cuci' },
  { value: 'Perlengkapan', icon: 'build', desc: 'Alat & perlengkapan kerja' },
  { value: 'Gaji', icon: 'payments', desc: 'Gaji & bonus karyawan' },
]
const KATEGORI_VALUES = KATEGORI_OPTIONS.map((k) => k.value)

// ─── Expense Form ─────────────────────────────────────────────────────────────
function ExpenseForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial?: typeof blankForm
  onSubmit: (data: typeof blankForm) => void
  onCancel?: () => void
  submitting: boolean
}) {
  const [form, setForm] = useState(initial ?? blankForm)

  const initialIsCustom = !!initial?.kategori && !KATEGORI_VALUES.includes(initial.kategori)
  const [kategoriMode, setKategoriMode] = useState<'preset' | 'custom'>(
    initialIsCustom ? 'custom' : 'preset'
  )
  const [errors, setErrors] = useState<{ nama?: boolean; kategori?: boolean; nominal?: boolean }>({})

  const set = (key: keyof typeof blankForm, val: string) => setForm((f) => ({ ...f, [key]: val }))

  const validate = () => {
    const nextErrors = {
      nama: !form.nama.trim(),
      kategori: !form.kategori.trim(),
      nominal: !parseRupiah(form.nominal) || parseRupiah(form.nominal) <= 0,
    }
    setErrors(nextErrors)
    return !nextErrors.nama && !nextErrors.kategori && !nextErrors.nominal
  }

  const handleSubmitClick = () => {
    if (!validate()) return
    onSubmit(form)
  }

  return (
    <div className="space-y-3">
      {/* Nama */}
      <div>
        <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide block mb-1">
          Nama Pengeluaran <span className="text-error">*</span>
        </label>
        <input
          type="text"
          value={form.nama}
          onChange={(e) => set('nama', e.target.value)}
          placeholder="Contoh: Beli sabun, bayar listrik..."
          className={`w-full h-11 px-4 bg-surface-container border rounded-xl text-sm focus:border-primary outline-none transition-colors ${
            errors.nama ? 'border-error' : 'border-outline-variant'
          }`}
        />
        {errors.nama && <p className="text-[11px] text-error mt-1">Nama pengeluaran wajib diisi</p>}
      </div>

      {/* Kategori */}
      <div>
        <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide block mb-1">
          Kategori <span className="text-error">*</span>
        </label>

        {kategoriMode === 'preset' ? (
          <div className="grid grid-cols-2 gap-2">
            {KATEGORI_OPTIONS.map((k) => {
              const active = form.kategori === k.value
              return (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => set('kategori', k.value)}
                  className={`flex items-center gap-2 h-11 px-3 rounded-xl border text-left transition-colors ${
                    active
                      ? 'bg-primary-container border-primary text-primary'
                      : 'bg-surface-container border-outline-variant text-on-surface-variant'
                  }`}
                >
                  <span className={`material-symbols-outlined text-[18px] ${active ? 'icon-fill' : ''}`}>
                    {k.icon}
                  </span>
                  <span className="text-sm font-semibold truncate">{k.value}</span>
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => {
                setKategoriMode('custom')
                set('kategori', '')
              }}
              className="flex items-center justify-center gap-1.5 h-11 px-3 rounded-xl border border-dashed border-outline-variant text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span className="text-sm font-semibold">Kategori Baru</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              autoFocus
              value={form.kategori}
              onChange={(e) => set('kategori', e.target.value)}
              placeholder="Ketik nama kategori baru"
              className={`w-full h-11 px-4 bg-surface-container border rounded-xl text-sm focus:border-primary outline-none transition-colors ${
                errors.kategori ? 'border-error' : 'border-outline-variant'
              }`}
            />
            <button
              type="button"
              onClick={() => {
                setKategoriMode('preset')
                set('kategori', '')
              }}
              className="text-xs font-semibold text-primary flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Pilih dari kategori tetap
            </button>
          </div>
        )}

        {errors.kategori && <p className="text-[11px] text-error mt-1">Kategori wajib dipilih</p>}
        {kategoriMode === 'preset' && form.kategori && (
          <p className="text-[11px] text-on-surface-variant mt-1">
            {KATEGORI_OPTIONS.find((k) => k.value === form.kategori)?.desc}
          </p>
        )}
      </div>

      {/* Nominal */}
      <div>
        <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide block mb-1">
          Nominal <span className="text-error">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-on-surface-variant">Rp</span>
          <input
            type="text"
            value={form.nominal}
            onChange={(e) => set('nominal', formatRupiah(e.target.value))}
            placeholder="0"
            inputMode="numeric"
            className={`w-full h-11 pl-10 pr-4 bg-surface-container border rounded-xl text-sm font-semibold focus:border-primary outline-none transition-colors ${
              errors.nominal ? 'border-error' : 'border-outline-variant'
            }`}
          />
        </div>
        {errors.nominal && <p className="text-[11px] text-error mt-1">Nominal harus angka lebih dari 0</p>}
      </div>

      {/* Keterangan */}
      <div>
        <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide block mb-1">Keterangan</label>
        <input
          type="text"
          value={form.keterangan}
          onChange={(e) => set('keterangan', e.target.value)}
          placeholder="Opsional — catatan tambahan"
          className="w-full h-11 px-4 bg-surface-container border border-outline-variant rounded-xl text-sm focus:border-primary outline-none transition-colors"
        />
      </div>

      {/* Actions */}
      <div className={`flex gap-2 ${onCancel ? '' : 'pt-1'}`}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-11 bg-surface-container border border-outline-variant rounded-xl text-sm font-semibold text-on-surface-variant"
          >
            Batal
          </button>
        )}
        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmitClick}
          className="flex-1 h-11 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 active:scale-95 transition disabled:opacity-50"
        >
          {submitting ? 'Menyimpan...' : onCancel ? 'Simpan' : 'Tambah Pengeluaran'}
        </button>
      </div>
    </div>
  )
}

// ─── Kategori color map ───────────────────────────────────────────────────────
const KAT_COLORS: Record<string, string> = {
  Operasional: 'bg-blue-100 text-blue-700',
  Obat: 'bg-red-100 text-red-700',
  Sabun: 'bg-cyan-100 text-cyan-700',
  Perlengkapan: 'bg-purple-100 text-purple-700',
  Gaji: 'bg-green-100 text-green-700',
  Peralatan: 'bg-purple-100 text-purple-700',
  'Bahan Kimia': 'bg-fuchsia-100 text-fuchsia-700',
  Bensin: 'bg-orange-100 text-orange-700',
  Snack: 'bg-lime-100 text-lime-700',
  Listrik: 'bg-yellow-100 text-yellow-700',
  Lainnya: 'bg-surface-container text-on-surface-variant',
}
function katColor(kat?: string | null) {
  if (!kat) return 'bg-surface-container text-on-surface-variant'
  return KAT_COLORS[kat] ?? 'bg-surface-container text-on-surface-variant'
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PengeluaranPage() {
  const { expenses, fetchExpenses, addExpense, deleteExpense, updateExpense, loading, initialized, initStore } = useAppStore()
  const user = useUser()
  const isAdmin = user?.role === 'admin'

  const [storeReady, setStoreReady] = useState(false)
  const [toast, setToast] = useState({ visible: false, message: '', success: true })
  const showToast = (message: string, success = true) => setToast({ visible: true, message, success })

  // Form state
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // Edit modal
  const [editingExp, setEditingExp] = useState<Expense | null>(null)
  const [editSubmitting, setEditSubmitting] = useState(false)

  // Delete modal
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  // Filter/search
  const [search, setSearch] = useState('')
  const [filterKat, setFilterKat] = useState('all')

  // ── Period filter ──
  const [preset, setPreset] = useState<PresetKey>('all')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const availableMonths = useMemo(() => getAvailableMonths(expenses), [expenses])
  const currentMonthLabel = useMemo(
    () => availableMonths.find((m) => m.value === selectedMonth)?.label ?? '',
    [availableMonths, selectedMonth]
  )

  // Set default bulan (paling baru) begitu daftar bulan siap & belum ada yang dipilih
  useEffect(() => {
    if (preset === 'month' && !selectedMonth && availableMonths.length > 0) {
      setSelectedMonth(availableMonths[0].value)
    }
  }, [preset, selectedMonth, availableMonths])

  // ── Init ──
  useEffect(() => {
    const init = async () => {
      if (!initialized) await initStore()
      setStoreReady(true)
    }
    init()
  }, [initialized, initStore])

  useEffect(() => {
    if (storeReady) fetchExpenses()
  }, [storeReady, fetchExpenses])

  // ── Period-filtered expenses (dasar untuk summary & list) ──
  const periodFiltered = useMemo(() => {
    const { from, to } = getPeriodRange(preset, selectedMonth, customFrom, customTo)
    if (!from && !to) return expenses
    return expenses.filter((e) => {
      const d = new Date(e.created_at)
      if (from && d < new Date(`${from}T00:00:00+07:00`)) return false
      if (to && d > new Date(`${to}T23:59:59.999+07:00`)) return false
      return true
    })
  }, [expenses, preset, selectedMonth, customFrom, customTo])

  // ── Summary ──
  const summary = useMemo(() => {
    const total = periodFiltered.reduce((s, e) => s + e.nominal, 0)
    const byKat: Record<string, number> = {}
    periodFiltered.forEach((e) => {
      const k = e.kategori || 'Lainnya'
      byKat[k] = (byKat[k] || 0) + e.nominal
    })
    const topKat = Object.entries(byKat).sort((a, b) => b[1] - a[1])[0]
    return { total, topKat }
  }, [periodFiltered])

  // ── Filter kategori (dari data periode aktif) ──
  const allKategori = useMemo(() => {
    const s = new Set(periodFiltered.map((e) => e.kategori || 'Lainnya'))
    return Array.from(s).sort()
  }, [periodFiltered])

  const filtered = useMemo(() => {
    return periodFiltered.filter((e) => {
      if (filterKat !== 'all' && (e.kategori || 'Lainnya') !== filterKat) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return e.nama_pengeluaran.toLowerCase().includes(q) ||
          (e.kategori || '').toLowerCase().includes(q) ||
          (e.keterangan || '').toLowerCase().includes(q)
      }
      return true
    })
  }, [periodFiltered, search, filterKat])

  // Reset filter kategori kalau kategori yang lagi aktif gak ada lagi di periode baru
  useEffect(() => {
    if (filterKat !== 'all' && !allKategori.includes(filterKat)) setFilterKat('all')
  }, [allKategori, filterKat])

  // ── Handlers ──
  const handleAdd = async (form: typeof blankForm) => {
    if (!form.nama.trim()) { showToast('Nama pengeluaran wajib diisi', false); return }
    if (!form.kategori.trim()) { showToast('Kategori wajib dipilih', false); return }
    const nominal = parseRupiah(form.nominal)
    if (!nominal || nominal <= 0) { showToast('Nominal harus angka positif', false); return }
    setAddSubmitting(true)
    try {
      await addExpense({
        nama_pengeluaran: form.nama.trim(),
        kategori: form.kategori.trim(),
        nominal,
        keterangan: form.keterangan.trim() || null,
      })
      setShowForm(false)
      showToast('Pengeluaran berhasil ditambahkan!')
    } catch (err: any) {
      showToast(err.message || 'Gagal menambahkan', false)
    } finally {
      setAddSubmitting(false)
    }
  }

  const handleEdit = async (form: typeof blankForm) => {
    if (!editingExp) return
    if (!form.nama.trim()) { showToast('Nama pengeluaran wajib diisi', false); return }
    if (!form.kategori.trim()) { showToast('Kategori wajib dipilih', false); return }
    const nominal = parseRupiah(form.nominal)
    if (!nominal || nominal <= 0) { showToast('Nominal harus angka positif', false); return }
    setEditSubmitting(true)
    try {
      await updateExpense(editingExp.id, {
        nama_pengeluaran: form.nama.trim(),
        kategori: form.kategori.trim(),
        nominal,
        keterangan: form.keterangan.trim() || null,
      })
      setEditingExp(null)
      showToast('Pengeluaran berhasil diperbarui!')
    } catch (err: any) {
      showToast(err.message || 'Gagal memperbarui', false)
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleteSubmitting(true)
    try {
      await deleteExpense(deleteId)
      showToast('Data pengeluaran dihapus')
      setDeleteId(null)
    } catch (err: any) {
      showToast(err.message || 'Gagal hapus', false)
    } finally {
      setDeleteSubmitting(false)
    }
  }

  // ── Loading ──
  if (!storeReady) {
    return (
      <div className="flex flex-col min-h-screen bg-surface">
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-on-surface-variant">Memuat data...</p>
          </div>
        </main>
        <BottomNavbar />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <main className="flex-1 p-4 pb-28 space-y-4">
        <Toast
          visible={toast.visible}
          message={toast.message}
          success={toast.success}
          onHide={() => setToast((t) => ({ ...t, visible: false }))}
        />

        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[22px] font-extrabold text-on-surface">Pengeluaran</h1>
            <p className="text-sm text-on-surface-variant mt-0.5">Catat semua pengeluaran toko</p>
          </div>
          {isAdmin && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="h-10 px-4 bg-primary text-white rounded-2xl text-sm font-semibold flex items-center gap-1.5 shadow-lg shadow-primary/20 active:scale-95 transition"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Tambah
            </button>
          )}
          {!isAdmin && (
            <span className="bg-amber-50 text-amber-700 text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">visibility</span>Guest
            </span>
          )}
        </div>

        {/* ── Filter Periode ── */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-3 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-[16px] text-primary">calendar_month</span>
            <p className="text-xs font-bold text-on-surface">
              Periode {preset === 'month' && currentMonthLabel ? `· ${currentMonthLabel}` : ''}
            </p>
          </div>
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

          {/* Custom range */}
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
        </div>

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
            <div className="w-8 h-8 rounded-xl bg-error-container flex items-center justify-center mb-2">
              <span className="material-symbols-outlined text-error text-[16px] icon-fill">money_off</span>
            </div>
            <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wide">Total Pengeluaran</p>
            <p className="text-base font-extrabold text-error mt-0.5">{fmtRupiah(summary.total)}</p>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
            <div className="w-8 h-8 rounded-xl bg-primary-container flex items-center justify-center mb-2">
              <span className="material-symbols-outlined text-primary text-[16px] icon-fill">category</span>
            </div>
            <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wide">Terbesar</p>
            <p className="text-sm font-extrabold text-on-surface mt-0.5 truncate">
              {summary.topKat ? summary.topKat[0] : '-'}
            </p>
            {summary.topKat && (
              <p className="text-[11px] text-on-surface-variant">{fmtRupiah(summary.topKat[1])}</p>
            )}
          </div>
        </div>

        {/* ── Form Tambah (collapsible) ── */}
        {isAdmin && showForm && (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-on-surface">Tambah Pengeluaran</h2>
              <button onClick={() => setShowForm(false)} className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">close</span>
              </button>
            </div>
            <ExpenseForm onSubmit={handleAdd} onCancel={() => setShowForm(false)} submitting={addSubmitting} />
          </div>
        )}

        {/* ── Filter / search ── */}
        <div className="space-y-2">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-[18px]">search</span>
            <input
              type="text"
              placeholder="Cari pengeluaran..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-3 bg-surface-container border border-outline-variant rounded-full text-sm focus:border-primary outline-none transition-colors"
            />
          </div>
          {allKategori.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
              <button
                onClick={() => setFilterKat('all')}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  filterKat === 'all' ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant border border-outline-variant'
                }`}
              >
                Semua
              </button>
              {allKategori.map((k) => (
                <button
                  key={k}
                  onClick={() => setFilterKat(filterKat === k ? 'all' : k)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    filterKat === k ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant border border-outline-variant'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── List ── */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-bold text-on-surface">Riwayat Pengeluaran</h2>
            <span className="text-xs text-on-surface-variant bg-surface-container px-2 py-1 rounded-full">
              {filtered.length} item
            </span>
          </div>

          {loading.expenses ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 bg-surface-container-lowest border border-outline-variant rounded-2xl text-on-surface-variant">
              <span className="material-symbols-outlined text-[40px] block mb-2 opacity-40">receipt_long</span>
              <p className="text-sm">{expenses.length === 0 ? 'Belum ada pengeluaran' : 'Tidak ditemukan di periode ini'}</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((exp) => (
                <li key={exp.id} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-on-surface">{exp.nama_pengeluaran}</p>
                        {exp.kategori && (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${katColor(exp.kategori)}`}>
                            {exp.kategori}
                          </span>
                        )}
                      </div>
                      {exp.keterangan && (
                        <p className="text-xs text-on-surface-variant mt-0.5 truncate">{exp.keterangan}</p>
                      )}
                      <p className="text-[11px] text-outline mt-1">{fmtDate(exp.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-extrabold text-error">{fmtRupiah(exp.nominal)}</span>
                      {isAdmin && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => setEditingExp(exp)}
                            className="w-8 h-8 rounded-xl bg-surface-container flex items-center justify-center hover:bg-primary-container hover:text-primary transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                          <button
                            onClick={() => setDeleteId(exp.id)}
                            className="w-8 h-8 rounded-xl bg-surface-container flex items-center justify-center hover:bg-error-container hover:text-error transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      {/* ─── MODAL EDIT ────────────────────────────────────────────────────── */}
      {editingExp && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setEditingExp(null)}
        >
          <div className="w-full sm:max-w-md bg-surface-container-lowest rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant sticky top-0 bg-surface-container-lowest rounded-t-3xl">
              <h3 className="text-base font-bold text-on-surface">Edit Pengeluaran</h3>
              <button onClick={() => setEditingExp(null)} className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px] text-on-surface-variant">close</span>
              </button>
            </div>
            <div className="p-6">
              <ExpenseForm
                initial={{
                  nama: editingExp.nama_pengeluaran,
                  kategori: editingExp.kategori || '',
                  nominal: formatRupiah(editingExp.nominal.toString()),
                  keterangan: editingExp.keterangan || '',
                }}
                onSubmit={handleEdit}
                onCancel={() => setEditingExp(null)}
                submitting={editSubmitting}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL HAPUS ─────────────────────────────────────────────────────── */}
      {deleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && !deleteSubmitting && setDeleteId(null)}
        >
          <div className="w-full max-w-sm bg-surface-container-lowest rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-error-container flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-error text-[28px]">delete_forever</span>
              </div>
              <h3 className="text-base font-bold text-on-surface mb-1">Hapus Pengeluaran?</h3>
              <p className="text-sm text-on-surface-variant">Tindakan ini tidak dapat dibatalkan.</p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => !deleteSubmitting && setDeleteId(null)}
                className="flex-1 h-11 bg-surface-container border border-outline-variant rounded-xl text-sm font-semibold text-on-surface-variant"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteSubmitting}
                className="flex-1 h-11 bg-error text-white rounded-xl font-bold text-sm active:scale-95 transition disabled:opacity-50"
              >
                {deleteSubmitting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNavbar />
    </div>
  )
}