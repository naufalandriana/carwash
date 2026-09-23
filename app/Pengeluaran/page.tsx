'use client'

import { useState, useEffect, useMemo } from 'react'
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

// ─── Blank form ───────────────────────────────────────────────────────────────
const blankForm = { nama: '', kategori: '', nominal: '', keterangan: '' }

// ─── Kategori suggestions ─────────────────────────────────────────────────────
const KATEGORI_SUGGESTIONS = ['Peralatan', 'Bahan Kimia', 'Bensin', 'Snack', 'Listrik', 'Lainnya']

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
  const [showKatSuggest, setShowKatSuggest] = useState(false)

  const set = (key: keyof typeof blankForm, val: string) => setForm((f) => ({ ...f, [key]: val }))

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
          className="w-full h-11 px-4 bg-surface-container border border-outline-variant rounded-xl text-sm focus:border-primary outline-none transition-colors"
        />
      </div>

      {/* Kategori */}
      <div className="relative">
        <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide block mb-1">Kategori</label>
        <input
          type="text"
          value={form.kategori}
          onChange={(e) => set('kategori', e.target.value)}
          onFocus={() => setShowKatSuggest(true)}
          onBlur={() => setTimeout(() => setShowKatSuggest(false), 150)}
          placeholder="Pilih atau ketik kategori"
          className="w-full h-11 px-4 bg-surface-container border border-outline-variant rounded-xl text-sm focus:border-primary outline-none transition-colors"
        />
        {showKatSuggest && (
          <div className="absolute z-10 w-full mt-1 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg py-1">
            {KATEGORI_SUGGESTIONS.filter((k) =>
              !form.kategori || k.toLowerCase().includes(form.kategori.toLowerCase())
            ).map((k) => (
              <button
                key={k}
                onMouseDown={() => set('kategori', k)}
                className="w-full text-left px-4 py-2 text-sm hover:bg-surface-container text-on-surface"
              >
                {k}
              </button>
            ))}
          </div>
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
            className="w-full h-11 pl-10 pr-4 bg-surface-container border border-outline-variant rounded-xl text-sm font-semibold focus:border-primary outline-none transition-colors"
          />
        </div>
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
          onClick={() => onSubmit(form)}
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
  Peralatan: 'bg-blue-100 text-blue-700',
  'Bahan Kimia': 'bg-purple-100 text-purple-700',
  Bensin: 'bg-orange-100 text-orange-700',
  Snack: 'bg-green-100 text-green-700',
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

  // ── Summary ──
  const summary = useMemo(() => {
    const total = expenses.reduce((s, e) => s + e.nominal, 0)
    const byKat: Record<string, number> = {}
    expenses.forEach((e) => {
      const k = e.kategori || 'Lainnya'
      byKat[k] = (byKat[k] || 0) + e.nominal
    })
    const topKat = Object.entries(byKat).sort((a, b) => b[1] - a[1])[0]
    return { total, topKat }
  }, [expenses])

  // ── Filter ──
  const allKategori = useMemo(() => {
    const s = new Set(expenses.map((e) => e.kategori || 'Lainnya'))
    return Array.from(s).sort()
  }, [expenses])

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (filterKat !== 'all' && (e.kategori || 'Lainnya') !== filterKat) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return e.nama_pengeluaran.toLowerCase().includes(q) ||
          (e.kategori || '').toLowerCase().includes(q) ||
          (e.keterangan || '').toLowerCase().includes(q)
      }
      return true
    })
  }, [expenses, search, filterKat])

  // ── Handlers ──
  const handleAdd = async (form: typeof blankForm) => {
    if (!form.nama.trim()) { showToast('Nama pengeluaran wajib diisi', false); return }
    const nominal = parseRupiah(form.nominal)
    if (!nominal || nominal <= 0) { showToast('Nominal harus angka positif', false); return }
    setAddSubmitting(true)
    try {
      await addExpense({
        nama_pengeluaran: form.nama.trim(),
        kategori: form.kategori.trim() || null,
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
    const nominal = parseRupiah(form.nominal)
    if (!nominal || nominal <= 0) { showToast('Nominal harus angka positif', false); return }
    setEditSubmitting(true)
    try {
      await updateExpense(editingExp.id, {
        nama_pengeluaran: form.nama.trim(),
        kategori: form.kategori.trim() || null,
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
              <p className="text-sm">{expenses.length === 0 ? 'Belum ada pengeluaran' : 'Tidak ditemukan'}</p>
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