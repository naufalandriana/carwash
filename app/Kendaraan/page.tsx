'use client'

import { useState, useMemo } from 'react'
import { useAppStore, useVehiclesDB, useUser } from '@/lib/Store'
import Toast from '@/components/ui/Toast'
import Guard from '@/components/auth/Guard'

function KendaraanContent() {
  const { addVehicle, deleteVehicle } = useAppStore()
  const vehiclesDB = useVehiclesDB()
  const user = useUser() // get current user to check role

  // Determine if user has admin rights
  const isAdmin = user?.role === 'admin'

  const [name, setName] = useState('')
  const [tipe, setTipe] = useState<'mobil' | 'motor'>('mobil')
  const [priceExpres, setPriceExpres] = useState('')
  const [priceHidrolik, setPriceHidrolik] = useState('')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'mobil' | 'motor'>('all')
  const [toast, setToast] = useState({ visible: false, message: '', success: true })

  const showToast = (message: string, success = true) =>
    setToast({ visible: true, message, success })

  const filteredVehicles = useMemo(() => {
    return vehiclesDB
      .filter(v => {
        if (filterType !== 'all' && v.tipe !== filterType) return false
        if (search.trim() && !v.name.toLowerCase().includes(search.toLowerCase())) return false
        return true
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [vehiclesDB, search, filterType])

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    const pExp = parseInt(priceExpres)
    const pHid = parseInt(priceHidrolik)
    if (!name.trim() || isNaN(pExp) || pExp < 0 || isNaN(pHid) || pHid < 0) {
      showToast('Isi semua data dengan benar!', false)
      return
    }
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

  const handleDelete = (id: string) => {
    if (!confirm('Hapus kendaraan ini?')) return
    deleteVehicle(id)
    showToast('Kendaraan dihapus')
  }

  return (
    <div className="space-y-5 pb-24">
      <Toast {...toast} onHide={() => setToast(t => ({ ...t, visible: false }))} />
      <div>
        <h2 className="text-[22px] font-extrabold text-on-surface">Data Kendaraan</h2>
        <p className="text-sm text-on-surface-variant mt-0.5">Kelola daftar kendaraan dan harga</p>
      </div>

      {/* Form tambah – hanya ditampilkan untuk admin */}
      {isAdmin && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 shadow-sm">
          <h4 className="text-sm font-bold text-on-surface mb-4">Tambah Jenis Kendaraan</h4>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Jenis Kendaraan</label>
                <input
                  type="text"
                  placeholder="Contoh: Small Cars"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full h-12 px-4 bg-surface-container-lowest border-2 border-outline-variant rounded-xl text-sm font-medium focus:border-primary transition-colors outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Tipe</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTipe('mobil')}
                    className={`flex items-center justify-center gap-2 py-2 rounded-xl font-semibold text-sm transition-all ${
                      tipe === 'mobil' ? 'bg-primary text-white shadow-md' : 'bg-surface-container border border-outline-variant'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">directions_car</span> Mobil
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipe('motor')}
                    className={`flex items-center justify-center gap-2 py-2 rounded-xl font-semibold text-sm transition-all ${
                      tipe === 'motor' ? 'bg-primary text-white shadow-md' : 'bg-surface-container border border-outline-variant'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">motorcycle</span> Motor
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Harga Expres Wash (Rp)</label>
                <input
                  type="number"
                  placeholder="30000"
                  value={priceExpres}
                  onChange={e => setPriceExpres(e.target.value)}
                  className="w-full h-12 px-4 bg-surface-container-lowest border-2 border-outline-variant rounded-xl text-sm font-medium focus:border-primary transition-colors outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Harga Hidrolik Wash (Rp)</label>
                <input
                  type="number"
                  placeholder="40000"
                  value={priceHidrolik}
                  onChange={e => setPriceHidrolik(e.target.value)}
                  className="w-full h-12 px-4 bg-surface-container-lowest border-2 border-outline-variant rounded-xl text-sm font-medium focus:border-primary transition-colors outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full md:w-auto px-8 h-12 bg-primary text-white rounded-xl font-semibold text-sm shadow-md shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">add</span> Tambah
            </button>
          </form>
        </div>
      )}

      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Cari nama..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 min-w-[150px] h-10 px-4 bg-surface-container-lowest border border-outline-variant rounded-xl text-sm focus:border-primary outline-none"
            />
            <div className="flex gap-1 bg-surface-container p-1 rounded-xl">
              {(['all', 'mobil', 'motor'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                    filterType === type ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant'
                  }`}
                >
                  {type === 'all' && 'Semua'}
                  {type === 'mobil' && <span className="material-symbols-outlined text-[14px]">directions_car</span>}
                  {type === 'motor' && <span className="material-symbols-outlined text-[14px]">motorcycle</span>}
                  {type !== 'all' && (type === 'mobil' ? 'Mobil' : 'Motor')}
                </button>
              ))}
            </div>
          </div>
          <span className="text-xs text-on-surface-variant">{filteredVehicles.length} kendaraan</span>
        </div>

        {filteredVehicles.length === 0 ? (
          <div className="text-center py-8 text-on-surface-variant text-sm">Tidak ada data</div>
        ) : (
          <div className="space-y-3">
            {filteredVehicles.map(v => (
              <div key={v.id} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-4 flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    v.tipe === 'mobil' ? 'bg-secondary-container' : 'bg-error-container'
                  }`}>
                    <span className={`material-symbols-outlined text-[20px] icon-fill ${
                      v.tipe === 'mobil' ? 'text-primary' : 'text-error'
                    }`}>
                      {v.tipe === 'mobil' ? 'directions_car' : 'motorcycle'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface">{v.name}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-on-surface-variant">
                      <span>Expres: <span className="font-semibold text-primary">Rp {v.price_expres.toLocaleString('id-ID')}</span></span>
                      <span>Hidrolik: <span className="font-semibold text-primary">Rp {v.price_hidrolik.toLocaleString('id-ID')}</span></span>
                    </div>
                  </div>
                </div>
                {/* Tombol hapus – hanya untuk admin */}
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(v.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-error-container/20 text-on-surface-variant hover:text-error transition-colors flex-shrink-0"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function KendaraanPage() {
  return (
    // Both admin and guest can access, but permissions are controlled inside
    <Guard allowedRoles={['admin', 'guest']}>
      <KendaraanContent />
    </Guard>
  )
}