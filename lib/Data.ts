export type VehicleType = 'mobil' | 'motor'
export type Layanan = 'Expres Wash' | 'Hidrolik Wash'
export type Bayar = 'Tunai' | 'QRIS' | 'Transfer'
export type Status = 'Selesai' | 'Proses' | 'Antre'

export const TransactionStatuses = ['Selesai', 'Proses', 'Menunggu'] as const;
export type TransactionStatus = typeof TransactionStatuses[number];

export interface Transaction {
  plat: string
  model: string
  type?: string
  karyawan: string
  layanan: Layanan
  bayar: Bayar
  harga: number
  status: TransactionStatus
  tipe: VehicleType
  waktu?: string
  createdAt?: string
}

export interface StaffMember {
  nama: string
  jabatan: string
  initials: string
  color: string
  status: 'Aktif' | 'Nonaktif'
  cuci?: number
  rating?: number
}

export interface Vehicle {
  id: string
  name: string
  price: number
}