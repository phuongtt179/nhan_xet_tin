// Đặt lại mật khẩu đăng nhập app cho 1 hoặc nhiều tài khoản, dùng khi quên mật khẩu
// và chưa có ai đăng nhập được để tự đổi qua giao diện /admin/users.
//
// Cách chạy: node scripts/reset-password.mjs email1:matkhau1 email2:matkhau2

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env.local');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const pairs = process.argv.slice(2).map((arg) => {
  const idx = arg.indexOf(':');
  return { email: arg.slice(0, idx).trim().toLowerCase(), password: arg.slice(idx + 1) };
});

if (pairs.length === 0) {
  console.error('Dùng: node scripts/reset-password.mjs email1:matkhau1 email2:matkhau2');
  process.exit(1);
}

async function main() {
  for (const { email, password } of pairs) {
    const password_hash = await bcrypt.hash(password, 10);
    const { error, data } = await supabase
      .from('users')
      .update({ password_hash })
      .eq('email', email)
      .select('email');

    if (error) {
      console.error(`  ✗ ${email}: ${error.message}`);
    } else if (!data || data.length === 0) {
      console.error(`  ✗ ${email}: không tìm thấy tài khoản`);
    } else {
      console.log(`  ✓ ${email}: đã đặt mật khẩu mới`);
    }
  }
}

main();
