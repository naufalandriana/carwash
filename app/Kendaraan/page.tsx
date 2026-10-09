'use client'

import { useState, useMemo } from 'react'
import { useAppStore, useVehiclesDB, useUser } from '@/lib/Store'
import Guard from '@/components/auth/Guard'
import { useAlert } from '@/components/ui/Alert'

// ── Format input harga: "30000" → "30.000" ──
function formatRupiahInput(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  return parseInt(digits, 10).toLocaleString('id-ID')
}

// ── Parse balik ke angka bersih: "30.000" → 30000 ──
function parseRupiahInput(value: string): number {
  const digits = value.replace(/\D/g, '')
  return digits ? parseInt(digits, 10) : NaN
}

interface DeleteTarget {
  id: string
  name: string
  tipe: 'mobil' | 'motor'
}

function KendaraanContent() {
  const { addVehicle, deleteVehicle } = useAppStore()
  const vehiclesDB = useVehiclesDB()
  const user = useUser()
  const isAdmin = user?.role === 'admin'
  const { showAlert } = useAlert()

  const [name, setName] = useState('')
  const [tipe, setTipe] = useState<'mobil' | 'motor'>('mobil')
  const [priceExpres, setPriceExpres] = useState('')
  const [priceHidrolik, setPriceHidrolik] = useState('')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'mobil' | 'motor'>('all')

  // ── Confirm delete modal state ──
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [deleting, setDeleting] = useState(false)

  const showToast = (message: string, success = true) =>
    showAlert({
      variant: success ? 'success' : 'error',
      message,
      duration: 3000,
      position: 'top-center',
    })

  const filteredVehicles = useMemo(() => {
    return vehiclesDB
      .filter((v) => {
        if (filterType !== 'all' && v.tipe !== filterType) return false
        if (search.trim() && !v.name.toLowerCase().includes(search.toLowerCase())) return false
        return true
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [vehiclesDB, search, filterType])

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    const pExp = parseRupiahInput(priceExpres)
    const pHid = parseRupiahInput(priceHidrolik)

    if (!name.trim() || isNaN(pExp) || pExp < 0 || isNaN(pHid) || pHid < 0) {
      showToast('Isi semua data dengan benar!', false)
      return
    }
    const exists = vehiclesDB.some(
      (v) => v.name.toLowerCase() === name.trim().toLowerCase() && v.tipe === tipe
    )
    if (exists) {
      showToast('Nama model sudah ada!', false)
      return
    }

    // ⬇️ Yang masuk ke DB: angka bersih (number)
    addVehicle({
      name: name.trim(),
      tipe,
      price_expres: pExp,
      price_hidrolik: pHid,
    })

    setName('')
    setTipe('mobil')
    setPriceExpres('')
    setPriceHidrolik('')
    showToast('Kendaraan berhasil ditambahkan')
  }

  // ── Open confirm modal ──
  const requestDelete = (v: { id: string; name: string; tipe: 'mobil' | 'motor' }) => {
    setDeleteTarget({ id: v.id, name: v.name, tipe: v.tipe })
  }

  // ── Konfirmasi hapus ──
  const handleConfirmDelete = () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      deleteVehicle(deleteTarget.id)
      showToast(`"${deleteTarget.name}" dihapus`)
      setDeleteTarget(null)
    } catch {
      showToast('Gagal menghapus kendaraan', false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-4 space-y-5 pb-24 w-full max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-[22px] font-extrabold text-on-surface">Data Kendaraan</h2>
        <p className="text-sm text-on-surface-variant font-medium mt-0.5">
          Kelola daftar kendaraan dan harga
        </p>
      </div>

      {/* Form tambah — admin only */}
      {isAdmin && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
          <h4 className="text-sm font-bold text-on-surface mb-4">Tambah Model</h4>
          <form onSubmit={handleAdd} className="space-y-3">
            <input
              type="text"
              placeholder="Nama model (contoh: Small Cars, MPV)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-12 px-4 bg-surface-container border border-outline-variant rounded-xl text-sm font-medium focus:border-primary outline-none transition-colors"
            />

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTipe('mobil')}
                className={`h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 transition-all ${
                  tipe === 'mobil'
                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                    : 'bg-surface-container border border-outline-variant text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">directions_car</span>
                Mobil
              </button>
              <button
                type="button"
                onClick={() => setTipe('motor')}
                className={`h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 transition-all ${
                  tipe === 'motor'
                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                    : 'bg-surface-container border border-outline-variant text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">motorcycle</span>
                Motor
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant">
                  Rp
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Expres"
                  value={priceExpres}
                  onChange={(e) => setPriceExpres(formatRupiahInput(e.target.value))}
                  className="w-full h-11 pl-9 pr-3 bg-surface-container border border-outline-variant rounded-xl text-sm font-semibold focus:border-primary outline-none"
                />
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant">
                  Rp
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Hidrolik"
                  value={priceHidrolik}
                  onChange={(e) => setPriceHidrolik(formatRupiahInput(e.target.value))}
                  className="w-full h-11 pl-9 pr-3 bg-surface-container border border-outline-variant rounded-xl text-sm font-semibold focus:border-primary outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full h-11 bg-primary text-white rounded-xl font-bold text-sm shadow-md shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Tambah
            </button>
          </form>
        </div>
      )}

      {/* Search + filter */}
      <div className="space-y-2">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Cari nama model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 pl-10 pr-3 bg-surface-container border border-outline-variant rounded-xl text-sm font-medium focus:border-primary outline-none"
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1.5">
            {(['all', 'mobil', 'motor'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  filterType === t
                    ? 'bg-primary text-white'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {t === 'all' ? 'Semua' : t === 'mobil' ? 'Mobil' : 'Motor'}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-on-surface-variant font-medium">
            {filteredVehicles.length} model
          </span>
        </div>
      </div>

      {/* List */}
      {filteredVehicles.length === 0 ? (
        <div className="text-center py-12 text-on-surface-variant">
          <span className="material-symbols-outlined text-[44px] opacity-30 block mb-2">
            directions_car
          </span>
          <p className="text-sm font-medium">
            {vehiclesDB.length === 0 ? 'Belum ada model kendaraan' : 'Tidak ada yang cocok'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredVehicles.map((v) => (
            <div
              key={v.id}
              className="bg-surface-container-lowest border border-outline-variant rounded-xl p-3 flex items-center gap-3"
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  v.tipe === 'mobil' ? 'bg-secondary-container' : 'bg-error-container'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[20px] icon-fill ${
                    v.tipe === 'mobil' ? 'text-primary' : 'text-error'
                  }`}
                >
                  {v.tipe === 'mobil' ? 'directions_car' : 'motorcycle'}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-on-surface truncate">{v.name}</p>
                <div className="flex items-center gap-2 text-xs text-on-surface-variant mt-0.5 flex-wrap">
                  <span className="font-semibold text-primary">
                    {v.price_expres.toLocaleString('id-ID')}
                  </span>
                  <span className="text-outline">/</span>
                  <span className="font-semibold text-primary">
                    {v.price_hidrolik.toLocaleString('id-ID')}
                  </span>
                  <span className="text-[10px] text-outline">expres / hidrolik</span>
                </div>
              </div>

              {isAdmin && (
                <button
                  onClick={() => requestDelete(v)}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-error-container/40 hover:text-error transition-colors flex-shrink-0"
                  aria-label="Hapus"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ═══ MODAL KONFIRMASI HAPUS (style Alert danger) ═══ */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && !deleting && setDeleteTarget(null)}
        >
          <div className="w-full max-w-sm bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Body */}
            <div className="p-5 flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-error-container flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-error text-[24px] icon-fill">
                  delete_forever
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-on-surface">Hapus Kendaraan?</h3>
                <p className="text-sm text-on-surface-variant mt-1">
                  Yakin mau hapus{' '}
                  <span className="font-semibold text-on-surface">{deleteTarget.name}</span> dari
                  daftar model? Transaksi lama tetap tersimpan.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={() => !deleting && setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 h-11 bg-surface-container border border-outline-variant rounded-xl text-sm font-semibold text-on-surface-variant active:scale-95 transition disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 h-11 bg-error text-white rounded-xl font-bold text-sm active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-[16px]">delete</span>
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

export default function KendaraanPage() {
  return (
    <Guard allowedRoles={['admin', 'guest']}>
      <KendaraanContent />
    </Guard>
  )
}