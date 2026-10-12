import { create } from 'zustand'
import { useMemo } from 'react'
import { supabase, DBTransaction, DBStaff, DBVehicle } from './Supabase'
import type { Transaction, StaffMember, Vehicle, Expense } from './Data'

// ─── User Type ──────────────────────────────────────────────────────────────
export interface User {
  role: 'admin' | 'guest'
  name?: string
  id?: string
  username?: string
}

// ─── Helpers: DB → App types ──────────────────────────────────────────────

function mapDBStatusToApp(status: DBTransaction['status']): Transaction['status'] {
  if (status === 'Antre') return 'Proses'
  return status as Transaction['status']
}

function mapAppStatusToDB(status: Transaction['status']): DBTransaction['status'] {
  if (status === 'Proses') return 'Proses'
  if (status === 'Selesai') return 'Selesai'
  return status as DBTransaction['status']
}

function toAppTransaction(db: DBTransaction): Transaction & { id: string } {
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

function toAppStaff(db: DBStaff): StaffMember & { id: string } {
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

function toAppVehicle(db: DBVehicle): Vehicle {
  return {
    id: db.id,
    name: db.name,
    price: db.price_expres,
  }
}

// ─── Store State ─────────────────────────────────────────────────────────────

interface LoadingState {
  transactions: boolean
  staff: boolean
  vehicles: boolean
  expenses: boolean
}

interface AppStore {
  transactions: (Transaction & { id: string })[]
  staff: (StaffMember & { id: string })[]
  vehicles: Vehicle[]
  vehiclesDB: DBVehicle[]
  expenses: Expense[]

  loading: LoadingState
  error: string | null
  initialized: boolean

  user: User | null
  login: (user: User) => void
  logout: () => void
  authenticateAdmin: (password: string) => Promise<void>

  fetchTransactions: () => Promise<void>
  addTransaction: (tx: Omit<Transaction, 'waktu' | 'createdAt'>) => Promise<void>
  updateTransactionStatus: (id: string, status: Transaction['status']) => Promise<void>
  updateTransaction: (id: string, updates: Partial<Omit<Transaction, 'id' | 'waktu' | 'createdAt'>>) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>

  // ── Report: fetch semua transaksi dengan rentang tanggal (tanpa limit) ──
  fetchReportTransactions: (from?: string, to?: string) => Promise<(Transaction & { id: string })[]>

  // ── Report: ambil tanggal transaksi tertua & terbaru (untuk daftar bulan) ──
  fetchTransactionDateRange: () => Promise<{ oldest: string; newest: string } | null>

  fetchStaff: () => Promise<void>
  addStaff: (staff: Omit<DBStaff, 'id' | 'created_at'>) => Promise<void>
  updateStaff: (id: string, updates: Partial<Pick<DBStaff, 'nama' | 'initials'>>) => Promise<void>
  deleteStaff: (id: string) => Promise<void>

  fetchVehicles: () => Promise<void>
  addVehicle: (vehicle: Omit<DBVehicle, 'id' | 'created_at'>) => Promise<void>
  deleteVehicle: (id: string) => Promise<void>

  // ── Expense methods ──
  fetchExpenses: () => Promise<void>
  addExpense: (data: Omit<Expense, 'id' | 'created_at'>) => Promise<void>
  updateExpense: (id: string, data: Partial<Omit<Expense, 'id' | 'created_at'>>) => Promise<void>
  deleteExpense: (id: string) => Promise<void>

  initStore: () => Promise<void>
  subscribeRealtime: () => () => void
  clearError: () => void
}

// Narrow column selections — avoid select('*')
const TX_COLS = 'id,plat,model,type,karyawan,layanan,bayar,harga,status,tipe,created_at'
const STAFF_COLS = 'id,nama,jabatan,initials,color,status,created_at'
const VEHICLE_COLS = 'id,name,tipe,price_expres,price_hidrolik,created_at'
const EXPENSE_COLS = 'id,nama_pengeluaran,kategori,nominal,keterangan,created_at'

// ─── Store ───────────────────────────────────────────────────────────────────

export const useAppStore = create<AppStore>((set, get) => ({
  transactions: [],
  staff: [],
  vehicles: [],
  vehiclesDB: [],
  expenses: [],
  loading: {
    transactions: false,
    staff: false,
    vehicles: false,
    expenses: false,
  },
  error: null,
  initialized: false,
  user: null,

  // ── Auth ──────────────────────────────────────────────────────────────────
  login: (user) => {
    set({ user })
    localStorage.setItem('otowash_user', JSON.stringify(user))
  },

  logout: () => {
    set({
      user: null,
      transactions: [],
      staff: [],
      vehicles: [],
      vehiclesDB: [],
      expenses: [],
      initialized: false,
      error: null,
    })
    localStorage.removeItem('otowash_user')
  },

  authenticateAdmin: async (password: string) => {
    set({ error: null })
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      const data = await response.json()

      if (!response.ok) {
        set({ error: data.error || 'Login gagal' })
        throw new Error(data.error || 'Login gagal')
      }

      get().login({
        role: 'admin',
        name: data.user.name,
        id: data.user.id,
        username: data.user.username,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login gagal'
      set({ error: msg })
      throw err
    }
  },

  clearError: () => set({ error: null }),

  // ── Fetch Transactions (default, untuk riwayat live) ────────────────────
  fetchTransactions: async () => {
    set((s) => ({ loading: { ...s.loading, transactions: true }, error: null }))
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(TX_COLS)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      set({
        transactions: (data as DBTransaction[]).map(toAppTransaction),
        loading: { ...get().loading, transactions: false },
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      set((s) => ({ error: msg, loading: { ...s.loading, transactions: false } }))
    }
  },

  // ── Report: fetch SEMUA transaksi dengan rentang tanggal (no limit) ─────
  // Pagination penuh .range() sampai habis — urut stabil created_at desc, id desc
  fetchReportTransactions: async (from, to) => {
    try {
      const PAGE = 1000
      const all: DBTransaction[] = []
      let offset = 0
      const gte = from ? `${from}T00:00:00+07:00` : null
      const lte = to ? `${to}T23:59:59.999+07:00` : null
      for (;;) {
        let q = supabase
          .from('transactions')
          .select(TX_COLS)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(offset, offset + PAGE - 1)
        if (gte) q = q.gte('created_at', gte)
        if (lte) q = q.lte('created_at', lte)
        const { data, error } = await q
        if (error) throw error
        const rows = (data ?? []) as DBTransaction[]
        all.push(...rows)
        if (rows.length < PAGE) break
        offset += PAGE
        if (offset > 200000) break
      }
      return all.map(toAppTransaction)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      set({ error: msg })
      throw err
    }
  },

  // ── Report: ambil rentang tanggal transaksi tertua & terbaru ────────────
  fetchTransactionDateRange: async () => {
    try {
      const [oldestRes, newestRes] = await Promise.all([
        supabase.from('transactions').select('created_at').order('created_at', { ascending: true }).limit(1),
        supabase.from('transactions').select('created_at').order('created_at', { ascending: false }).limit(1),
      ])
      if (oldestRes.error) throw oldestRes.error
      if (newestRes.error) throw newestRes.error

      const oldest = oldestRes.data?.[0]?.created_at
      const newest = newestRes.data?.[0]?.created_at
      if (!oldest || !newest) return null

      return { oldest, newest }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      set({ error: msg })
      return null
    }
  },

  // ── Add Transaction ──────────────────────────────────────────────────────
  addTransaction: async (tx) => {
    const tempId = `temp-${Date.now()}`
    const nowIso = new Date().toISOString()
    const optimistic: Transaction & { id: string } = {
      ...tx,
      id: tempId,
      waktu: nowIso,
      createdAt: nowIso,
    }
    set((s) => ({ transactions: [optimistic, ...s.transactions].slice(0, 100) }))

    try {
      const dbStatus = mapAppStatusToDB(tx.status)

      const { data, error } = await supabase
        .from('transactions')
        .insert({
          plat: tx.plat,
          model: tx.model,
          type: tx.type || null,
          karyawan: tx.karyawan,
          layanan: tx.layanan,
          bayar: tx.bayar,
          harga: tx.harga,
          status: dbStatus,
          tipe: tx.tipe,
        })
        .select()
        .single()
      if (error) throw error

      set((s) => ({
        transactions: s.transactions.map((t) =>
          t.id === tempId ? toAppTransaction(data as DBTransaction) : t
        ),
      }))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      set((s) => ({
        transactions: s.transactions.filter((t) => t.id !== tempId),
        error: msg,
      }))
      throw err
    }
  },

  // ── Update Transaction Status ────────────────────────────────────────────
  updateTransactionStatus: async (id, status) => {
    const prev = get().transactions
    set((s) => ({
      transactions: s.transactions.map((t) => (t.id === id ? { ...t, status } : t)),
    }))
    try {
      const dbStatus = mapAppStatusToDB(status)
      const { error } = await supabase
        .from('transactions')
        .update({ status: dbStatus })
        .eq('id', id)
      if (error) throw error
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      set({ transactions: prev, error: msg })
      throw err
    }
  },

  // ── UPDATE TRANSACTION (FULL EDIT) ──────────────────────────────────────
  updateTransaction: async (id, updates) => {
    const prev = get().transactions
    set((s) => ({
      transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }))
    try {
      const dbUpdates: Record<string, unknown> = { ...updates }
      if (updates.status) {
        dbUpdates.status = mapAppStatusToDB(updates.status)
      }
      const { error } = await supabase
        .from('transactions')
        .update(dbUpdates)
        .eq('id', id)
      if (error) throw error
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      set({ transactions: prev, error: msg })
      throw err
    }
  },

  // ── Delete Transaction ──────────────────────────────────────────────────
  deleteTransaction: async (id) => {
    const prev = get().transactions
    set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }))
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
      if (error) throw error
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      set({ transactions: prev, error: msg })
      throw err
    }
  },

  // ── Fetch Staff ──────────────────────────────────────────────────────────
  fetchStaff: async () => {
    set((s) => ({ loading: { ...s.loading, staff: true } }))
    try {
      const { data, error } = await supabase
        .from('staff')
        .select(STAFF_COLS)
        .eq('status', 'Aktif')
        .order('nama')
      if (error) throw error
      set({
        staff: (data as DBStaff[]).map(toAppStaff),
        loading: { ...get().loading, staff: false },
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      set((s) => ({ error: msg, loading: { ...s.loading, staff: false } }))
    }
  },

  // ── Add Staff ─────────────────────────────────────────────────────────────
  addStaff: async (staff) => {
    try {
      const { data, error } = await supabase
        .from('staff')
        .insert({
          nama: staff.nama,
          jabatan: staff.jabatan,
          initials: staff.initials,
          color: staff.color,
          status: staff.status,
        })
        .select()
        .single()
      if (error) throw error
      await get().fetchStaff()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      set({ error: msg })
      throw err
    }
  },

  // ── Update Staff (edit nama, dll) ────────────────────────────────────────
  updateStaff: async (id, updates) => {
    const prev = get().staff
    set((s) => ({
      staff: s.staff.map((st) => (st.id === id ? { ...st, ...updates } : st)),
    }))
    try {
      const { error } = await supabase
        .from('staff')
        .update(updates)
        .eq('id', id)
      if (error) throw error
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      set({ staff: prev, error: msg })
      throw err
    }
  },

  // ── Delete Staff ──────────────────────────────────────────────────────────
  deleteStaff: async (id) => {
    const prev = get().staff
    set((s) => ({ staff: s.staff.filter((st) => st.id !== id) }))
    try {
      const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', id)
      if (error) throw error
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      set({ staff: prev, error: msg })
      throw err
    }
  },

  // ── Fetch Vehicles ───────────────────────────────────────────────────────
  fetchVehicles: async () => {
    set((s) => ({ loading: { ...s.loading, vehicles: true } }))
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select(VEHICLE_COLS)
        .order('tipe')
        .order('name')
      if (error) throw error
      set({
        vehicles: (data as DBVehicle[]).map(toAppVehicle),
        vehiclesDB: data as DBVehicle[],
        loading: { ...get().loading, vehicles: false },
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      set((s) => ({ error: msg, loading: { ...s.loading, vehicles: false } }))
    }
  },

  // ── Add Vehicle ───────────────────────────────────────────────────────────
  addVehicle: async (vehicle) => {
    const tempId = `temp-${Date.now()}`
    const optimisticVehicle: Vehicle = {
      id: tempId,
      name: vehicle.name,
      price: vehicle.price_expres,
    }
    const optimisticDBVehicle: DBVehicle = {
      ...vehicle,
      id: tempId,
      created_at: new Date().toISOString(),
    }
    set((s) => ({
      vehicles: [...s.vehicles, optimisticVehicle],
      vehiclesDB: [...s.vehiclesDB, optimisticDBVehicle],
    }))
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .insert({
          name: vehicle.name,
          tipe: vehicle.tipe,
          price_expres: vehicle.price_expres,
          price_hidrolik: vehicle.price_hidrolik,
        })
        .select()
        .single()
      if (error) throw error
      const real = data as DBVehicle
      set((s) => ({
        vehicles: s.vehicles.map((v) => (v.id === tempId ? toAppVehicle(real) : v)),
        vehiclesDB: s.vehiclesDB.map((v) => (v.id === tempId ? real : v)),
      }))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      set((s) => ({
        vehicles: s.vehicles.filter((v) => v.id !== tempId),
        vehiclesDB: s.vehiclesDB.filter((v) => v.id !== tempId),
        error: msg,
      }))
      throw err
    }
  },

  // ── Delete Vehicle ────────────────────────────────────────────────────────
  deleteVehicle: async (id) => {
    const prevVehicles = get().vehicles
    const prevVehiclesDB = get().vehiclesDB
    set((s) => ({
      vehicles: s.vehicles.filter((v) => v.id !== id),
      vehiclesDB: s.vehiclesDB.filter((v) => v.id !== id),
    }))
    try {
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', id)
      if (error) throw error
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      set({
        vehicles: prevVehicles,
        vehiclesDB: prevVehiclesDB,
        error: msg,
      })
      throw err
    }
  },

  // ════════════════════════════════════════════════════════════════════════════
  // ── EXPENSES ──────────────────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════════

  // ── Fetch Expenses ──────────────────────────────────────────────────────
  fetchExpenses: async () => {
    set((s) => ({ loading: { ...s.loading, expenses: true }, error: null }))
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select(EXPENSE_COLS)
        .order('created_at', { ascending: false })
      if (error) throw error
      set({
        expenses: data as Expense[],
        loading: { ...get().loading, expenses: false },
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      set((s) => ({ error: msg, loading: { ...s.loading, expenses: false } }))
    }
  },

  // ── Add Expense ──────────────────────────────────────────────────────────
  addExpense: async (data) => {
    const tempId = `temp-${Date.now()}`
    const nowIso = new Date().toISOString()
    const optimistic: Expense = {
      ...data,
      id: tempId,
      created_at: nowIso,
    }
    set((s) => ({ expenses: [optimistic, ...s.expenses] }))

    try {
      const { data: inserted, error } = await supabase
        .from('expenses')
        .insert({
          nama_pengeluaran: data.nama_pengeluaran,
          kategori: data.kategori,
          nominal: data.nominal,
          keterangan: data.keterangan,
        })
        .select()
        .single()
      if (error) throw error

      set((s) => ({
        expenses: s.expenses.map((e) => (e.id === tempId ? inserted : e)),
      }))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      set((s) => ({
        expenses: s.expenses.filter((e) => e.id !== tempId),
        error: msg,
      }))
      throw err
    }
  },

  // ── UPDATE EXPENSE ──────────────────────────────────────────────────────
  updateExpense: async (id, data) => {
    const prev = get().expenses
    set((s) => ({
      expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...data } : e)),
    }))
    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          nama_pengeluaran: data.nama_pengeluaran,
          kategori: data.kategori,
          nominal: data.nominal,
          keterangan: data.keterangan,
        })
        .eq('id', id)
      if (error) throw error
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      set({ expenses: prev, error: msg })
      throw err
    }
  },

  // ── Delete Expense ──────────────────────────────────────────────────────
  deleteExpense: async (id) => {
    const prev = get().expenses
    set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }))
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)
      if (error) throw error
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      set({ expenses: prev, error: msg })
      throw err
    }
  },

  // ── Init Store ────────────────────────────────────────────────────────────
  initStore: async () => {
    const saved = localStorage.getItem('otowash_user')
    if (saved) {
      try {
        const user = JSON.parse(saved)
        set({ user })
      } catch {
        // ignore
      }
    }

    if (get().initialized) return
    try {
      await Promise.all([
        get().fetchTransactions(),
        get().fetchStaff(),
        get().fetchVehicles(),
        get().fetchExpenses(),
      ])
      set({ initialized: true })
    } catch (err) {
      console.error('Init store error:', err)
      // tetap tandai initialized agar UI tidak ngestuck; error sudah di set di masing2 fetch
      set({ initialized: true })
    }
  },

  // ── Realtime Subscription (legacy) — kept for backward compat ────────────
  // Aplikasi kini memakai lib/realtime.tsx (debounced invalidate) sebagai sumber
  // utama. Channel ini tetap ada untuk halaman yang masih mengandalkan Store langsung.
  subscribeRealtime: () => {
    const channel = supabase
      .channel('otowash-realtime')
      // ── Transactions ──
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transactions' },
        (payload) => {
          const newTx = toAppTransaction(payload.new as DBTransaction)
          set((s) => {
            const exists = s.transactions.some((t) => t.id === newTx.id)
            if (exists) return s
            // cap agar tidak tumbuh tanpa batas
            const dedupTemp = s.transactions.filter((t) => !t.id.startsWith('temp-') || t.plat !== newTx.plat)
            return { transactions: [newTx, ...dedupTemp].slice(0, 100) }
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'transactions' },
        (payload) => {
          const updated = toAppTransaction(payload.new as DBTransaction)
          set((s) => ({
            transactions: s.transactions.map((t) => (t.id === updated.id ? updated : t)),
          }))
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'transactions' },
        (payload) => {
          set((s) => ({
            transactions: s.transactions.filter((t) => t.id !== payload.old.id),
          }))
        }
      )
      // ── Expenses ──
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'expenses' },
        (payload) => {
          const newExp = payload.new as Expense
          set((s) => {
            const exists = s.expenses.some((e) => e.id === newExp.id)
            if (exists) return s
            // dedupe optimistic tempId vs realtime
            const withoutTemp = s.expenses.filter((e) => !e.id.startsWith('temp-') || e.nama_pengeluaran !== newExp.nama_pengeluaran)
            return { expenses: [newExp, ...withoutTemp] }
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'expenses' },
        (payload) => {
          const updated = payload.new as Expense
          set((s) => ({
            expenses: s.expenses.map((e) => (e.id === updated.id ? updated : e)),
          }))
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'expenses' },
        (payload) => {
          set((s) => ({
            expenses: s.expenses.filter((e) => e.id !== payload.old.id),
          }))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  },
}))

