import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()

    if (!password) {
      return NextResponse.json(
        { error: 'Password harus diisi' },
        { status: 400 }
      )
    }

    // Ambil admin user dari database (username hardcode = 'admin')
    const { data: admin, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('username', 'admin')
      .single()

    if (error || !admin) {
      return NextResponse.json(
        { error: 'Password salah' },
        { status: 401 }
      )
    }

    // Compare password dengan bcrypt hash
    const passwordMatch = await bcrypt.compare(password, admin.password_hash)

    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Password salah' },
        { status: 401 }
      )
    }

    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: admin.id,
          username: admin.username,
          role: 'admin',
          name: 'Administrator'
        }
      },
      { status: 200 }
    )

    // Set session cookie buat middleware
    response.cookies.set('otowash_session', JSON.stringify({
      role: 'admin',
      name: 'Administrator'
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 hari
      path: '/',
    })

    return response
  } catch (err) {
    console.error('Auth error:', err)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat login' },
      { status: 500 }
    )
  }
}