import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/serverAuth';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin(req);
  if (!session) {
    return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
  }

  const body = await req.json();
  const { email, password, full_name, phone, role, is_active } = body ?? {};

  const updateData: Record<string, unknown> = {};
  if (email !== undefined) updateData.email = String(email).trim().toLowerCase();
  if (full_name !== undefined) updateData.full_name = full_name;
  if (phone !== undefined) updateData.phone = phone || null;
  if (role !== undefined) {
    if (role !== 'admin' && role !== 'teacher') {
      return NextResponse.json({ error: 'Vai trò không hợp lệ' }, { status: 400 });
    }
    updateData.role = role;
  }
  if (is_active !== undefined) updateData.is_active = is_active;
  if (password) updateData.password_hash = await bcrypt.hash(password, 10);

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from('users').update(updateData).eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin(req);
  if (!session) {
    return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from('users').delete().eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
