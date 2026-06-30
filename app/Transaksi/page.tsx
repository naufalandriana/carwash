'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  useAppStore,
  useStaff,
  useModelOptions,
  useVehiclePrice,
  useUser,
} from '@/lib/Store'
import Toast from '@/components/ui/Toast'

type LayananKey = 'expres' | 'hidrolik'
type BayarKey = 'tunai' | 'qris' | 'transfer'

const layananLabel: Record<LayananKey, string> = {
  expres: 'Expres Wash',
  hidrolik: 'Hidrolik Wash',
}
const bayarLabel: Record<BayarKey, string> = {
  tunai: 'Tunai',
  qris: 'QRIS',
  transfer: 'Transfer',
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

// Format plat
function formatPlate(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  const letters = cleaned.match(/^[A-Z]*/)?.[0] || ''
  const numbers = cleaned.slice(letters.length).match(/^[0-9]*/)?.[0] || ''
  const lastLetters = cleaned.slice(letters.length + numbers.length).match(/^[A-Z]*/)?.[0] || ''
  const part1 = letters.slice(0, 2)
  const part2 = numbers.slice(0, 4)
  const part3 = lastLetters.slice(0, 3)
  let result = part1
  if (part2) result += ' ' + part2
  if (part3) result += ' ' + part3
  return result
}

export default function TransaksiPage() {
  const router = useRouter()
  const { addTransaction } = useAppStore()
  const allStaff = useStaff()
  const user = useUser()
  const isGuest = (user?.role as string) === 'guest'

  const operatorOptions = allStaff.filter(s => s.jabatan === 'Operator')

  const [vehicleType, setVehicleType] = useState<'mobil' | 'motor'>('mobil')
  const modelOptions = useModelOptions(vehicleType)

  const [plateRaw, setPlateRaw] = useState('')
  const [model, setModel] = useState('')
  const [layanan, setLayanan] = useState<LayananKey>('expres')
  const [selectedOperators, setSelectedOperators] = useState<string[]>([])
  const [bayar, setBayar] = useState<BayarKey>('tunai')
  const [toast, setToast] = useState({ visible: false, message: '', success: true })
  const [loading, setLoading] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)

  const currentPrice = useVehiclePrice(model, layanan)

  const showToast = (message: string, success = true) =>
    setToast({ visible: true, message, success })

  const resetForm = () => {
    setPlateRaw('')
    setModel('')
    setSelectedOperators([])
    setLayanan('expres')
    setBayar('tunai')
    setVehicleType('mobil')
    setDropdownOpen(false)
  }

  // ========== PERUBAHAN: toggle operator berdasarkan tipe ==========
  const toggleOperator = (name: string) => {
    if (isGuest) return

    if (vehicleType === 'motor') {
      // Motor: pilih satu, langsung ganti dengan yang dipilih
      setSelectedOperators([name])
      // Tutup dropdown setelah pilih (opsional)
      setDropdownOpen(false)
    } else {
      // Mobil: toggle biasa (bisa lebih dari 1)
      setSelectedOperators(prev =>
        prev.includes(name)
          ? prev.filter(op => op !== name)
          : [...prev, name]
      )
    }
  }

  const clearAll = () => {
    if (isGuest) return
    setSelectedOperators([])
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isGuest) {
      showToast('Guest tidak dapat menambah transaksi!', false)
      return
    }

    if (!model) {
      showToast('Pilih model kendaraan!', false)
      return
    }
    if (selectedOperators.length === 0) {
      showToast('Pilih minimal 1 operator!', false)
      return
    }
    if (currentPrice === 0) {
      showToast('Harga tidak ditemukan untuk model ini!', false)
      return
    }

    setLoading(true)

    try {
      const karyawanStr = selectedOperators.join(', ')

      await addTransaction({
        plat: formatPlate(plateRaw) || 'N/A',
        model,
        karyawan: karyawanStr,
        layanan: layananLabel[layanan] as any,
        bayar: bayarLabel[bayar] as any,
        harga: currentPrice,
        status: 'Proses',
        tipe: vehicleType,
      })

      resetForm()
      showToast('Transaksi berhasil disimpan!')
      setTimeout(() => router.push('/'), 1200)
    } catch (error: any) {
      console.error('Error saving transaction:', error)
      showToast(error.message || 'Gagal menyimpan transaksi!', false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5 pb-24">
      <Toast
        visible={toast.visible}
        message={toast.message}
        success={toast.success}
        onHide={() => setToast(t => ({ ...t, visible: false }))}
      />

      {isGuest && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2 text-amber-700 text-sm">
          <span className="material-symbols-outlined text-[20px]">visibility</span>
          <span className="font-medium">Mode Tampilan</span>
          <span className="text-amber-600">— Anda hanya dapat melihat data, tidak dapat menambah transaksi.</span>
        </div>
      )}

      <div>
        <h2 className="text-[22px] font-extrabold text-on-surface">Input Transaksi</h2>
        <p className="text-sm text-on-surface-variant mt-0.5">Catat kendaraan masuk</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Jenis Kendaraan */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Jenis Kendaraan</label>
          <div className="grid grid-cols-2 gap-3 p-1 bg-surface-container rounded-2xl">
            {(['mobil', 'motor'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  if (!isGuest) {
                    setVehicleType(type)
                    setModel('')
                    setSelectedOperators([]) // reset operator
                  }
                }}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all ${
                  vehicleType === type ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant hover:bg-surface-container-high'
                } ${isGuest ? 'cursor-not-allowed opacity-70' : ''}`}
              >
                <span className="material-symbols-outlined text-[20px]">{type === 'mobil' ? 'directions_car' : 'motorcycle'}</span>
                {type === 'mobil' ? 'Mobil' : 'Motor'}
              </button>
            ))}
          </div>
        </div>

        {/* Plat */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Nomor Plat</label>
          <input
            type="text"
            placeholder="B 1234 XYZ"
            value={formatPlate(plateRaw)}
            onChange={e => setPlateRaw(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 9))}
            disabled={isGuest}
            className="w-full h-14 px-4 bg-surface-container-lowest border-2 border-outline-variant rounded-xl text-xl font-extrabold tracking-[0.05em] uppercase focus:border-primary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>

        {/* Model */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Model</label>
          <div className="flex flex-wrap gap-2">
            {modelOptions.length === 0 ? (
              <p className="text-sm text-on-surface-variant">Belum ada data model untuk tipe ini</p>
            ) : (
              modelOptions.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { if (!isGuest) setModel(m) }}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    model === m
                      ? 'bg-primary text-white shadow-md'
                      : 'bg-surface-container border border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
                  } ${isGuest ? 'cursor-not-allowed opacity-70' : ''}`}
                >
                  {m}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Layanan */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Layanan</label>
          {layananItems.map(item => (
            <label
              key={item.key}
              className={`flex items-center gap-3 p-3 bg-surface-container-lowest border-2 rounded-xl cursor-pointer transition-colors ${
                layanan === item.key ? 'border-primary' : 'border-outline-variant hover:border-primary/40'
              } ${isGuest ? 'cursor-not-allowed opacity-70' : ''}`}
            >
              <input
                type="radio"
                name="layanan"
                value={item.key}
                checked={layanan === item.key}
                onChange={() => { if (!isGuest) setLayanan(item.key) }}
                disabled={isGuest}
                className="w-4 h-4 accent-primary disabled:opacity-50"
              />
              <div className="flex-1">
                <p className="text-sm font-semibold text-on-surface">{item.label}</p>
                <p className="text-xs text-on-surface-variant">{item.sub}</p>
              </div>
              <span className="text-sm font-bold text-primary">
                Rp {useVehiclePrice(model, item.key).toLocaleString('id-ID')}
              </span>
            </label>
          ))}
        </div>

        {/* Operator */}
        <div className="space-y-2" ref={dropdownRef}>
          <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Operator</label>

          {operatorOptions.length === 0 ? (
            <div className="w-full h-12 px-4 bg-surface-container border-2 border-outline-variant rounded-xl text-sm font-medium flex items-center text-on-surface-variant">
              Belum ada operator terdaftar
            </div>
          ) : (
            <div className="relative">
              <div
                onClick={() => { if (!isGuest) setDropdownOpen(!dropdownOpen) }}
                className={`w-full min-h-[52px] px-4 py-2 bg-surface-container-lowest border-2 rounded-xl cursor-pointer flex items-center flex-wrap gap-1.5 transition-colors ${
                  dropdownOpen ? 'border-primary' : 'border-outline-variant hover:border-primary/40'
                } ${isGuest ? 'cursor-not-allowed opacity-70' : ''}`}
              >
                {selectedOperators.length === 0 ? (
                  <span className="text-on-surface-variant text-sm">Pilih operator...</span>
                ) : (
                  <>
                    {selectedOperators.map((op) => (
                      <span
                        key={op}
                        className="inline-flex items-center gap-0.5 px-2.5 py-0.5 bg-primary/10 text-primary rounded-full text-sm font-medium"
                      >
                        {op}
                        {/* PERUBAHAN: tombol close hanya untuk mobil */}
                        {!isGuest && vehicleType === 'mobil' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleOperator(op)
                            }}
                            className="w-4 h-4 rounded-full hover:bg-primary/20 flex items-center justify-center text-primary"
                          >
                            <span className="material-symbols-outlined text-[14px]">close</span>
                          </button>
                        )}
                      </span>
                    ))}
                    {/* PERUBAHAN: tombol hapus semua hanya untuk mobil (karena motor cuma satu) */}
                    {selectedOperators.length > 1 && !isGuest && vehicleType === 'mobil' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          clearAll()
                        }}
                        className="text-xs text-on-surface-variant hover:text-error ml-1"
                      >
                        (hapus semua)
                      </button>
                    )}
                  </>
                )}
                <span className="ml-auto text-on-surface-variant">
                  <span className="material-symbols-outlined text-[20px]">
                    {dropdownOpen ? 'expand_less' : 'expand_more'}
                  </span>
                </span>
              </div>

              {dropdownOpen && !isGuest && (
                <div className="absolute z-10 w-full mt-1 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg max-h-60 overflow-y-auto py-1.5">
                  {operatorOptions.map((op) => {
                    const isChecked = selectedOperators.includes(op.nama)
                    return (
                      <label
                        key={op.nama}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container cursor-pointer transition-colors"
                      >
                        {/* PERUBAHAN: radio untuk motor, checkbox untuk mobil */}
                        <input
                          type={vehicleType === 'motor' ? 'radio' : 'checkbox'}
                          name={vehicleType === 'motor' ? 'operator' : undefined}
                          checked={isChecked}
                          onChange={() => toggleOperator(op.nama)}
                          className="w-4 h-4 accent-primary"
                        />
                        <span className="text-sm font-medium text-on-surface">{op.nama}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* PERUBAHAN: informasi tambahan */}
          <div className="flex justify-between items-center mt-1">
            <p className="text-xs text-on-surface-variant">
              {selectedOperators.length === 0
                ? 'Belum ada operator dipilih'
                : `${selectedOperators.length} operator dipilih`}
            </p>
            <span className="text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full">
              {vehicleType === 'motor' ? 'Pilih 1 operator' : 'Pilih banyak operator'}
            </span>
          </div>
        </div>

        {/* Metode Bayar */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Metode Bayar</label>
          <div className="grid grid-cols-3 gap-2">
            {bayarItems.map(item => (
              <label
                key={item.key}
                className={`flex flex-col items-center gap-1.5 p-3 border-2 rounded-xl cursor-pointer text-center transition-colors ${
                  bayar === item.key ? 'bg-primary-container border-primary' : 'bg-surface-container-lowest border-outline-variant'
                } ${isGuest ? 'cursor-not-allowed opacity-70' : ''}`}
              >
                <input
                  type="radio"
                  name="bayar"
                  value={item.key}
                  checked={bayar === item.key}
                  onChange={() => { if (!isGuest) setBayar(item.key) }}
                  disabled={isGuest}
                  className="hidden"
                />
                <span className={`material-symbols-outlined text-[22px] ${bayar === item.key ? 'text-primary icon-fill' : 'text-on-surface-variant'}`}>
                  {item.icon}
                </span>
                <span className={`text-xs ${bayar === item.key ? 'font-semibold text-primary' : 'font-medium text-on-surface-variant'}`}>
                  {item.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Total */}
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-on-surface-variant font-medium">Total</p>
              <h3 className="text-2xl font-extrabold text-primary mt-0.5">Rp {currentPrice.toLocaleString('id-ID')}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
              <span className="material-symbols-outlined text-white icon-fill">sell</span>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || isGuest}
          className={`w-full h-14 bg-primary text-white rounded-2xl font-bold text-base shadow-lg shadow-primary/30 transition-all flex items-center justify-center gap-2 ${
            isGuest ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'
          }`}
        >
          <span className="material-symbols-outlined text-[20px] icon-fill">
            {isGuest ? 'visibility' : 'save'}
          </span>
          {isGuest ? 'Hanya Tampilan' : loading ? 'Menyimpan...' : 'Simpan Transaksi'}
        </button>
      </form>
    </div>
  )
}