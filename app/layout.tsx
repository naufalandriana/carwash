'use client'

import './globals.css'
import { useState, useCallback, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import BottomNav from '@/components/layout/ButtomNav'
import { StoreProvider } from '@/lib/StoreProvider'
import { AlertProvider } from '@/components/ui/Alert'
import { AppShellSkeleton } from '@/components/ui/Skeleton'
import { ThemeProvider } from '@/lib/theme'
import { QueryProvider } from '@/lib/QueryProvider'
import { RealtimeProvider } from '@/lib/realtime'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [desktopCollapsed, setDesktopCollapsed] = useState(false)
  const pathname = usePathname()
  const isLoginPage = pathname === '/login'
  const isHydrating = pathname == null

  // Persist collapsed state without hydration mismatch
  useEffect(() => {
    try {
      const v = localStorage.getItem('desktopSidebarCollapsed')
      if (v !== null) setDesktopCollapsed(v === '1')
    } catch {}
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem('desktopSidebarCollapsed', desktopCollapsed ? '1' : '0')
    } catch {}
  }, [desktopCollapsed])

  const handleMenuClick = useCallback(() => {
    setDrawerOpen(true)
  }, [])

  const handleToggleCollapse = useCallback(() => {
    setDesktopCollapsed((v) => !v)
  }, [])

  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* no-flash: apply theme before paint, default light, ignore system */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t==='dark'){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}else{document.documentElement.classList.remove('dark');document.documentElement.style.colorScheme='light';}}catch(e){}`,
          }}
        />
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <meta name="theme-color" content="#004ac6" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-title" content="Cahaya Wash" />
        <title>Cahaya Steam Car & Bike Wash</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-on-surface min-h-screen min-h-[100dvh] antialiased overflow-x-hidden">
        <ThemeProvider>
          <QueryProvider>
            <StoreProvider>
              <RealtimeProvider>
                <AlertProvider>
                {isLoginPage ? (
                  <main className="min-h-screen min-h-[100dvh] bg-background">{children}</main>
                ) : (
                  <div className="min-h-screen min-h-[100dvh] bg-background overflow-x-hidden">
                    <Header onMenuClick={handleMenuClick} />
                    <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} collapsed={desktopCollapsed} onToggleCollapse={handleToggleCollapse} />

                    {/* Content offset for fixed header+sidebar. Mobile: header 56px, no sidebar offset. Desktop: header 64px + sidebar 256/72. */}
                    <div className={`pt-14 lg:pt-16 transition-[padding] duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${desktopCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[256px]'}`}>
                      <main className="min-w-0 w-full min-h-[calc(100dvh-3.5rem)] lg:min-h-[calc(100dvh-4rem)] overflow-x-hidden">
                        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-6 xl:px-8 2xl:px-10 py-3 sm:py-4 lg:py-6 pb-24 lg:pb-8">
                          {isHydrating ? <AppShellSkeleton /> : <div className="page-fade">{children}</div>}
                        </div>
                      </main>
                    </div>

                    <div className="lg:hidden">
                      <BottomNav />
                    </div>
                  </div>
                )}
                </AlertProvider>
              </RealtimeProvider>
            </StoreProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
