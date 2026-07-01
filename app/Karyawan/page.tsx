'use client'

import { useState } from 'react'
import { useAppStore, useStaff, useTransactions, useUser } from '@/lib/Store'
import Toast from '@/components/ui/Toast'
import Guard from '@/components/auth/Guard'

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
  const words = nama.trim().split(' ')
  return words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : nama.slice(0, 2).toUpperCase()
}

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

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nama: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const showToast = (msg: string, success = true) =>
    setToast({ visible: true, message: msg, success })

  const operators = allStaff.filter(s => s.jabatan === 'Operator')

  // Hitung total, sendiri, barengan per operator
  const operatorsWithCount = operators.map(s => {
    let total = 0
    let sendiri = 0
    let barengan = 0

    transactions.forEach(tx => {
      const list = tx.karyawan.split(',').map(k => k.trim()).filter(Boolean)
      if (list.includes(s.nama)) {
        total++
        if (list.length === 1) sendiri++
        else barengan++
      }
    })

    return { ...s, totalCuci: total, sendiri, barengan }
  })

  // Total cuci gabungan (unik transaksi yang melibatkan operator)
  const totalCuciOverall = transactions.filter(tx => {
    const list = tx.karyawan.split(',').map(k => k.trim()).filter(Boolean)
    return operators.some(op => list.includes(op.nama))
  }).length

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin) return

    if (!nama.trim()) {
      showToast('Nama operator wajib diisi!', false)
      return
    }

    const initials = getInitialsFromNama(nama.trim())
    const color = getRandomColor()

    await addStaff({
      nama: nama.trim(),
      jabatan: 'Operator',
      initials,
      color,
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
    <div className="space-y-5 pb-24">
      <Toast {...toast} onHide={() => setToast(t => ({ ...t, visible: false }))} />

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[22px] font-extrabold text-on-surface">Operator</h2>
          <div className="flex flex-col mt-0.5">
            <p className="text-sm text-on-surface-variant font-medium">
              {operators.length} operator aktif
            </p>
            <span className="text-xs text-primary font-semibold">
              {totalCuciOverall} Total Cuci
            </span>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 bg-primary text-white px-3 py-2 rounded-xl text-xs font-semibold shadow-md shadow-primary/20 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Tambah Operator
          </button>
        )}
      </div>

      {isAdmin && showForm && (
        <form onSubmit={handleSubmit} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 space-y-4">
          <input
            type="text"
            placeholder="Nama operator"
            value={nama}
            onChange={e => setNama(e.target.value)}
            className="w-full h-12 px-4 bg-surface-container-lowest border-2 border-outline-variant rounded-xl text-sm font-medium focus:border-primary outline-none"
            required
          />
          <div className="flex gap-2">
            <button type="submit" className="px-6 h-12 bg-primary text-white rounded-xl font-semibold text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">save</span> Simpan
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-6 h-12 border border-outline-variant rounded-xl font-semibold text-sm">
              Batal
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {operatorsWithCount.length === 0 ? (
          <div className="text-center py-8 text-on-surface-variant text-sm">Belum ada operator terdaftar</div>
        ) : (
          operatorsWithCount.map((s) => (
            <div key={s.id} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
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
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl ${getSafeColor(s.color)} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                      {s.initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-on-surface truncate">{s.nama}</p>
                      <p className="text-xs text-on-surface-variant">Operator</p>
                      <p className="text-[11px] text-on-surface-variant mt-0.5">
                        Sendiri: <span className="font-semibold text-primary">{s.sendiri}</span>
                        &nbsp;· Barengan: <span className="font-semibold text-amber-500">{s.barengan}</span>
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
                          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">edit</span>
                        </button>
                        <button
                          onClick={() => setDeleteTarget({ id: s.id, nama: s.nama })}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-error-container/30 active:bg-error-container/50 transition-colors"
                          aria-label="Hapus operator"
                        >
                          <span className="material-symbols-outlined text-[18px] text-error">delete</span>
                        </button>
                      </>
                    )}
                    <div className="text-right ml-1">
                      <p className="text-sm font-extrabold text-primary">{s.totalCuci}</p>
                      <p className="text-[10px] text-on-surface-variant">Total Cuci</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal Konfirmasi Hapus */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-sm p-6 border border-outline-variant">
            <h2 className="text-lg font-bold text-on-surface mb-1">Hapus Operator?</h2>
            <p className="text-sm text-on-surface-variant mb-5">
              Yakin mau hapus <span className="font-semibold text-on-surface">{deleteTarget.nama}</span> dari daftar operator? Riwayat transaksi tetap tersimpan.
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