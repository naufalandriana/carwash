'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useAppStore, useUser, useVehiclesDB } from '@/lib/Store'
import Toast from '@/components/ui/Toast'
import Guard from '@/components/auth/Guard'
import type { Transaction } from '@/lib/Data'

function fmtRupiah(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID')
}

// ============ Custom Dropdown Component ============
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
  const { transactions, updateTransactionStatus } = useAppStore()
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

  // Ambil daftar model unik dari database kendaraan
  const allModels = useMemo(() => {
    return vehiclesDB.map(v => ({ name: v.name, type: v.tipe }))
  }, [vehiclesDB])

  // Opsi model berdasarkan filter kendaraan
  const modelOptions = useMemo(() => {
    const filtered = filterType === 'all'
      ? allModels
      : allModels.filter(m => m.type === filterType)
    const names = filtered.map(m => m.name)
    return ['all', ...new Set(names)]
  }, [allModels, filterType])

  // Opsi layanan unik dari transaksi
  const layananOptions = useMemo(() => {
    const unique = new Set(transactions.map(tx => tx.layanan).filter(Boolean))
    return ['all', ...Array.from(unique)]
  }, [transactions])

  // Statistik
  const totalPendapatan = useMemo(() => transactions.reduce((s, t) => s + t.harga, 0), [transactions])
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

      const bagian = tx.harga / operators.length

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
        res.mobil.total += tx.harga
      } else {
        res.motor.count++
        res.motor.total += tx.harga
      }
    })
    return res
  }, [transactions])

  // Filter transaksi
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

  // ============ EXPORT EXCEL DENGAN EXCELJS + KOLOM JENIS ============
  const exportToExcel = async () => {
    if (!isAdmin) return;
    if (transactions.length === 0) {
      setToast({ visible: true, message: 'Tidak ada data!', success: false });
      return;
    }

    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();

      // Helper untuk menambah sheet dengan styling keren
      const addStyledSheet = (data: Transaction[], sheetName: string) => {
        const ws = wb.addWorksheet(sheetName);

        // Definisi kolom - sekarang ada kolom 'Jenis' (Mobil/Motor)
        ws.columns = [
          { header: 'No', key: 'no', width: 6 },
          { header: 'Tanggal', key: 'tanggal', width: 12 },
          { header: 'Jam', key: 'jam', width: 10 },
          { header: 'Plat', key: 'plat', width: 14 },
          { header: 'Model', key: 'model', width: 18 },
          { header: 'Jenis', key: 'jenis', width: 10 },   // <--- KOLOM BARU
          { header: 'Tipe/Merk', key: 'type', width: 16 },
          { header: 'Layanan', key: 'layanan', width: 18 },
          { header: 'Karyawan', key: 'karyawan', width: 18 },
          { header: 'Metode Bayar', key: 'bayar', width: 14 },
          { header: 'Harga (Rp)', key: 'harga', width: 16 },
          { header: 'Status', key: 'status', width: 12 },
        ];

        // Style header
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

        // Isi data
        data.forEach((tx, idx) => {
          const row = ws.addRow({
            no: idx + 1,
            tanggal: formatDate(tx.waktu),
            jam: formatTime(tx.waktu),
            plat: tx.plat,
            model: tx.model,
            jenis: tx.tipe === 'mobil' ? 'Mobil' : 'Motor',  // <--- ISI JENIS
            type: tx.type ?? '',
            layanan: tx.layanan,
            karyawan: tx.karyawan,
            bayar: tx.bayar,
            harga: tx.harga,
            status: tx.status,
          });

          // Warna selang-seling (zebra stripe)
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

          // Format rupiah di kolom harga (sekarang kolom ke-11)
          const hargaCell = row.getCell(11);
          hargaCell.numFmt = 'Rp #,##0';
          hargaCell.alignment = { horizontal: 'right' };

          // Warna status (sekarang kolom ke-12)
          const statusCell = row.getCell(12);
          if (tx.status === 'Selesai') {
            statusCell.font = { color: { argb: 'FF059669' }, bold: true };
          } else if (tx.status === 'Proses') {
            statusCell.font = { color: { argb: 'FFD97706' }, bold: true };
          } else {
            statusCell.font = { color: { argb: 'FFDC2626' }, bold: true };
          }

          // Border setiap cell
          row.eachCell((cell) => {
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
              left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
              bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
              right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            };
          });
        });

        // Baris total
        const totalHarga = data.reduce((sum, tx) => sum + tx.harga, 0);
        const totalRow = ws.addRow([
          '', '', '', '', '', '', '', '', '', 'TOTAL', totalHarga, '',
        ]);
        totalRow.getCell(11).numFmt = 'Rp #,##0'; // harga di kolom 11
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

        // Freeze baris pertama
        ws.views = [{ state: 'frozen', ySplit: 1 }];
        // Auto filter (sesuaikan range: sekarang 12 kolom)
        ws.autoFilter = {
          from: { row: 1, column: 1 },
          to: { row: data.length + 1, column: 12 },
        };
      };

      // Pisahkan data
      const mobilTx = transactions.filter(tx => tx.tipe === 'mobil');
      const motorTx = transactions.filter(tx => tx.tipe === 'motor');

      addStyledSheet(transactions, 'Semua');
      addStyledSheet(mobilTx, 'Mobil');
      addStyledSheet(motorTx, 'Motor');

      // Simpan file
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

  // helper untuk label opsi
  const typeOptions = [
    { value: 'all', label: 'Kendaraan' },
    { value: 'mobil', label: 'Mobil' },
    { value: 'motor', label: 'Motor' },
  ]

  const modelOptionItems = [
    { value: 'all', label: 'Model' },
    ...modelOptions.filter(m => m !== 'all').map(m => ({ value: m, label: m })),
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
          {/* Filter Card - Modern dengan Custom Dropdown */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
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

              {/* Dropdown Kendaraan */}
              <Dropdown
                options={typeOptions}
                value={filterType}
                onChange={(val) => {
                  setFilterType(val as any)
                  setFilterModel('all') // reset model saat ganti tipe
                }}
                placeholder="Kendaraan"
                className="flex-1 min-w-[100px]"
              />

              {/* Dropdown Model */}
              <Dropdown
                options={modelOptionItems}
                value={filterModel}
                onChange={setFilterModel}
                placeholder="Model"
                className="flex-1 min-w-[100px]"
              />

              {/* Dropdown Layanan */}
              <Dropdown
                options={layananOptionItems}
                value={filterLayanan}
                onChange={setFilterLayanan}
                placeholder="Layanan"
                className="flex-1 min-w-[100px]"
              />

              {/* Reset Filter */}
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
                                <span className="material-symbols-outlined text-white text-[14px]">
                                  arrow_forward_ios
                                </span>
                              )}
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