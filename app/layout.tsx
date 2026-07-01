'use client'

import './globals.css'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Headbar from '@/components/layout/Headbar'
import Sidebar from '@/components/layout/Sidebar'
import BottomNav from '@/components/layout/ButtomNav'
import { StoreProvider } from '@/lib/StoreProvider'
import { AlertProvider } from '@/components/ui/Alert'   // ⬅️ TAMBAH

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const pathname = usePathname()
  const isLoginPage = pathname === '/login'

  return (
    <html lang="id">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="#004ac6" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-title" content="Cahaya Wash" />
        <title>Cahaya Steam Car & Bike Wash</title>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-on-surface min-h-screen">
        <StoreProvider>
          <AlertProvider>  {/* ⬅️ BUNGKUS DENGAN ALERT PROVIDER */}
            {isLoginPage ? (
              <main className="min-h-screen">{children}</main>
            ) : (
              <div className="flex flex-col min-h-screen">
                <Headbar onMenuClick={() => setDrawerOpen(true)} />
                <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />
                <main className="flex-1 p-4 pb-20 lg:pb-4">
                  {children}
                </main>
                <div className="lg:hidden">
                  <BottomNav />
                </div>
              </div>
            )}
          </AlertProvider>
        </StoreProvider>
      </body>
    </html>
  )
}