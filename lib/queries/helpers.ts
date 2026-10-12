import { type DBTransaction, type DBStaff, type DBVehicle } from '@/lib/Supabase'
import type { Transaction, StaffMember, Vehicle } from '@/lib/Data'

export function mapDBStatusToApp(status: DBTransaction['status']): Transaction['status'] {
  if (status === 'Antre') return 'Proses'
  return status as Transaction['status']
}

export function toAppTransaction(db: DBTransaction): Transaction & { id: string } {
  return {
    id: db.id,
    plat: db.plat,
    model: db.model,
    type: db.type ?? undefined,
    karyawan: db.karyawan,
    layanan: db.layanan as Transaction['layanan'],
    bayar: db.bayar,
    harga: db.harga,
    status: mapDBStatusToApp(db.status),
    tipe: db.tipe,
    waktu: db.created_at,
    createdAt: db.created_at,
  }
}

export function toAppStaff(db: DBStaff): StaffMember & { id: string } {
  return {
    id: db.id,
    nama: db.nama,
    jabatan: db.jabatan,
    initials: db.initials,
    color: db.color,
    status: db.status,
    cuci: 0,
    rating: 4.8,
  }
}

export function toAppVehicle(db: DBVehicle): Vehicle {
  return { id: db.id, name: db.name, price: db.price_expres }
}

// pagination helper: fetch all rows with .range() page 1000, order stable created_at desc, id desc
export async function fetchAllPaginated<T>(
  buildQuery: (fromIdx: number, toIdx: number) => { query: unknown },
  // we instead accept callback that returns supabase query builder; type any for flexibility
  fetcher: (fromIdx: number, toIdx: number) => Promise<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const PAGE = 1000
  const all: T[] = []
  let offset = 0
  for (;;) {
    const { data, error } = await fetcher(offset, offset + PAGE - 1)
    if (error) throw error
    const rows = (data ?? []) as T[]
    all.push(...rows)
    if (rows.length < PAGE) break
    offset += PAGE
    // guard against infinite loop
    if (offset > 100000) break
  }
  return all
}

export const TX_COLUMNS_MIN = 'id,plat,model,type,karyawan,layanan,bayar,harga,status,tipe,created_at'
export const TX_PRICE_DATE = 'harga,created_at'
export const TX_CREATED_HARGA = 'created_at,harga'
