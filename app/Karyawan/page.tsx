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

function OperatorContent() {
  const { addStaff } = useAppStore()
  const allStaff = useStaff()
  const transactions = useTransactions()
  const user = useUser()
  const isAdmin = user?.role === 'admin'

  const [showForm, setShowForm] = useState(false)
  const [nama, setNama] = useState('')
  const [toast, setToast] = useState({ visible: false, message: '', success: true })

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

    const words = nama.trim().split(' ')
    const initials = words.length >= 2
      ? (words[0][0] + words[1][0]).toUpperCase()
      : nama.slice(0, 2).toUpperCase()

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
            <div key={s.nama} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${getSafeColor(s.color)} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                  {s.initials}
                </div>
                <div>
                  <p className="text-sm font-bold text-on-surface">{s.nama}</p>
                  <p className="text-xs text-on-surface-variant">Operator</p>
                  {/* Breakdown sendiri vs barengan */}
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Sendiri: <span className="font-semibold text-primary">{s.sendiri}</span>
                    &nbsp;· Barengan: <span className="font-semibold text-amber-500">{s.barengan}</span>
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-extrabold text-primary">{s.totalCuci}</p>
                <p className="text-[10px] text-on-surface-variant">Total Cuci</p>
              </div>
            </div>
          ))
        )}
      </div>
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