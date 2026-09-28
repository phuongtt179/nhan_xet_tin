import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Client dùng SERVICE ROLE KEY — chỉ được import từ code chạy trên server
// (API routes / route handlers). Key này bỏ qua Row Level Security nên
// TUYỆT ĐỐI không được đưa vào bundle client (không thêm tiền tố NEXT_PUBLIC_).
let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Thiếu SUPABASE_SERVICE_ROLE_KEY (server-only). Lấy trong Supabase Dashboard → Settings → API → service_role, ' +
        'rồi thêm vào .env.local (không thêm tiền tố NEXT_PUBLIC_).'
    );
  }

  cached = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
