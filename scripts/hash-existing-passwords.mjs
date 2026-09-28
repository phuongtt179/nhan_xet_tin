// Chạy MỘT LẦN DUY NHẤT sau khi deploy code mới, TRƯỚC KHI chạy migration
// 05-lock-down-users-table.sql, để băm lại các mật khẩu đang lưu dạng chữ
// thô trong cột users.password_hash.
//
// Yêu cầu biến môi trường (đọc trong .env.local hoặc export tay khi chạy):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   (Settings → API → service_role, KHÔNG phải anon key)
//
// Cách chạy:
//   node -r dotenv/config scripts/hash-existing-passwords.mjs dotenv_config_path=.env.local
// hoặc set biến môi trường trực tiếp rồi: node scripts/hash-existing-passwords.mjs

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';

// Tự đọc .env.local nếu có, để không bắt buộc cài thêm gói dotenv.
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
  console.error(
    'Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY. ' +
      'Thêm SUPABASE_SERVICE_ROLE_KEY vào .env.local (lấy trong Supabase Dashboard → Settings → API → service_role) rồi chạy lại.'
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function looksLikeBcryptHash(value) {
  return typeof value === 'string' && /^\$2[aby]?\$\d{2}\$/.test(value);
}

async function main() {
  const { data: users, error } = await supabase.from('users').select('id, email, password_hash');
  if (error) {
    console.error('Lỗi khi đọc bảng users:', error.message);
    process.exit(1);
  }

  const toMigrate = (users || []).filter((u) => !looksLikeBcryptHash(u.password_hash));

  if (toMigrate.length === 0) {
    console.log('Tất cả mật khẩu đã ở dạng bcrypt hash. Không cần làm gì thêm.');
    return;
  }

  console.log(`Tìm thấy ${toMigrate.length} tài khoản còn lưu mật khẩu dạng chữ thô. Đang băm lại...`);

  for (const u of toMigrate) {
    const newHash = await bcrypt.hash(u.password_hash, 10);
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: newHash })
      .eq('id', u.id);

    if (updateError) {
      console.error(`  ✗ ${u.email}: ${updateError.message}`);
    } else {
      console.log(`  ✓ ${u.email}: đã băm lại mật khẩu`);
    }
  }

  console.log('\nHoàn tất. Khuyến nghị: yêu cầu tất cả giáo viên đổi mật khẩu mới,');
  console.log('vì mật khẩu cũ từng được lưu/truyền dưới dạng chữ thô.');
}

main();
