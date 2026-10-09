'use client'

import { useState, useMemo } from 'react'
import { useAppStore, useStaff, useTransactions, useUser } from '@/lib/Store'
import Toast from '@/components/ui/Toast'
import Guard from '@/components/auth/Guard'

// ═══════════════════════════════════════════════════════════
// KONFIGURASI GAJI
// ═══════════════════════════════════════════════════════════
/**
 * Aturan komisi operator:
 * - Tiap transaksi, 40% dari harga = jatah semua operator (kolam komisi).
 * - Motor : 1 operator  → dapat seluruh 40%.
 * - Mobil : bisa >1 operator → 40% dibagi rata ke semua operator yang nyuci.
 * Jadi total gaji per transaksi selalu 40% dari harga.
 * Ubah nilai ini kalau tarif komisi berubah.
 */
const COMMISSION_RATE = 0.4
const COMMISSION_PERCENT = Math.round(COMMISSION_RATE * 100)

const COLOR_PALETTE = [
  'bg-primary', 'bg-success', 'bg-error', 'bg-amber-500',
  'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-cyan-500',
  'bg-emerald-500', 'bg-rose-500', 'bg-violet-500', 'bg-fuchsia-500'
]

const getRandomColor = () => COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)]

const VALID_COLOR_FORMAT = /^bg-(primary|success|error)$|^bg-[a-z]+-(50|100|200|300|400|500|600|700|800|900|950)$/
const getSafeColor = (color?: string) =>
  color && VALID_COLOR_FORMAT.test(color) ? color : 'bg-primary'

const getInitialsFromNama = (nama: string) => {
  const words = nama.trim().split(' ').filter(Boolean)
  return words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : nama.slice(0, 2).toUpperCase()
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

const formatRupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n || 0)

/** Ambil harga transaksi dari berbagai kemungkinan nama field */
const getTxPrice = (tx: any): number => {
  const raw =
    tx.harga ?? tx.total ?? tx.totalHarga ?? tx.hargaTotal ??
    tx.totalBayar ?? tx.bayar ?? tx.jumlah ?? tx.price ?? tx.amount ?? 0
  const n = Number(raw)
  return isNaN(n) ? 0 : n
}

