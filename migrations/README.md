# Database Migrations

## Hướng dẫn chạy migration

### Bước 1: Mở Supabase SQL Editor

1. Truy cập Supabase Dashboard: [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Chọn project của bạn
3. Vào **SQL Editor** (biểu tượng </> ở sidebar)

### Bước 2: Chạy Migration 01-add-school-year.sql

1. Mở file `migrations/01-add-school-year.sql`
2. Copy toàn bộ nội dung file
3. Paste vào SQL Editor của Supabase
4. Nhấn **Run** hoặc Ctrl+Enter

### Bước 3: Kiểm tra kết quả

Chạy query sau để xác nhận migration thành công:

```sql
-- Kiểm tra cột school_year đã được thêm
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'classes'
AND column_name = 'school_year';

-- Xem phân bố lớp theo năm học
SELECT school_year, COUNT(*) as class_count
FROM classes
GROUP BY school_year
ORDER BY school_year DESC;
```

Kết quả mong đợi:
- Cột `school_year` đã tồn tại
- Tất cả lớp hiện tại có `school_year = '2025-2026'`

---

## Danh sách Migrations

| File | Mô tả | Trạng thái |
|------|-------|------------|
| 01-add-school-year.sql | Thêm cột school_year vào bảng classes | ⏳ Chờ chạy |

---

## Lưu ý quan trọng

⚠️ **BACKUP DỮ LIỆU TRƯỚC KHI CHẠY MIGRATION**

Supabase tự động backup, nhưng để an toàn:
1. Vào **Database** → **Backups**
2. Nhấn **Create backup** để tạo backup thủ công

⚠️ **Không được sửa migration đã chạy**

Nếu cần thay đổi, tạo migration mới để rollback hoặc adjust.
