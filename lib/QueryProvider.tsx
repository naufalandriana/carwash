'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { persistQueryClient } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { useState, useEffect } from 'react'

export const QUERY_PERSIST_KEY = 'otowash-query-cache'
export const QUERY_CACHE_BUSTER = 'otowash-v1'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 45 * 1000,
        gcTime: 24 * 60 * 60 * 1000,
        refetchOnWindowFocus: true,
        retry: 1,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
  })
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => createQueryClient())

  useEffect(() => {
    try {
      const persister = createSyncStoragePersister({
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        key: QUERY_PERSIST_KEY,
      })
      // persistQueryClient is fire-and-forget; try/catch covers quota errors
      persistQueryClient({
        queryClient: client,
        persister,
        maxAge: 24 * 60 * 60 * 1000,
        buster: QUERY_CACHE_BUSTER,
      })
    } catch {}
  }, [client])

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