/** Ambil tanggal transaksi dari berbagai kemungkinan nama field */
const getTxDate = (tx: any): Date | null => {
  const raw =
    tx.tanggal ?? tx.date ?? tx.createdAt ?? tx.created_at ??
    tx.timestamp ?? tx.waktu ?? tx.tgl ?? null
  if (!raw) return null
  const d = raw instanceof Date ? raw : new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

/** Pecah field karyawan jadi array nama */
const getTxOperators = (tx: any): string[] => {
  const raw = tx.karyawan ?? tx.operator ?? ''
  return String(raw).split(',').map(k => k.trim()).filter(Boolean)
}

const getTxJenis = (tx: any): string =>
  tx.jenis ?? tx.jenisKendaraan ?? tx.kategori ?? tx.tipe ?? tx.type ?? ''

const getJenisLabel = (tx: any): string => {
  const j = String(getTxJenis(tx)).toLowerCase()
  if (j.includes('motor')) return 'Motor'
  if (j.includes('mobil') || j.includes('car')) return 'Mobil'
  const raw = getTxJenis(tx)
  return raw ? String(raw) : 'Cucian'
}

const formatDateShort = (d: Date | null): string => {
  if (!d) return 'Tanpa tanggal'
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const formatDateLong = (d: Date | null): string => {
  if (!d) return 'Tanpa tanggal'
  return d.toLocaleDateString('id-ID', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ═══════════════════════════════════════════════════════════
// TIPE & KONSTANTA
// ═══════════════════════════════════════════════════════════

type Period = 'today' | '7d' | '30d' | 'all'

const PERIODS: { key: Period; label: string; icon: string }[] = [
  { key: 'today', label: 'Hari Ini', icon: 'today' },
  { key: '7d',    label: '7 Hari',   icon: 'date_range' },
  { key: '30d',   label: '30 Hari',  icon: 'calendar_month' },
  { key: 'all',   label: 'Semua',    icon: 'all_inclusive' },
]

interface DetailRow {
  txId: string
  tanggal: Date | null
  harga: number
  komisi: number
  rekan: string[]
  jenisLabel: string
  isBarengan: boolean
  jumlahOperator: number
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════

function OperatorContent() {
  const { addStaff, updateStaff, deleteStaff } = useAppStore()
  const allStaff = useStaff()
  const transactions = useTransactions()
  const user = useUser()
  const isAdmin = user?.role === 'admin'

  const [showForm, setShowForm] = useState(false)
  const [nama, setNama] = useState('')
  const [toast, setToast] = useState({ visible: false, message: '', success: true })

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNama, setEditNama] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nama: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Payroll state
  const [period, setPeriod] = useState<Period>('today')
  const [detailTarget, setDetailTarget] = useState<any | null>(null)

  const showToast = (msg: string, success = true) =>
    setToast({ visible: true, message: msg, success })

  const operators = useMemo(
    () => allStaff.filter(s => s.jabatan === 'Operator'),
    [allStaff]
  )

  // ── Filter transaksi berdasarkan periode ──
  const periodTransactions = useMemo(() => {
    if (period === 'all') return transactions

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

    let startTime: number
    if (period === 'today') startTime = startOfToday
    else if (period === '7d') startTime = startOfToday - 6 * 86400000
    else startTime = startOfToday - 29 * 86400000

    return transactions.filter(tx => {
      const d = getTxDate(tx)
      return d !== null && d.getTime() >= startTime
    })
  }, [transactions, period])

  // ── Hitung gaji + rincian per operator ──
  const operatorSalaries = useMemo(() => {
    return operators.map(op => {
      const details: DetailRow[] = []

      periodTransactions.forEach(tx => {
        const list = getTxOperators(tx)
        if (!list.includes(op.nama)) return

        const harga = getTxPrice(tx)
        const jumlahOperator = list.length
        // 40% dari harga = kolam komisi, dibagi rata ke semua operator di transaksi ini
        const komisi = Math.floor((harga * COMMISSION_RATE) / jumlahOperator)
        const rekan = list.filter(k => k !== op.nama)

        details.push({
          txId: String(tx.id ?? `${op.nama}-${details.length}`),
          tanggal: getTxDate(tx),
          harga,
          komisi,
          rekan,
          jenisLabel: getJenisLabel(tx),
          isBarengan: jumlahOperator > 1,
          jumlahOperator,
        })
      })

      // Urutkan transaksi terbaru dulu
      details.sort((a, b) => (b.tanggal?.getTime() ?? 0) - (a.tanggal?.getTime() ?? 0))

      const totalGaji = details.reduce((s, d) => s + d.komisi, 0)
      const totalHarga = details.reduce((s, d) => s + d.harga, 0)
      const sendiri = details.filter(d => !d.isBarengan).length
      const barengan = details.filter(d => d.isBarengan).length

      return {
        ...op,
        details,
        totalGaji,
        totalHarga,
        totalCuci: details.length,
        sendiri,
        barengan,
      }
    })
  }, [operators, periodTransactions])

  const grandTotal = useMemo(
    () => operatorSalaries.reduce((s, o) => s + o.totalGaji, 0),
    [operatorSalaries]
  )

  const periodTxCount = useMemo(() => {
    const names = new Set(operators.map(o => o.nama))
    return periodTransactions.filter(tx =>
      getTxOperators(tx).some(n => names.has(n))
    ).length
  }, [periodTransactions, operators])

  const periodLabel = PERIODS.find(p => p.key === period)?.label ?? ''

  // ── Handlers CRUD ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin) return
    if (!nama.trim()) {
      showToast('Nama operator wajib diisi!', false)
      return
    }

    await addStaff({
      nama: nama.trim(),
      jabatan: 'Operator',
      initials: getInitialsFromNama(nama.trim()),
      color: getRandomColor(),
      status: 'Aktif',
    })

    setNama('')
    setShowForm(false)
    showToast('Operator berhasil ditambahkan')
  }

  const startEdit = (id: string, currentNama: string) => {
    setEditingId(id)
    setEditNama(currentNama)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditNama('')
  }

  const handleSaveEdit = async (id: string) => {
    if (!isAdmin) return
    if (!editNama.trim()) {
      showToast('Nama operator wajib diisi!', false)
      return
    }

    setSavingEdit(true)
    try {
      await updateStaff(id, {
        nama: editNama.trim(),
        initials: getInitialsFromNama(editNama.trim()),
      })
      showToast('Nama operator berhasil diubah')
      cancelEdit()
    } catch (err: any) {
      showToast(err.message || 'Gagal mengubah nama operator', false)
    } finally {
      setSavingEdit(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!isAdmin || !deleteTarget) return
    setDeleting(true)
    try {
      await deleteStaff(deleteTarget.id)
      showToast('Operator berhasil dihapus')
      setDeleteTarget(null)
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus operator', false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-4 space-y-5 pb-24 w-full max-w-3xl mx-auto">
      <Toast {...toast} onHide={() => setToast(t => ({ ...t, visible: false }))} />

      {/* ═══ Header ═══ */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-extrabold text-on-surface">Operator & Gaji</h2>
          <p className="text-sm text-on-surface-variant font-medium mt-0.5">
            {operators.length} operator
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 bg-primary text-white px-3 py-2 rounded-xl text-xs font-semibold shadow-md shadow-primary/20 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Tambah
          </button>
        )}
      </div>

      {/* ═══ Filter Periode ═══ */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              period === p.key
                ? 'bg-primary text-white shadow-sm shadow-primary/30'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">{p.icon}</span>
            {p.label}
          </button>
        ))}
      </div>

      {/* ═══ Kartu Ringkasan ═══ */}
      <div className="relative overflow-hidden bg-gradient-to-br from-success via-success to-success/80 rounded-2xl p-5 shadow-lg shadow-success/20 text-white">
        <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/10" />
        <div className="absolute -right-2 -bottom-8 w-24 h-24 rounded-full bg-white/5" />
        <div className="relative">
          <div className="flex items-center gap-2 opacity-90">
            <span className="material-symbols-outlined text-[16px]">payments</span>
            <p className="text-[11px] font-semibold uppercase tracking-wider">
              Total Gaji · {periodLabel}
            </p>
          </div>
          <p className="text-3xl font-extrabold mt-1.5 tracking-tight">
            {formatRupiah(grandTotal)}
          </p>
          <div className="flex items-center gap-3 mt-3 text-[11px] font-medium opacity-90">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">receipt_long</span>
              {periodTxCount} transaksi
            </span>
            <span className="w-1 h-1 rounded-full bg-white/60" />
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">group</span>
              {operators.length} operator
            </span>
          </div>
        </div>
      </div>

      {/* ═══ Form Tambah ═══ */}
      {isAdmin && showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 space-y-4"
        >
          <input
            type="text"
            placeholder="Nama operator"
            value={nama}
            onChange={e => setNama(e.target.value)}
            className="w-full h-12 px-4 bg-surface-container-lowest border-2 border-outline-variant rounded-xl text-sm font-medium focus:border-primary outline-none"
            required
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-6 h-12 bg-primary text-white rounded-xl font-semibold text-sm flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">save</span> Simpan
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-6 h-12 border border-outline-variant rounded-xl font-semibold text-sm"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {/* ═══ Daftar Operator + Gaji ═══ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-on-surface">Rincian per Operator</h3>
          <span className="text-[11px] text-on-surface-variant font-medium">{periodLabel}</span>
        </div>

        {operatorSalaries.length === 0 ? (
          <div className="text-center py-10 text-on-surface-variant text-sm bg-surface-container-lowest border border-outline-variant rounded-2xl">
            Belum ada operator terdaftar
          </div>
        ) : (
          operatorSalaries
            .slice()
            .sort((a, b) => b.totalGaji - a.totalGaji)
            .map(s => (
              <div
                key={s.id}
                className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 transition-colors hover:border-primary/40"
              >
                {editingId === s.id ? (
                  // ── Mode Edit ──
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editNama}
                      onChange={e => setEditNama(e.target.value)}
                      autoFocus
                      className="w-full h-11 px-3 bg-surface-container-lowest border-2 border-primary rounded-xl text-sm font-medium outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveEdit(s.id)}
                        disabled={savingEdit}
                        className="flex-1 h-10 bg-primary text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {savingEdit ? (
                          <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        ) : (
                          <span className="material-symbols-outlined text-[16px]">check</span>
                        )}
                        Simpan
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={savingEdit}
                        className="flex-1 h-10 border border-outline-variant rounded-lg text-xs font-semibold disabled:opacity-50"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  // ── Mode Normal ──
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-xl ${getSafeColor(s.color)} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}
                        >
                          {s.initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-on-surface truncate">{s.nama}</p>
                          <p className="text-[11px] text-on-surface-variant">
                            Operator · {s.totalCuci} cucian
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => startEdit(s.id, s.nama)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container active:bg-surface-container-high transition-colors"
                              aria-label="Edit operator"
                            >
                              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                                edit
                              </span>
                            </button>
                            <button
                              onClick={() => setDeleteTarget({ id: s.id, nama: s.nama })}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-error-container/30 active:bg-error-container/50 transition-colors"
                              aria-label="Hapus operator"
                            >
                              <span className="material-symbols-outlined text-[18px] text-error">
                                delete
                              </span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-surface-container/60 rounded-xl px-3 py-2">
                        <p className="text-[10px] text-on-surface-variant font-medium">Sendiri</p>
                        <p className="text-sm font-bold text-on-surface">{s.sendiri}</p>
                      </div>
                      <div className="bg-surface-container/60 rounded-xl px-3 py-2">
                        <p className="text-[10px] text-on-surface-variant font-medium">Barengan</p>
                        <p className="text-sm font-bold text-amber-600">{s.barengan}</p>
                      </div>
                      <div className="bg-surface-container/60 rounded-xl px-3 py-2">
                        <p className="text-[10px] text-on-surface-variant font-medium">Total Cuci</p>
                        <p className="text-sm font-bold text-on-surface">{s.totalCuci}</p>
                      </div>
                    </div>

                    {/* Salary + aksi rincian */}
                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-outline-variant/60">
                      <div className="min-w-0">
                        <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wide">
                          Total Gaji
                        </p>
                        <p className="text-lg font-extrabold text-primary leading-tight">
                          {formatRupiah(s.totalGaji)}
                        </p>
                      </div>
                      <button
                        onClick={() => setDetailTarget(s)}
                        className="flex items-center gap-1 px-3 py-2 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 active:scale-95 transition-all"
                      >
                        <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                        Rincian
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
        )}
      </div>

      {/* ═══ Modal Rincian Gaji ═══ */}
      {detailTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:px-4"
          onClick={() => setDetailTarget(null)}
        >
          <div
            className="bg-surface-container-lowest w-full sm:max-w-md max-h-[88vh] rounded-t-3xl sm:rounded-2xl flex flex-col overflow-hidden border border-outline-variant shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-outline-variant flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-11 h-11 rounded-xl ${getSafeColor(detailTarget.color)} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}
                >
                  {detailTarget.initials}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-on-surface truncate">
                    {detailTarget.nama}
                  </h3>
                  <p className="text-[11px] text-on-surface-variant">
                    Rincian Gaji · {periodLabel}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailTarget(null)}
                className="w-9 h-9 rounded-full hover:bg-surface-container active:bg-surface-container-high flex items-center justify-center flex-shrink-0"
                aria-label="Tutup"
              >
                <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
                  close
                </span>
              </button>
            </div>

            {/* Summary */}
            <div className="px-5 py-4 bg-primary/5 border-b border-outline-variant">
              <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide">
                Total Gaji
              </p>
              <p className="text-2xl font-extrabold text-primary mt-0.5">
                {formatRupiah(detailTarget.totalGaji)}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-on-surface-variant font-medium">
                <span>{detailTarget.details.length} transaksi</span>
                <span className="w-1 h-1 rounded-full bg-on-surface-variant/40" />
                <span>Sendiri: {detailTarget.sendiri}</span>
                <span className="w-1 h-1 rounded-full bg-on-surface-variant/40" />
                <span>Barengan: {detailTarget.barengan}</span>
                <span className="w-1 h-1 rounded-full bg-on-surface-variant/40" />
                <span>Bruto: {formatRupiah(detailTarget.totalHarga)}</span>
              </div>
            </div>

            {/* List transaksi */}
            <div className="flex-1 overflow-y-auto p-5 space-y-2.5">
              {detailTarget.details.length === 0 ? (
                <div className="text-center py-10">
                  <span className="material-symbols-outlined text-[40px] text-on-surface-variant/50">
                    receipt_long
                  </span>
                  <p className="text-sm text-on-surface-variant mt-2">
                    Belum ada transaksi di periode ini
                  </p>
                </div>
              ) : (
                detailTarget.details.map((d: DetailRow, i: number) => (
                  <div
                    key={d.txId + i}
                    className="flex items-start justify-between gap-3 p-3 rounded-xl bg-surface-container/60"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-on-surface">
                          {d.jenisLabel}
                        </span>
                        {d.isBarengan ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 font-semibold">
                            Barengan
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/15 text-primary font-semibold">
                            Sendiri
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-on-surface-variant mt-0.5">
                        {formatDateLong(d.tanggal)}
                      </p>
                      <p className="text-[11px] text-on-surface-variant mt-0.5">
                        Harga {formatRupiah(d.harga)} × {COMMISSION_PERCENT}%
                        {d.jumlahOperator > 1 && <> ÷ {d.jumlahOperator} operator</>}
                        {d.rekan.length > 0 && (
                          <> · Bareng: {d.rekan.join(', ')}</>
                        )}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-primary whitespace-nowrap">
                      +{formatRupiah(d.komisi)}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-outline-variant bg-surface-container/40">
              <button
                onClick={() => setDetailTarget(null)}
                className="w-full h-11 rounded-xl bg-primary text-white font-semibold text-sm active:scale-[0.98] transition-transform"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Modal Konfirmasi Hapus ═══ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-sm p-6 border border-outline-variant">
            <h2 className="text-lg font-bold text-on-surface mb-1">Hapus Operator?</h2>
            <p className="text-sm text-on-surface-variant mb-5">
              Yakin mau hapus{' '}
              <span className="font-semibold text-on-surface">{deleteTarget.nama}</span>{' '}
              dari daftar operator? Riwayat transaksi tetap tersimpan.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-4 py-2 bg-error text-white rounded-lg text-sm font-medium hover:bg-error/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deleting && (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {deleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function KaryawanPage() {
  return (
    <Guard allowedRoles={['admin', 'guest']}>
      <OperatorContent />
    </Guard>
  )
}