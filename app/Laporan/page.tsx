'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useAppStore, useUser, useVehiclesDB, useModelOptions } from '@/lib/Store'
import Toast from '@/components/ui/Toast'
import Guard from '@/components/auth/Guard'
import type { Transaction } from '@/lib/Data'

// ─── Safe formatter ──────────────────────────────────────────────────────
function fmtRupiah(n?: number) {
  if (n === undefined || n === null) return 'Rp 0'
  return 'Rp ' + n.toLocaleString('id-ID')
}

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

// ─── Reverse mapping untuk edit modal ────────────────────────────────
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

// ============ Custom Dropdown ============
interface DropdownProps {
  options: { value: string; label: string }[]
  value: string
  onChange: (val: string) => void
  placeholder?: string
  className?: string
}

function Dropdown({ options, value, onChange, placeholder = 'Pilih', className = '' }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedLabel = options.find(opt => opt.value === value)?.label || placeholder

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="h-9 w-full min-w-[100px] px-3 pr-8 bg-surface-container border border-outline-variant rounded-full text-sm font-medium flex items-center justify-between gap-1 hover:bg-surface-container-highest transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        <span className="truncate">{selectedLabel}</span>
        <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {open && (
        <div className="absolute z-10 mt-1 w-full min-w-[160px] bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg py-1 max-h-52 overflow-y-auto">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value)
                setOpen(false)
              }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-surface-container-highest transition-colors ${
                opt.value === value ? 'bg-primary-container text-primary font-semibold' : 'text-on-surface'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ============ Main Component ============
function LaporanContent() {
  const { transactions, updateTransactionStatus, updateTransaction } = useAppStore()
  const user = useUser()
  const vehiclesDB = useVehiclesDB()
  const isAdmin = user?.role === 'admin'

  const [toast, setToast] = useState({ visible: false, message: '', success: true })
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'mobil' | 'motor'>('all')
  const [filterModel, setFilterModel] = useState<string>('all')
  const [filterLayanan, setFilterLayanan] = useState<string>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'history' | 'report'>('history')

  // ── State untuk modal edit ──────────────────────────────────────────────
  const [editingTx, setEditingTx] = useState<Transaction & { id: string } | null>(null)
  const [editVehicleType, setEditVehicleType] = useState<'mobil' | 'motor'>('mobil')
  const [editPlate, setEditPlate] = useState('')
  const [editModel, setEditModel] = useState('')
  const [editType, setEditType] = useState('')
  const [editLayanan, setEditLayanan] = useState<LayananKey>('expres')
  const [editBayar, setEditBayar] = useState<BayarKey>('tunai')
  const [editOperators, setEditOperators] = useState<string[]>([])
  const [editDropdownOpen, setEditDropdownOpen] = useState(false)
  const editDropdownRef = useRef<HTMLDivElement>(null)

  // ── Ambil daftar staff ──────────────────────────────────────────────────
  const allStaff = useAppStore(s => s.staff)
  const operatorOptions = allStaff.filter(s => s.jabatan === 'Operator')

  // ── Ambil model options berdasarkan tipe kendaraan yang dipilih di edit ──
  const modelOptions = useModelOptions(editVehicleType)

  // ── Hitung harga edit untuk setiap layanan ──────────────────────────────
  const editPrices = useMemo(() => {
    const v = vehiclesDB.find(v => v.name === editModel)
    if (!v) {
      return { expres: 0, hidrolik: 0 }
    }
    return {
      expres: v.price_expres ?? 0,
      hidrolik: v.price_hidrolik ?? 0,
    }
  }, [editModel, vehiclesDB])

  // ── Fungsi buka modal ──────────────────────────────────────────────────
  const openEditModal = (tx: Transaction & { id: string }) => {
    setEditingTx(tx)
    setEditVehicleType(tx.tipe)
    setEditPlate(tx.plat)
    setEditModel(tx.model)
    setEditType(tx.type || '')

    // ── Perbaikan: mapping dari nama display ke internal key ──
    const layananKey = layananKeyMap[tx.layanan] || 'expres'
    setEditLayanan(layananKey)

    const bayarKey = bayarKeyMap[tx.bayar] || 'tunai'
    setEditBayar(bayarKey)

    setEditOperators(tx.karyawan.split(',').map(s => s.trim()).filter(Boolean))
    setEditDropdownOpen(false)
  }

  // ── Fungsi simpan edit ────────────────────────────────────────────────
  const handleSaveEdit = async () => {
    if (!editingTx) return
    if (!editModel) {
      setToast({ visible: true, message: 'Pilih model kendaraan!', success: false })
      return
    }
    if (editOperators.length === 0) {
      setToast({ visible: true, message: 'Pilih minimal 1 operator!', success: false })
      return
    }

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
      setToast({ visible: true, message: 'Transaksi berhasil diupdate', success: true })
      setEditingTx(null)
    } catch {
      setToast({ visible: true, message: 'Gagal update transaksi', success: false })
    }
  }

  // ── Toggle operator ────────────────────────────────────────────────────
  const toggleEditOperator = (name: string) => {
    if (editVehicleType === 'motor') {
      setEditOperators([name])
      setEditDropdownOpen(false)
    } else {
      setEditOperators(prev =>
        prev.includes(name)
          ? prev.filter(op => op !== name)
          : [...prev, name]
      )
    }
  }

  const clearEditOperators = () => {
    setEditOperators([])
  }

  // ── Click outside untuk dropdown operator ────────────────────────────
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editDropdownRef.current && !editDropdownRef.current.contains(event.target as Node)) {
        setEditDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Data untuk filter ──────────────────────────────────────────────────
  const allModels = useMemo(() => {
    return vehiclesDB.map(v => ({ name: v.name, type: v.tipe }))
  }, [vehiclesDB])

  const modelOptionsFilter = useMemo(() => {
    const filtered = filterType === 'all'
      ? allModels
      : allModels.filter(m => m.type === filterType)
    const names = filtered.map(m => m.name)
    return ['all', ...new Set(names)]
  }, [allModels, filterType])

  const layananOptions = useMemo(() => {
    const unique = new Set(transactions.map(tx => tx.layanan).filter(Boolean))
    return ['all', ...Array.from(unique)]
  }, [transactions])

  // ── Statistik ──────────────────────────────────────────────────────────
  const totalPendapatan = useMemo(() => transactions.reduce((s, t) => s + (t.harga || 0), 0), [transactions])
  const totalTransaksi = transactions.length
  const rataRata = totalTransaksi ? Math.round(totalPendapatan / totalTransaksi) : 0

  const layananPopuler = useMemo(() => {
    const freq: Record<string, number> = {}
    transactions.forEach(tx => {
      freq[tx.layanan] = (freq[tx.layanan] || 0) + 1
    })
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1])
    return sorted[0] ?? null
  }, [transactions])

  const topKaryawan = useMemo(() => {
    const summary: Record<
      string,
      { total: number; sendiri: number; bareng: number; pendapatan: number }
    > = {}

    transactions.forEach(tx => {
      const operators = tx.karyawan
        .split(',')
        .map(name => name.trim())
        .filter(Boolean)

      const bagian = (tx.harga || 0) / (operators.length || 1)

      operators.forEach(name => {
        if (!summary[name]) {
          summary[name] = { total: 0, sendiri: 0, bareng: 0, pendapatan: 0 }
        }
        summary[name].total++
        summary[name].pendapatan += bagian
        if (operators.length === 1) summary[name].sendiri++
        else summary[name].bareng++
      })
    })

    return Object.entries(summary)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
  }, [transactions])

  const statsPerTipe = useMemo(() => {
    const res = { mobil: { count: 0, total: 0 }, motor: { count: 0, total: 0 } }
    transactions.forEach(tx => {
      if (tx.tipe === 'mobil') {
        res.mobil.count++
        res.mobil.total += (tx.harga || 0)
      } else {
        res.motor.count++
        res.motor.total += (tx.harga || 0)
      }
    })
    return res
  }, [transactions])

  // ── Filter transaksi ──────────────────────────────────────────────────
  const filteredTx = useMemo(() => {
    return transactions.filter(tx => {
      if (filterType !== 'all' && tx.tipe !== filterType) return false
      if (filterModel !== 'all' && tx.model !== filterModel) return false
      if (filterLayanan !== 'all' && tx.layanan !== filterLayanan) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return (
          tx.plat.toLowerCase().includes(q) ||
          tx.model.toLowerCase().includes(q) ||
          (tx.type ?? '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [transactions, filterType, filterModel, filterLayanan, search])

  // ── Handle status ──────────────────────────────────────────────────────
  const handleAdvanceStatus = async (id: string, current: Transaction['status']) => {
    if (!isAdmin || current === 'Selesai') return
    const next = current === 'Menunggu' ? 'Proses' : 'Selesai'
    setUpdatingId(id)
    try {
      await updateTransactionStatus(id, next)
      setToast({ visible: true, message: `Status diubah ke ${next}`, success: true })
    } catch {
      setToast({ visible: true, message: 'Gagal mengubah status!', success: false })
    } finally {
      setUpdatingId(null)
    }
  }

  // ── Export Excel ──────────────────────────────────────────────────────
  const exportToExcel = async () => {
    if (!isAdmin) return;
    if (transactions.length === 0) {
      setToast({ visible: true, message: 'Tidak ada data!', success: false });
      return;
    }

    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();

      const addStyledSheet = (data: Transaction[], sheetName: string) => {
        const ws = wb.addWorksheet(sheetName);
        ws.columns = [
          { header: 'No', key: 'no', width: 6 },
          { header: 'Tanggal', key: 'tanggal', width: 12 },
          { header: 'Jam', key: 'jam', width: 10 },
          { header: 'Plat', key: 'plat', width: 14 },
          { header: 'Model', key: 'model', width: 18 },
          { header: 'Jenis', key: 'jenis', width: 10 },
          { header: 'Tipe/Merk', key: 'type', width: 16 },
          { header: 'Layanan', key: 'layanan', width: 18 },
          { header: 'Karyawan', key: 'karyawan', width: 18 },
          { header: 'Metode Bayar', key: 'bayar', width: 14 },
          { header: 'Harga (Rp)', key: 'harga', width: 16 },
          { header: 'Status', key: 'status', width: 12 },
        ];

        const headerRow = ws.getRow(1);
        headerRow.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E3A8A' },
          };
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          };
        });

        data.forEach((tx, idx) => {
          const row = ws.addRow({
            no: idx + 1,
            tanggal: formatDate(tx.waktu),
            jam: formatTime(tx.waktu),
            plat: tx.plat,
            model: tx.model,
            jenis: tx.tipe === 'mobil' ? 'Mobil' : 'Motor',
            type: tx.type ?? '',
            layanan: tx.layanan,
            karyawan: tx.karyawan,
            bayar: tx.bayar,
            harga: tx.harga || 0,
            status: tx.status,
          });

          const rowIndex = row.number;
          if (rowIndex % 2 === 0) {
            row.eachCell((cell) => {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF3F4F6' },
              };
            });
          }

          const hargaCell = row.getCell(11);
          hargaCell.numFmt = 'Rp #,##0';
          hargaCell.alignment = { horizontal: 'right' };

          const statusCell = row.getCell(12);
          if (tx.status === 'Selesai') {
            statusCell.font = { color: { argb: 'FF059669' }, bold: true };
          } else if (tx.status === 'Proses') {
            statusCell.font = { color: { argb: 'FFD97706' }, bold: true };
          } else {
            statusCell.font = { color: { argb: 'FFDC2626' }, bold: true };
          }

          row.eachCell((cell) => {
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
              left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
              bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
              right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            };
          });
        });

        const totalHarga = data.reduce((sum, tx) => sum + (tx.harga || 0), 0);
        const totalRow = ws.addRow([
          '', '', '', '', '', '', '', '', '', 'TOTAL', totalHarga, '',
        ]);
        totalRow.getCell(11).numFmt = 'Rp #,##0';
        totalRow.getCell(11).alignment = { horizontal: 'right' };
        totalRow.eachCell((cell) => {
          cell.font = { bold: true, size: 11 };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E7FF' },
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
            left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
            bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
            right: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          };
        });

        ws.views = [{ state: 'frozen', ySplit: 1 }];
        ws.autoFilter = {
          from: { row: 1, column: 1 },
          to: { row: data.length + 1, column: 12 },
        };
      };

      const mobilTx = transactions.filter(tx => tx.tipe === 'mobil');
      const motorTx = transactions.filter(tx => tx.tipe === 'motor');

      addStyledSheet(transactions, 'Semua');
      addStyledSheet(mobilTx, 'Mobil');
      addStyledSheet(motorTx, 'Motor');

      const now = new Date();
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Laporan_CahayaWash_${now.toISOString().slice(0, 10)}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);

      setToast({ visible: true, message: 'Laporan berhasil diekspor!', success: true });
    } catch (err) {
      console.error(err);
      setToast({ visible: true, message: 'Gagal mengekspor laporan!', success: false });
    }
  };

  const hasActiveFilter = search !== '' || filterType !== 'all' || filterModel !== 'all' || filterLayanan !== 'all'

  function resetFilters() {
    setSearch('')
    setFilterType('all')
    setFilterModel('all')
    setFilterLayanan('all')
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

  const typeOptions = [
    { value: 'all', label: 'Kendaraan' },
    { value: 'mobil', label: 'Mobil' },
    { value: 'motor', label: 'Motor' },
  ]

  const modelOptionItems = [
    { value: 'all', label: 'Model' },
    ...modelOptionsFilter.filter(m => m !== 'all').map(m => ({ value: m, label: m })),
  ]

  const layananOptionItems = [
    { value: 'all', label: 'Layanan' },
    ...layananOptions.filter(l => l !== 'all').map(l => ({ value: l, label: l })),
  ]

  return (
    <div className="space-y-5 pb-24">
      <Toast {...toast} onHide={() => setToast(t => ({ ...t, visible: false }))} />

      <div>
        <h2 className="text-[22px] font-extrabold text-on-surface">Riwayat & Laporan</h2>
        <p className="text-sm text-on-surface-variant mt-0.5">Pantau semua transaksi dan performa</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex bg-surface-container-lowest border border-outline-variant rounded-2xl p-1 gap-1">
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'history'
              ? 'bg-primary text-white shadow-md'
              : 'text-on-surface-variant hover:bg-surface-container'
          }`}
        >
          Riwayat Transaksi
        </button>
        <button
          onClick={() => setActiveTab('report')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'report'
              ? 'bg-primary text-white shadow-md'
              : 'text-on-surface-variant hover:bg-surface-container'
          }`}
        >
          Laporan
        </button>
      </div>

      {activeTab === 'report' ? (
        /* ===== TAB LAPORAN ===== */
        <div className="space-y-5">
          {/* Statistik Utama */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
              <div className="w-9 h-9 rounded-xl bg-secondary-container flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-primary text-[18px] icon-fill">trending_up</span>
              </div>
              <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wide">Total Pendapatan</p>
              <h3 className="text-base font-extrabold mt-0.5 text-on-surface">{fmtRupiah(totalPendapatan)}</h3>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
              <div className="w-9 h-9 rounded-xl bg-success-container flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-success text-[18px] icon-fill">receipt_long</span>
              </div>
              <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wide">Total Unit Dicuci</p>
              <h3 className="text-base font-extrabold mt-0.5 text-on-surface">{totalTransaksi} unit</h3>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
              <div className="w-9 h-9 rounded-xl bg-tertiary-container flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-tertiary text-[18px] icon-fill">monitoring</span>
              </div>
              <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wide">Rata-rata Transaksi</p>
              <h3 className="text-base font-extrabold mt-0.5 text-on-surface">{fmtRupiah(rataRata)}</h3>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
              <div className="w-9 h-9 rounded-xl bg-error-container flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-error text-[18px] icon-fill">star</span>
              </div>
              <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wide">Layanan Terpopuler</p>
              <h3 className="text-sm font-extrabold mt-0.5 text-on-surface truncate">
                {layananPopuler ? `${layananPopuler[0]} (${layananPopuler[1]}x)` : '-'}
              </h3>
            </div>
          </div>

          {/* Top Karyawan */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">emoji_events</span>
                Operator dengan Cucian Terbanyak
              </h4>
              <span className="text-xs text-on-surface-variant bg-surface-container px-2 py-1 rounded-full">
                Total Unit: {totalTransaksi}
              </span>
            </div>
            {topKaryawan.length > 0 ? (
              <div className="space-y-3">
                {topKaryawan.slice(0, 3).map((item, index) => (
                  <div key={item.name} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      #{index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-on-surface truncate">{item.name}</p>
                      <p className="text-[11px] text-on-surface-variant">
                        Sendiri: {item.sendiri} • Bareng: {item.bareng}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-on-surface-variant">{item.total} Unit</p>
                      <p className="text-[11px] font-semibold text-primary">
                        {fmtRupiah(Math.round(item.pendapatan))}
                      </p>
                    </div>
                  </div>
                ))}
                {topKaryawan.length > 3 && (
                  <p className="text-xs text-on-surface-variant text-center mt-1">
                    +{topKaryawan.length - 3} karyawan lainnya
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-on-surface-variant">Belum ada data</p>
            )}
          </div>

          {/* Perbandingan Mobil vs Motor */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-primary text-[20px] icon-fill">directions_car</span>
                <p className="text-xs font-semibold text-on-surface">Mobil</p>
              </div>
              <p className="text-sm font-extrabold text-on-surface">{statsPerTipe.mobil.count} unit</p>
              <p className="text-xs text-on-surface-variant mt-0.5">{fmtRupiah(statsPerTipe.mobil.total)}</p>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-error text-[20px] icon-fill">motorcycle</span>
                <p className="text-xs font-semibold text-on-surface">Motor</p>
              </div>
              <p className="text-sm font-extrabold text-on-surface">{statsPerTipe.motor.count} unit</p>
              <p className="text-xs text-on-surface-variant mt-0.5">{fmtRupiah(statsPerTipe.motor.total)}</p>
            </div>
          </div>

          {isAdmin && (
            <button
              onClick={exportToExcel}
              className="w-full h-12 bg-success text-white rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-success/20"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Ekspor ke Excel
            </button>
          )}
        </div>
      ) : (
        /* ===== TAB RIWAYAT ===== */
        <>
          {/* Filter Card */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[140px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Cari plat, model, atau tipe..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 bg-surface-container border border-outline-variant rounded-full text-sm focus:border-primary outline-none transition-all"
                />
              </div>

              <Dropdown
                options={typeOptions}
                value={filterType}
                onChange={(val) => {
                  setFilterType(val as any)
                  setFilterModel('all')
                }}
                placeholder="Kendaraan"
                className="flex-1 min-w-[100px]"
              />

              <Dropdown
                options={modelOptionItems}
                value={filterModel}
                onChange={setFilterModel}
                placeholder="Model"
                className="flex-1 min-w-[100px]"
              />

              <Dropdown
                options={layananOptionItems}
                value={filterLayanan}
                onChange={setFilterLayanan}
                placeholder="Layanan"
                className="flex-1 min-w-[100px]"
              />

              {hasActiveFilter && (
                <button
                  onClick={resetFilters}
                  className="h-9 w-9 shrink-0 flex items-center justify-center bg-error-container text-error rounded-full active:scale-95 transition-all"
                  title="Reset filter"
                >
                  <span className="material-symbols-outlined text-[18px]">filter_list_off</span>
                </button>
              )}
            </div>
          </div>

          {/* Daftar Transaksi */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-bold text-on-surface">Daftar Transaksi</h4>
              <span className="text-xs text-on-surface-variant">{filteredTx.length} data</span>
            </div>

            {filteredTx.length === 0 ? (
              <div className="text-center py-10 text-on-surface-variant text-sm bg-surface-container-lowest border border-outline-variant rounded-2xl">
                Tidak ada transaksi
              </div>
            ) : (
              filteredTx.map((tx) => {
                const statusIndex = ['Menunggu', 'Proses', 'Selesai'].indexOf(tx.status)
                const canAdvance = isAdmin && tx.status !== 'Selesai'
                return (
                  <div
                    key={tx.id}
                    className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            tx.tipe === 'mobil' ? 'bg-secondary-container' : 'bg-error-container'
                          }`}
                        >
                          <span
                            className={`material-symbols-outlined text-[20px] icon-fill ${
                              tx.tipe === 'mobil' ? 'text-primary' : 'text-error'
                            }`}
                          >
                            {tx.tipe === 'mobil' ? 'directions_car' : 'motorcycle'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-on-surface">{tx.plat}</p>
                          <p className="text-xs text-on-surface-variant">
                            {tx.model}
                            {tx.type && (
                              <span className="text-on-surface-variant/70"> · {tx.type}</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end gap-1.5">
                        <p className="text-sm font-extrabold text-primary">{fmtRupiah(tx.harga)}</p>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                              statusIndex === 2
                                ? 'bg-success-container text-success'
                                : statusIndex === 1
                                ? 'bg-tertiary-container text-tertiary'
                                : 'bg-error-container text-error'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                statusIndex === 2 ? 'bg-success' : statusIndex === 1 ? 'bg-tertiary' : 'bg-error'
                              }`}
                            />
                            {tx.status}
                          </span>
                          {canAdvance && (
                            <button
                              onClick={() => handleAdvanceStatus(tx.id, tx.status)}
                              disabled={updatingId === tx.id}
                              className="w-6 h-6 flex items-center justify-center rounded-full bg-primary hover:bg-primary-dark active:scale-90 transition-all disabled:opacity-50"
                              title="Majukan status"
                            >
                              {updatingId === tx.id ? (
                                <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                              ) : (
                                <span className="material-symbols-outlined text-white" style={{ fontSize: "14px" }}>
                                  arrow_forward_ios
                                </span>
                              )}
                            </button>
                          )}
                          {/* ─── TOMBOL EDIT ─── */}
                          {isAdmin && (
                            <button
                              onClick={() => openEditModal(tx)}
                              className="w-6 h-6 flex items-center justify-center rounded-full bg-yellow-400 hover:bg-yellow-500 active:scale-90 transition-all shadow-sm"
                              title="Edit transaksi"
                            >
                              <span className="material-symbols-outlined text-white" style={{ fontSize: "14px" }}>edit</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-outline-variant/50 pt-2 mt-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs text-on-surface-variant flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">water_drop</span>
                          {tx.layanan}
                        </span>
                        <span className="text-xs text-on-surface-variant flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">person</span>
                          {tx.karyawan.split(' ')[0]}
                        </span>
                        <span className="text-xs text-outline flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">payments</span>
                          {tx.bayar}
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

      {/* ─── MODAL EDIT ────────────────────────────────────────────────── */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-surface-container-lowest border border-outline-variant rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-on-surface mb-5">Edit Transaksi</h3>

            {/* Jenis Kendaraan */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Jenis Kendaraan</label>
              <div className="grid grid-cols-2 gap-3 p-1 bg-surface-container rounded-2xl mt-1">
                {(['mobil', 'motor'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setEditVehicleType(type)
                      setEditModel('')
                      setEditOperators([])
                    }}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all ${
                      editVehicleType === type ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">{type === 'mobil' ? 'directions_car' : 'motorcycle'}</span>
                    {type === 'mobil' ? 'Mobil' : 'Motor'}
                  </button>
                ))}
              </div>
            </div>

            {/* Plat */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Nomor Plat</label>
              <input
                type="text"
                placeholder="B 1234 XYZ"
                value={editPlate}
                onChange={e => setEditPlate(e.target.value.toUpperCase().slice(0, 10))}
                className="w-full h-12 px-4 bg-surface-container-lowest border-2 border-outline-variant rounded-xl text-lg font-extrabold tracking-[0.05em] uppercase focus:border-primary transition-colors"
              />
            </div>

            {/* Model */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Model</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {modelOptions.length === 0 ? (
                  <p className="text-sm text-on-surface-variant">Belum ada data model untuk tipe ini</p>
                ) : (
                  modelOptions.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setEditModel(m)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                        editModel === m
                          ? 'bg-primary text-white shadow-md'
                          : 'bg-surface-container border border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                    >
                      {m}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Tipe / Merk */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Tipe / Merk Kendaraan</label>
              <input
                type="text"
                placeholder={editVehicleType === 'mobil' ? 'Contoh: Innova, Avanza' : 'Contoh: Scoopy, Vario'}
                value={editType}
                onChange={e => setEditType(e.target.value)}
                maxLength={50}
                className="w-full h-12 px-4 bg-surface-container-lowest border-2 border-outline-variant rounded-xl text-sm font-medium focus:border-primary transition-colors"
              />
            </div>

            {/* Layanan — pilihan sebelumnya langsung terlihat */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Layanan</label>
              {layananItems.map(item => (
                <label
                  key={item.key}
                  className={`flex items-center gap-3 p-3 bg-surface-container-lowest border-2 rounded-xl cursor-pointer transition-colors mt-1 ${
                    editLayanan === item.key ? 'border-primary bg-primary/5' : 'border-outline-variant hover:border-primary/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="edit-layanan"
                    value={item.key}
                    checked={editLayanan === item.key}
                    onChange={() => setEditLayanan(item.key)}
                    className="w-4 h-4 accent-primary"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-on-surface">{item.label}</p>
                    <p className="text-xs text-on-surface-variant">{item.sub}</p>
                  </div>
                  <span className="text-sm font-bold text-primary">
                    Rp {(editPrices[item.key] ?? 0).toLocaleString('id-ID')}
                  </span>
                </label>
              ))}
            </div>

            {/* Operator */}
            <div className="mb-4" ref={editDropdownRef}>
              <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Operator</label>
              {operatorOptions.length === 0 ? (
                <div className="w-full h-12 px-4 bg-surface-container border-2 border-outline-variant rounded-xl text-sm font-medium flex items-center text-on-surface-variant mt-1">
                  Belum ada operator terdaftar
                </div>
              ) : (
                <div className="relative mt-1">
                  <div
                    onClick={() => setEditDropdownOpen(!editDropdownOpen)}
                    className="w-full min-h-[52px] px-4 py-2 bg-surface-container-lowest border-2 rounded-xl cursor-pointer flex items-center flex-wrap gap-1.5 transition-colors border-outline-variant hover:border-primary/40"
                  >
                    {editOperators.length === 0 ? (
                      <span className="text-on-surface-variant text-sm">Pilih operator...</span>
                    ) : (
                      <>
                        {editOperators.map((op) => (
                          <span
                            key={op}
                            className="inline-flex items-center gap-0.5 px-2.5 py-0.5 bg-primary/10 text-primary rounded-full text-sm font-medium"
                          >
                            {op}
                            {editVehicleType === 'mobil' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleEditOperator(op)
                                }}
                                className="w-4 h-4 rounded-full hover:bg-primary/20 flex items-center justify-center text-primary"
                              >
                                <span className="material-symbols-outlined text-[14px]">close</span>
                              </button>
                            )}
                          </span>
                        ))}
                        {editOperators.length > 1 && editVehicleType === 'mobil' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              clearEditOperators()
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
                        {editDropdownOpen ? 'expand_less' : 'expand_more'}
                      </span>
                    </span>
                  </div>

                  {editDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg max-h-60 overflow-y-auto py-1.5">
                      {operatorOptions.map((op) => {
                        const isChecked = editOperators.includes(op.nama)
                        return (
                          <label
                            key={op.nama}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container cursor-pointer transition-colors"
                          >
                            <input
                              type={editVehicleType === 'motor' ? 'radio' : 'checkbox'}
                              name={editVehicleType === 'motor' ? 'edit-operator' : undefined}
                              checked={isChecked}
                              onChange={() => toggleEditOperator(op.nama)}
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
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-on-surface-variant">
                  {editOperators.length === 0
                    ? 'Belum ada operator dipilih'
                    : `${editOperators.length} operator dipilih`}
                </p>
                <span className="text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full">
                  {editVehicleType === 'motor' ? 'Pilih 1 operator' : 'Pilih banyak operator'}
                </span>
              </div>
            </div>

            {/* Metode Bayar */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Metode Bayar</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {bayarItems.map(item => (
                  <label
                    key={item.key}
                    className={`flex flex-col items-center gap-1.5 p-3 border-2 rounded-xl cursor-pointer text-center transition-colors ${
                      editBayar === item.key ? 'bg-primary-container border-primary' : 'bg-surface-container-lowest border-outline-variant'
                    }`}
                  >
                    <input
                      type="radio"
                      name="edit-bayar"
                      value={item.key}
                      checked={editBayar === item.key}
                      onChange={() => setEditBayar(item.key)}
                      className="hidden"
                    />
                    <span className={`material-symbols-outlined text-[22px] ${editBayar === item.key ? 'text-primary icon-fill' : 'text-on-surface-variant'}`}>
                      {item.icon}
                    </span>
                    <span className={`text-xs ${editBayar === item.key ? 'font-semibold text-primary' : 'font-medium text-on-surface-variant'}`}>
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-5">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs text-on-surface-variant font-medium">Total</p>
                  <h3 className="text-2xl font-extrabold text-primary mt-0.5">
                    Rp {(editPrices[editLayanan] ?? 0).toLocaleString('id-ID')}
                  </h3>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
                  <span className="material-symbols-outlined text-white icon-fill">sell</span>
                </div>
              </div>
            </div>

            {/* Tombol aksi */}
            <div className="flex gap-3">
              <button
                onClick={() => setEditingTx(null)}
                className="flex-1 h-12 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition"
              >
                Batal
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 h-12 rounded-xl bg-primary text-white text-sm font-semibold shadow-lg shadow-primary/20 active:scale-95 transition"
              >
                Simpan
              </button>
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