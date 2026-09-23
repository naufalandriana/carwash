// app/api/auth/change-password/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { userId, currentPassword, newPassword } = await request.json()

    if (!userId || !currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Semua field harus diisi' },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password baru minimal 6 karakter' },
        { status: 400 }
      )
    }

    // Ambil data admin berdasarkan userId
    const { data: admin, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error || !admin) {
      return NextResponse.json(
        { error: 'User tidak ditemukan' },
        { status: 404 }
      )
    }

    // Pastikan hanya admin yang bisa diubah (username = 'admin')
    if (admin.username !== 'admin') {
      return NextResponse.json(
        { error: 'Akses ditolak' },
        { status: 403 }
      )
    }

    // Verifikasi password saat ini
    const passwordMatch = await bcrypt.compare(currentPassword, admin.password_hash)
    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Password saat ini salah' },
        { status: 401 }
      )
    }

    // Hash password baru
    const saltRounds = 10
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds)

    // Update di database
    const { error: updateError } = await supabase
      .from('admin_users')
      .update({ password_hash: hashedPassword })
      .eq('id', userId)

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json(
        { error: 'Gagal mengubah password' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, message: 'Password berhasil diubah' },
      { status: 200 }
    )
  } catch (err) {
    console.error('Change password error:', err)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengubah password' },
      { status: 500 }
    )
  }
}