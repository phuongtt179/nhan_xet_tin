import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { createSessionToken, SESSION_COOKIE_NAME } from '@/lib/session';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Yêu cầu không hợp lệ' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password;

  if (!email || !password) {
    return NextResponse.json({ error: 'Thiếu email hoặc mật khẩu' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('email', email)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !user) {
    return NextResponse.json({ error: 'Email hoặc mật khẩu không đúng' }, { status: 401 });
  }

  let passwordOk = false;
  try {
    passwordOk = await bcrypt.compare(password, user.password_hash);
  } catch {
    passwordOk = false;
  }

  if (!passwordOk) {
    return NextResponse.json({ error: 'Email hoặc mật khẩu không đúng' }, { status: 401 });
  }

  const token = await createSessionToken({ uid: user.id, role: user.role });

  const res = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      role: user.role,
      is_active: user.is_active,
    },
  });

  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12,
  });

  return res;
}
