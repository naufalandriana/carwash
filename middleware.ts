import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('otowash_session')
  const { pathname } = request.nextUrl
  const isLoginPage = pathname === '/login'

  // Belum login, mau akses selain /login → tendang ke /login
  if (!sessionCookie && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Udah login, tapi masih coba akses /login → tendang ke /
  if (sessionCookie && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/auth).*)',
  ],
}