# Migration: Evaluation Levels

## Mục đích
Tạo bảng `evaluation_levels` để quản lý động các mức đánh giá học sinh thay vì hard-code trong code.

## Cách chạy Migration

### Bước 1: Mở Supabase SQL Editor
1. Truy cập https://supabase.com
2. Chọn project của bạn
3. Vào **SQL Editor** (biểu tượng database bên trái)

### Bước 2: Chạy Migration
1. Copy toàn bộ nội dung file `02-add-evaluation-levels.sql`
2. Paste vào SQL Editor
3. Click **Run** hoặc nhấn `Ctrl + Enter`

### Bước 3: Kiểm tra
Chạy câu lệnh này để xác nhận:
```sql
SELECT * FROM evaluation_levels ORDER BY display_order;
```

Bạn sẽ thấy 4 mức đánh giá mặc định:
- **Tốt** (xanh lá - #22c55e)
- **Khá** (xanh dương - #3b82f6)
- **Trung bình** (vàng - #eab308)
- **Chưa đạt** (đỏ - #ef4444)

## Cấu trúc bảng

```sql
CREATE TABLE evaluation_levels (
  id UUID PRIMARY KEY,
  name VARCHAR(50),           -- Tên mức (Tốt, Khá...)
  description TEXT,           -- Mô tả chi tiết
  color VARCHAR(7),          -- Mã màu hex (#22c55e)
  display_order INTEGER,     -- Thứ tự hiển thị (1, 2, 3...)
  is_active BOOLEAN,         -- Trạng thái (true/false)
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## Sử dụng

### Trong UI
Sau khi chạy migration:
1. Vào menu **"Mức đánh giá"** trên sidebar
2. Xem, thêm, sửa, xóa các mức đánh giá
3. Sắp xếp thứ tự hiển thị bằng nút mũi tên lên/xuống
4. Chọn màu sắc cho từng mức

### Quản lý
- **Thêm mức mới**: Nhấn nút "Thêm mức"
- **Sửa mức**: Click nút bút chì (Edit)
- **Xóa mức**: Click nút thùng rác (soft delete - chỉ ẩn, không xóa hẳn)
- **Sắp xếp**: Dùng nút mũi tên lên/xuống để thay đổi thứ tự

## Lưu ý
- Xóa mức đánh giá chỉ là **soft delete** (set `is_active = false`)
- Dữ liệu cũ vẫn giữ nguyên
- Có thể thêm nhiều mức đánh giá tùy ý
- Màu sắc dùng mã hex (#rrggbb)

## Rollback
Nếu cần xóa bảng:
```sql
DROP TABLE IF EXISTS evaluation_levels CASCADE;
```

⚠️ **Cảnh báo**: Chỉ chạy rollback nếu bạn chắc chắn muốn xóa toàn bộ!
