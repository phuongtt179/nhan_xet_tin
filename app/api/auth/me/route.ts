import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/serverAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ user: null, assignments: [] });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, email, full_name, phone, role, is_active')
    .eq('id', session.uid)
    .eq('is_active', true)
    .maybeSingle();

  if (!user) {
    return NextResponse.json({ user: null, assignments: [] });
  }

  const { data: assignments } = await supabaseAdmin
    .from('teacher_assignments')
    .select('*, classes (*), subjects (*)')
    .eq('user_id', user.id);

  return NextResponse.json({ user, assignments: assignments || [] });
}