// ─── Selector Hooks ──────────────────────────────────────────────────────────

export const useTransactions = () => useAppStore((s) => s.transactions)
export const useStaff = () => useAppStore((s) => s.staff)
export const useVehicles = () => useAppStore((s) => s.vehicles)
export const useVehiclesDB = () => useAppStore((s) => s.vehiclesDB)
export const useExpenses = () => useAppStore((s) => s.expenses)
export const useLoading = () => useAppStore((s) => s.loading)
export const useError = () => useAppStore((s) => s.error)
export const useUser = () => useAppStore((s) => s.user)

export const useIsAdmin = () => {
  const user = useAppStore((s) => s.user)
  return user?.role === 'admin'
}

export const useIsGuest = () => {
  const user = useAppStore((s) => s.user)
  return user?.role === 'guest'
}

export const useStaffOptions = (): string[] => {
  const staff = useAppStore((s) => s.staff)
  return useMemo(() => staff.map((st) => st.nama), [staff])
}

export const useModelOptions = (tipe: 'mobil' | 'motor'): string[] => {
  const vehicles = useAppStore((s) => s.vehiclesDB)
  return useMemo(
    () => vehicles.filter((v) => v.tipe === tipe).map((v) => v.name),
    [vehicles, tipe]
  )
}

export const useVehiclePrice = (
  modelName: string,
  layanan: 'expres' | 'hidrolik'
): number => {
  return useAppStore((s) => {
    const v = s.vehiclesDB.find((v) => v.name === modelName)
    if (!v) return 0
    return layanan === 'expres' ? v.price_expres : v.price_hidrolik
  })
}
