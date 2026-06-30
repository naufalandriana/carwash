import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  global: { headers: { 'x-app-name': 'otowash' } },
})

// ─── Tipe yang sesuai dengan tabel di Supabase ──────────────────────────────

export interface DBTransaction {
  id: string
  plat: string
  model: string
  karyawan: string
  layanan: 'Expres Wash' | 'Hidrolik Wash'  // sudah diperbarui
  bayar: 'Tunai' | 'QRIS' | 'Transfer'
  harga: number
  status: 'Selesai' | 'Proses' | 'Antre'
  tipe: 'mobil' | 'motor'
  created_at: string
}

export interface DBStaff {
  id: string
  nama: string
  jabatan: string
  initials: string
  color: string
  status: 'Aktif' | 'Nonaktif'
  created_at: string
}

export interface DBVehicle {
  id: string
  name: string
  tipe: 'mobil' | 'motor'
  price_expres: number   // kolom baru
  price_hidrolik: number // kolom baru
  created_at: string
}