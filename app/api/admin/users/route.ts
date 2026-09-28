import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/serverAuth';

export const runtime = 'nodejs';

// Danh sách giáo viên/admin — KHÔNG bao giờ trả password_hash về client.
export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) {
    return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, email, full_name, phone, role, is_active, created_at')
    .order('full_name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) {
    return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
  }

  const body = await req.json();
  const { email, password, full_name, phone, role } = body ?? {};

  if (!email || !password || !full_name || !role) {
    return NextResponse.json({ error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
  }
  if (role !== 'admin' && role !== 'teacher') {
    return NextResponse.json({ error: 'Vai trò không hợp lệ' }, { status: 400 });
  }

  const password_hash = await bcrypt.hash(password, 10);

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from('users').insert({
    email: String(email).trim().toLowerCase(),
    password_hash,
    full_name,
    phone: phone || null,
    role,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
