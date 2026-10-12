'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, type DBStaff, type DBVehicle } from '@/lib/Supabase'
import { qk } from './keys'
import { toAppStaff, toAppVehicle } from './helpers'
import type { Expense } from '@/lib/Data'

export function useStaffQuery() {
  return useQuery({
    queryKey: qk.staff(),
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('staff').select('id,nama,jabatan,initials,color,status,created_at').eq('status', 'Aktif').order('nama')
      if (error) throw error
      return (data as DBStaff[]).map(toAppStaff)
    },
  })
}

export function useVehiclesQuery() {
  return useQuery({
    queryKey: qk.vehicles(),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('vehicles').select('id,name,tipe,price_expres,price_hidrolik,created_at').order('tipe').order('name')
      if (error) throw error
      const db = data as DBVehicle[]
      return { list: db.map(toAppVehicle), db }
    },
  })
}

export function useExpensesQuery() {
  return useQuery({
    queryKey: qk.expenses(),
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('expenses').select('id,nama_pengeluaran,kategori,nominal,keterangan,created_at').order('created_at', { ascending: false })
      if (error) throw error
      return data as Expense[]
    },
  })
}

export function useAddStaffMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<DBStaff, 'id' | 'created_at'>) => {
      const { data, error } = await supabase.from('staff').insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.staff() }),
  })
}

export function useAddVehicleMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<DBVehicle, 'id' | 'created_at'>) => {
      const { data, error } = await supabase.from('vehicles').insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.vehicles() }),
  })
}
