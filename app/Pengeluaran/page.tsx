'use client'

import { useState, useEffect } from 'react'
import { useAppStore, useUser } from '@/lib/Store'
import Toast from '@/components/ui/Toast'
import Headbar from '@/components/layout/Headbar'
import BottomNavbar from '@/components/layout/ButtomNav'

export default function PengeluaranPage() {
  const {
    expenses,
    fetchExpenses,
    addExpense,
    deleteExpense,
    updateExpense,
    loading,
    initialized,
    initStore,
  } = useAppStore()
  const user = useUser()
  const isAdmin = user?.role === 'admin'

  const [storeReady, setStoreReady] = useState(false)

  // ─── Toast ──────────────────────────────────────────────────────────
  const [toast, setToast] = useState({ visible: false, message: '', success: true })
  const showToast = (message: string, success = true) =>
    setToast({ visible: true, message, success })

  // ─── Form Tambah ──────────────────────────────────────────────────
  const [nama, setNama] = useState('')
  const [kategori, setKategori] = useState('')
  const [nominal, setNominal] = useState('')
  const formatRupiah = (value: string) => {
  const angka = value.replace(/\D/g, '')
    return angka.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  }

  const handleNominalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNominal(formatRupiah(e.target.value))
  }
  const [keterangan, setKeterangan] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // ─── Modal Edit ──────────────────────────────────────────────────
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState({
    nama_pengeluaran: '',
    kategori: '',
    nominal: '',
    keterangan: '',
  })
  const [editSubmitting, setEditSubmitting] = useState(false)

  // ─── Modal Konfirmasi Hapus ────────────────────────────────────
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  // ─── Init & Fetch ──────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      if (!initialized) {
        await initStore()
      }
      setStoreReady(true)
    }
    init()
  }, [initialized, initStore])

  useEffect(() => {
    if (storeReady) {
      fetchExpenses()
    }
  }, [storeReady, fetchExpenses])

  // ─── Handle Tambah ─────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin) {
      showToast('Hanya admin yang bisa menambah pengeluaran', false)
      return
    }
    if (!nama.trim()) {
      showToast('Nama pengeluaran wajib diisi', false)
      return
    }
    const nominalInt = parseInt(nominal.replace(/\./g, ''))
    if (isNaN(nominalInt) || nominalInt <= 0) {
      showToast('Nominal harus angka positif', false)
      return
    }

    setSubmitting(true)
    try {
      await addExpense({
        nama_pengeluaran: nama.trim(),
        kategori: kategori.trim() || null,
        nominal: nominalInt,
        keterangan: keterangan.trim() || null,
      })
      setNama('')
      setKategori('')
      setNominal('')
      setKeterangan('')
      showToast('Pengeluaran berhasil ditambahkan!')
    } catch (err: any) {
      showToast(err.message || 'Gagal menambahkan pengeluaran', false)
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Buka Modal Hapus ──────────────────────────────────────────
  const openDeleteModal = (id: string) => {
    setDeleteId(id)
    setDeleteModalOpen(true)
  }

  const closeDeleteModal = () => {
    setDeleteModalOpen(false)
    setDeleteId(null)
    setDeleteSubmitting(false)
  }

  // ─── Proses Hapus ──────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteId) return
    setDeleteSubmitting(true)
    try {
      await deleteExpense(deleteId)
      showToast('Data pengeluaran berhasil dihapus')
      closeDeleteModal()
    } catch (err: any) {
      showToast(err.message || 'Gagal hapus data', false)
      setDeleteSubmitting(false)
    }
  }

  // ─── Buka & Tutup Edit ─────────────────────────────────────────
  const openEditModal = (exp: typeof expenses[0]) => {
    setEditingId(exp.id)
    setEditData({
      nama_pengeluaran: exp.nama_pengeluaran,
      kategori: exp.kategori || '',
      nominal: formatRupiah(exp.nominal.toString()),
      keterangan: exp.keterangan || '',
    })
    setEditModalOpen(true)
  }

  const closeEditModal = () => {
    setEditModalOpen(false)
    setEditingId(null)
    setEditData({
      nama_pengeluaran: '',
      kategori: '',
      nominal: '',
      keterangan: '',
    })
    setEditSubmitting(false)
  }

  const handleEditSubmit = async () => {
    if (!editingId) return
    if (!editData.nama_pengeluaran.trim()) {
      showToast('Nama pengeluaran wajib diisi', false)
      return
    }
    const nominalInt = parseInt(editData.nominal.replace(/\./g, ''))
    if (isNaN(nominalInt) || nominalInt <= 0) {
      showToast('Nominal harus angka positif', false)
      return
    }

    setEditSubmitting(true)
    try {
      await updateExpense(editingId, {
        nama_pengeluaran: editData.nama_pengeluaran.trim(),
        kategori: editData.kategori.trim() || null,
        nominal: nominalInt,
        keterangan: editData.keterangan.trim() || null,
      })
      showToast('Pengeluaran berhasil diperbarui')
      closeEditModal()
    } catch (err: any) {
      showToast(err.message || 'Gagal memperbarui pengeluaran', false)
      setEditSubmitting(false)
    }
  }

  // ─── Loading ──────────────────────────────────────────────────
  if (!storeReady) {
    return (
      <div className="flex flex-col min-h-screen bg-surface">
        <main className="flex-1 p-4 pb-24">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-on-surface-variant">Memuat data...</p>
            </div>
          </div>
        </main>
        <BottomNavbar />
      </div>
    )
  }

  const isLoading = loading.expenses

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <main className="flex-1 p-4 pb-24">
        <Toast
          visible={toast.visible}
          message={toast.message}
          success={toast.success}
          onHide={() => setToast({ visible: false, message: '', success: true })}
        />

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-on-surface">📋 Pengeluaran</h1>
            <p className="text-sm text-on-surface-variant mt-0.5">Catat semua pengeluaran toko</p>
          </div>
          {!isAdmin && (
            <span className="bg-amber-50 text-amber-700 text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">visibility</span> Guest
            </span>
          )}
        </div>

        {/* Form Tambah */}
        {isAdmin && (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 mb-6">
            <h2 className="text-sm font-semibold text-on-surface mb-3">Tambah Pengeluaran</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-on-surface-variant">Nama Pengeluaran *</label>
                <input
                  type="text"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  className="w-full h-11 px-4 bg-surface-container border border-outline-variant rounded-xl text-sm focus:border-primary transition-colors"
                  placeholder="Contoh: Beli sabun, ganti oli, dll"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-on-surface-variant">Kategori</label>
                <input
                  type="text"
                  value={kategori}
                  onChange={(e) => setKategori(e.target.value)}
                  className="w-full h-11 px-4 bg-surface-container border border-outline-variant rounded-xl text-sm focus:border-primary transition-colors"
                  placeholder="Contoh: Peralatan, Snack, Bensin, dll"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-on-surface-variant">Nominal (Rp) *</label>
                <input
                  type="text"
                  value={nominal}
                  onChange={handleNominalChange}
                  className="w-full h-11 px-4 bg-surface-container border border-outline-variant rounded-xl text-sm focus:border-primary transition-colors"
                  placeholder="Masukkan angka"
                  required
                  min="1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-on-surface-variant">Keterangan</label>
                <input
                  type="text"
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  className="w-full h-11 px-4 bg-surface-container border border-outline-variant rounded-xl text-sm focus:border-primary transition-colors"
                  placeholder="Opsional"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/30 transition-all active:scale-95 disabled:opacity-50"
              >
                {submitting ? 'Menyimpan...' : 'Simpan Pengeluaran'}
              </button>
            </form>
          </div>
        )}

        {/* Daftar Pengeluaran */}
        <div>
          <h2 className="text-sm font-semibold text-on-surface mb-3">Riwayat Pengeluaran</h2>
          {isLoading ? (
            <p className="text-sm text-on-surface-variant">Memuat...</p>
          ) : expenses.length === 0 ? (
            <p className="text-sm text-on-surface-variant">Belum ada data pengeluaran.</p>
          ) : (
            <ul className="space-y-2">
              {expenses.map((exp) => (
                <li
                  key={exp.id}
                  className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 flex justify-between items-start"
                >
                  <div>
                    <div className="font-semibold text-on-surface">{exp.nama_pengeluaran}</div>
                    <div className="text-sm text-on-surface-variant">
                      {exp.kategori && <span>Kategori: {exp.kategori}</span>}
                      {exp.keterangan && <span> • {exp.keterangan}</span>}
                    </div>
                    <div className="text-xs text-on-surface-variant mt-0.5">
                      {new Date(exp.created_at).toLocaleDateString('id-ID')} {new Date(exp.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <span className="font-bold text-error">
                      Rp {exp.nominal.toLocaleString('id-ID')}
                    </span>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => openEditModal(exp)}
                          className="text-on-surface-variant hover:text-primary transition-colors"
                          title="Edit"
                        >
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </button>
                        <button
                          onClick={() => openDeleteModal(exp.id)}
                          className="text-on-surface-variant hover:text-error transition-colors"
                        >
                          <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      {/* ─── MODAL EDIT ────────────────────────────────────────────── */}
      {editModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && closeEditModal()}
        >
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
              <h3 className="text-lg font-semibold text-on-surface">Edit Pengeluaran</h3>
              <button
                onClick={closeEditModal}
                className="p-1 rounded-full hover:bg-surface-container text-on-surface-variant transition-colors"
              >
                <span className="material-symbols-outlined text-[24px]">close</span>
              </button>
            </div>
            <div className="p-6">
              <form onSubmit={(e) => { e.preventDefault(); handleEditSubmit() }} className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-on-surface-variant">Nama Pengeluaran *</label>
                  <input
                    type="text"
                    value={editData.nama_pengeluaran}
                    onChange={(e) => setEditData({ ...editData, nama_pengeluaran: e.target.value })}
                    className="w-full h-11 px-4 bg-surface-container border border-outline-variant rounded-xl text-sm focus:border-primary transition-colors"
                    placeholder="Nama pengeluaran"
                    required
                    disabled={!isAdmin}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-on-surface-variant">Kategori</label>
                  <input
                    type="text"
                    value={editData.kategori}
                    onChange={(e) => setEditData({ ...editData, kategori: e.target.value })}
                    className="w-full h-11 px-4 bg-surface-container border border-outline-variant rounded-xl text-sm focus:border-primary transition-colors"
                    placeholder="Kategori"
                    disabled={!isAdmin}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-on-surface-variant">Nominal (Rp) *</label>
                  <input
                    type="text"
                    value={editData.nominal}
                    onChange={(e) => setEditData({ ...editData, nominal: formatRupiah(e.target.value) })}
                    className="w-full h-11 px-4 bg-surface-container border border-outline-variant rounded-xl text-sm focus:border-primary transition-colors"
                    placeholder="Masukkan angka"
                    required
                    disabled={!isAdmin}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-on-surface-variant">Keterangan</label>
                  <input
                    type="text"
                    value={editData.keterangan}
                    onChange={(e) => setEditData({ ...editData, keterangan: e.target.value })}
                    className="w-full h-11 px-4 bg-surface-container border border-outline-variant rounded-xl text-sm focus:border-primary transition-colors"
                    placeholder="Opsional"
                    disabled={!isAdmin}
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="flex-1 h-11 bg-surface-container border border-outline-variant rounded-xl text-sm font-medium text-on-surface-variant hover:bg-surface-container-high transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={editSubmitting || !isAdmin}
                    className="flex-1 h-11 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/30 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {editSubmitting ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL KONFIRMASI HAPUS ────────────────────────────────── */}
      {deleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && closeDeleteModal()}
        >
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
              <h3 className="text-lg font-semibold text-on-surface">Konfirmasi Hapus</h3>
              <button
                onClick={closeDeleteModal}
                className="p-1 rounded-full hover:bg-surface-container text-on-surface-variant transition-colors"
              >
                <span className="material-symbols-outlined text-[24px]">close</span>
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4 text-on-surface">
                <span className="material-symbols-outlined text-error text-[32px]">warning</span>
                <p className="text-sm">
                  Apakah Anda yakin ingin menghapus data ini?<br />
                  <span className="text-xs text-on-surface-variant">Tindakan ini tidak dapat dibatalkan.</span>
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  className="flex-1 h-11 bg-surface-container border border-outline-variant rounded-xl text-sm font-medium text-on-surface-variant hover:bg-surface-container-high transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteSubmitting}
                  className="flex-1 h-11 bg-error text-white rounded-xl font-bold text-sm shadow-lg shadow-error/30 transition-all active:scale-95 disabled:opacity-50"
                >
                  {deleteSubmitting ? 'Menghapus...' : 'Hapus'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BottomNavbar />
    </div>
  )
}