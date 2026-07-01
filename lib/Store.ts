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
  updateExpense: (id: string, data: Partial<Omit<Expense, 'id' | 'created_at'>>) => Promise<void>  // ⬅️ TAMBAH
  deleteExpense: (id: string) => Promise<void>

  initStore: () => Promise<void>
  subscribeRealtime: () => () => void
  clearError: () => void
}

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
        body: JSON.stringify({ password })
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
        username: data.user.username
      })
    } catch (err: any) {
      set({ error: err.message })
      throw err
    }
  },

  clearError: () => set({ error: null }),

  // ── Fetch Transactions ───────────────────────────────────────────────────
  fetchTransactions: async () => {
    set(s => ({ loading: { ...s.loading, transactions: true }, error: null }))
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      set({
        transactions: (data as DBTransaction[]).map(toAppTransaction),
        loading: { ...get().loading, transactions: false },
      })
    } catch (err: any) {
      set(s => ({ error: err.message, loading: { ...s.loading, transactions: false } }))
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
    set(s => ({ transactions: [optimistic, ...s.transactions] }))

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

      set(s => ({
        transactions: s.transactions.map(t =>
          t.id === tempId ? toAppTransaction(data as DBTransaction) : t
        ),
      }))
    } catch (err: any) {
      set(s => ({
        transactions: s.transactions.filter(t => t.id !== tempId),
        error: err.message,
      }))
      throw err
    }
  },

  // ── Update Transaction Status ────────────────────────────────────────────
  updateTransactionStatus: async (id, status) => {
    const prev = get().transactions
    set(s => ({
      transactions: s.transactions.map(t => (t.id === id ? { ...t, status } : t)),
    }))
    try {
      const dbStatus = mapAppStatusToDB(status)
      const { error } = await supabase
        .from('transactions')
        .update({ status: dbStatus })
        .eq('id', id)
      if (error) throw error
    } catch (err: any) {
      set({ transactions: prev, error: err.message })
    }
  },

  // ── UPDATE TRANSACTION (FULL EDIT) ──────────────────────────────────────
  updateTransaction: async (id, updates) => {
    const prev = get().transactions
    set(s => ({
      transactions: s.transactions.map(t =>
        t.id === id ? { ...t, ...updates } : t
      ),
    }))
    try {
      const dbUpdates: any = { ...updates }
      if (updates.status) {
        dbUpdates.status = mapAppStatusToDB(updates.status)
      }
      const { error } = await supabase
        .from('transactions')
        .update(dbUpdates)
        .eq('id', id)
      if (error) throw error
    } catch (err: any) {
      set({ transactions: prev, error: err.message })
      throw err
    }
  },

  // ── Delete Transaction ──────────────────────────────────────────────────
  deleteTransaction: async (id) => {
    const prev = get().transactions
    set(s => ({ transactions: s.transactions.filter(t => t.id !== id) }))
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
      if (error) throw error
    } catch (err: any) {
      set({ transactions: prev, error: err.message })
    }
  },

  // ── Fetch Staff ──────────────────────────────────────────────────────────
  fetchStaff: async () => {
    set(s => ({ loading: { ...s.loading, staff: true } }))
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('status', 'Aktif')
        .order('nama')
      if (error) throw error
      set({
        staff: (data as DBStaff[]).map(toAppStaff),
        loading: { ...get().loading, staff: false },
      })
    } catch (err: any) {
      set(s => ({ error: err.message, loading: { ...s.loading, staff: false } }))
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
    } catch (err: any) {
      set({ error: err.message })
    }
  },

  // ── Update Staff (edit nama, dll) ────────────────────────────────────────
  updateStaff: async (id, updates) => {
    const prev = get().staff
    set(s => ({
      staff: s.staff.map(st => (st.id === id ? { ...st, ...updates } : st)),
    }))
    try {
      const { error } = await supabase
        .from('staff')
        .update(updates)
        .eq('id', id)
      if (error) throw error
    } catch (err: any) {
      set({ staff: prev, error: err.message })
      throw err
    }
  },

  // ── Delete Staff ──────────────────────────────────────────────────────────
  deleteStaff: async (id) => {
    const prev = get().staff
    set(s => ({ staff: s.staff.filter(st => st.id !== id) }))
    try {
      const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', id)
      if (error) throw error
    } catch (err: any) {
      set({ staff: prev, error: err.message })
      throw err
    }
  },

  // ── Fetch Vehicles ───────────────────────────────────────────────────────
  fetchVehicles: async () => {
    set(s => ({ loading: { ...s.loading, vehicles: true } }))
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('tipe')
        .order('name')
      if (error) throw error
      set({
        vehicles: (data as DBVehicle[]).map(toAppVehicle),
        vehiclesDB: data as DBVehicle[],
        loading: { ...get().loading, vehicles: false },
      })
    } catch (err: any) {
      set(s => ({ error: err.message, loading: { ...s.loading, vehicles: false } }))
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
    set(s => ({
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
      set(s => ({
        vehicles: s.vehicles.map(v => (v.id === tempId ? toAppVehicle(real) : v)),
        vehiclesDB: s.vehiclesDB.map(v => (v.id === tempId ? real : v)),
      }))
    } catch (err: any) {
      set(s => ({
        vehicles: s.vehicles.filter(v => v.id !== tempId),
        vehiclesDB: s.vehiclesDB.filter(v => v.id !== tempId),
        error: err.message,
      }))
    }
  },

  // ── Delete Vehicle ────────────────────────────────────────────────────────
  deleteVehicle: async (id) => {
    const prevVehicles = get().vehicles
    const prevVehiclesDB = get().vehiclesDB
    set(s => ({
      vehicles: s.vehicles.filter(v => v.id !== id),
      vehiclesDB: s.vehiclesDB.filter(v => v.id !== id),
    }))
    try {
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', id)
      if (error) throw error
    } catch (err: any) {
      set({
        vehicles: prevVehicles,
        vehiclesDB: prevVehiclesDB,
        error: err.message,
      })
    }
  },

  // ════════════════════════════════════════════════════════════════════════════
  // ── EXPENSES ──────────────────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════════

  // ── Fetch Expenses ──────────────────────────────────────────────────────
  fetchExpenses: async () => {
    set(s => ({ loading: { ...s.loading, expenses: true }, error: null }))
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      set({
        expenses: data as Expense[],
        loading: { ...get().loading, expenses: false },
      })
    } catch (err: any) {
      set(s => ({ error: err.message, loading: { ...s.loading, expenses: false } }))
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
    set(s => ({ expenses: [optimistic, ...s.expenses] }))

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

      set(s => ({
        expenses: s.expenses.map(e => (e.id === tempId ? inserted : e)),
      }))
    } catch (err: any) {
      set(s => ({
        expenses: s.expenses.filter(e => e.id !== tempId),
        error: err.message,
      }))
      throw err
    }
  },

  // ── UPDATE EXPENSE ────────────────────────────────────────────────────── ⬅️ TAMBAH
  updateExpense: async (id, data) => {
    const prev = get().expenses
    set(s => ({
      expenses: s.expenses.map(e => (e.id === id ? { ...e, ...data } : e)),
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
    } catch (err: any) {
      set({ expenses: prev, error: err.message })
      throw err
    }
  },

  // ── Delete Expense ──────────────────────────────────────────────────────
  deleteExpense: async (id) => {
    const prev = get().expenses
    set(s => ({ expenses: s.expenses.filter(e => e.id !== id) }))
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)
      if (error) throw error
    } catch (err: any) {
      set({ expenses: prev, error: err.message })
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
    }
  },

  // ── Realtime Subscription ─────────────────────────────────────────────────
  subscribeRealtime: () => {
    const channel = supabase
      .channel('otowash-realtime')
      // ── Transactions ──
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transactions' },
        (payload) => {
          const newTx = toAppTransaction(payload.new as DBTransaction)
          set(s => {
            const exists = s.transactions.some(t => t.id === newTx.id)
            if (exists) return s
            return { transactions: [newTx, ...s.transactions] }
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'transactions' },
        (payload) => {
          const updated = toAppTransaction(payload.new as DBTransaction)
          set(s => ({
            transactions: s.transactions.map(t => (t.id === updated.id ? updated : t)),
          }))
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'transactions' },
        (payload) => {
          set(s => ({
            transactions: s.transactions.filter(t => t.id !== payload.old.id),
          }))
        }
      )
      // ── Expenses ──
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'expenses' },
        (payload) => {
          const newExp = payload.new as Expense
          set(s => {
            const exists = s.expenses.some(e => e.id === newExp.id)
            if (exists) return s
            return { expenses: [newExp, ...s.expenses] }
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'expenses' },
        (payload) => {
          const updated = payload.new as Expense
          set(s => ({
            expenses: s.expenses.map(e => (e.id === updated.id ? updated : e)),
          }))
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'expenses' },
        (payload) => {
          set(s => ({
            expenses: s.expenses.filter(e => e.id !== payload.old.id),
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

export const useTransactions = () => useAppStore(s => s.transactions)
export const useStaff = () => useAppStore(s => s.staff)
export const useVehicles = () => useAppStore(s => s.vehicles)
export const useVehiclesDB = () => useAppStore(s => s.vehiclesDB)
export const useExpenses = () => useAppStore(s => s.expenses)
export const useLoading = () => useAppStore(s => s.loading)
export const useError = () => useAppStore(s => s.error)
export const useUser = () => useAppStore(s => s.user)

export const useIsAdmin = () => {
  const user = useAppStore(s => s.user)
  return user?.role === 'admin'
}

export const useIsGuest = () => {
  const user = useAppStore(s => s.user)
  return user?.role === 'guest'
}

export const useStaffOptions = (): string[] => {
  const staff = useAppStore(s => s.staff)
  return useMemo(() => staff.map(st => st.nama), [staff])
}

export const useModelOptions = (tipe: 'mobil' | 'motor'): string[] => {
  const vehicles = useAppStore(s => s.vehiclesDB)
  return useMemo(
    () => vehicles.filter(v => v.tipe === tipe).map(v => v.name),
    [vehicles, tipe]
  )
}

export const useVehiclePrice = (
  modelName: string,
  layanan: 'expres' | 'hidrolik'
): number => {
  return useAppStore(s => {
    const v = s.vehiclesDB.find(v => v.name === modelName)
    if (!v) return 0
    return layanan === 'expres' ? v.price_expres : v.price_hidrolik
  })
}