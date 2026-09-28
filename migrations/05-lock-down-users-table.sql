-- Migration: Khoá truy cập trực tiếp vào bảng `users` qua anon key.
--
-- Trước đây bảng users có policy "Allow all operations" (hoặc tương đương),
-- nghĩa là bất kỳ ai có anon key (nằm sẵn trong JS gửi về trình duyệt) đều
-- có thể đọc/ghi thẳng bảng users — kể cả cột password_hash — mà không cần
-- đăng nhập qua giao diện.
--
-- Sau migration này, các API route phía server (/api/auth/*, /api/admin/users)
-- dùng SUPABASE_SERVICE_ROLE_KEY (bỏ qua RLS) để đọc/ghi bảng users;
-- anon key và authenticated key sẽ KHÔNG còn quyền gì trên bảng này.
--
-- ⚠️ CHỈ chạy migration này SAU KHI:
--   1) Đã sao lưu (backup) xong database Supabase.
--   2) Đã chạy scripts/hash-existing-passwords.mjs để băm lại toàn bộ mật khẩu cũ.
--   3) Đã deploy code mới (AuthContext, /api/auth/*, /api/admin/users) — nếu chạy
--      migration này trước khi deploy code mới, trang đăng nhập cũ sẽ ngừng hoạt động.

-- Xoá toàn bộ policy hiện có trên bảng users (không biết trước tên chính xác
-- vì bảng này được tạo tay trên Supabase Dashboard, không có trong migration cũ).
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', pol.policyname);
  END LOOP;
END $$;

-- Đảm bảo RLS được bật. Không tạo lại policy nào cho anon/authenticated —
-- bảng users chỉ còn truy cập được qua service_role (dùng trong API server).
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Kiểm tra sau khi chạy: câu query dưới đây (chạy bằng anon key) phải trả về
-- mảng rỗng thay vì danh sách người dùng.
--   select * from users;
