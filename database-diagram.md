# Database Schema - Hệ thống Đánh giá Học sinh

## Sơ đồ quan hệ

```
┌─────────────┐
│   GRADES    │ (Khối lớp: Khối 3, 4, 5)
│─────────────│
│ id          │◄─────┐
│ name        │      │
│ description │      │
└─────────────┘      │
                     │
                     │ 1:N
                     │
         ┌───────────┴──────────┬──────────────────┐
         │                      │                  │
         │                      │                  │
┌────────▼─────┐      ┌─────────▼──────┐          │
│   CLASSES    │      │    TOPICS      │          │
│──────────────│      │────────────────│          │
│ id           │◄─┐   │ id             │◄─┐       │
│ name         │  │   │ name           │  │       │
│ grade_id     │  │   │ description    │  │       │
│ schedule     │  │   │ grade_id       │  │       │
└──────────────┘  │   │ display_order  │  │       │
                  │   └────────────────┘  │       │
                  │                       │       │
                  │ 1:N                   │ 1:N   │
                  │                       │       │
         ┌────────┴─────────┐    ┌────────▼──────┐│
         │                  │    │   CRITERIA    ││
         │                  │    │───────────────││
┌────────▼─────┐            │    │ id            ││
│  STUDENTS    │            │    │ name          ││
│──────────────│            │    │ description   ││
│ id           │◄─┐         │    │ topic_id      ││
│ name         │  │         │    │ display_order ││
│ computer_name│  │         │    └───────────────┘│
│ phone        │  │         │             │       │
│ parent_phone │  │         │             │       │
│ class_id     │  │         │             │       │
└──────────────┘  │         │             │ 1:N   │
                  │         │             │       │
                  │ 1:N     │ 1:N         │       │
                  │         │             │       │
         ┌────────┴────┬────┴─────────────▼───────┘
         │             │
         │             │
┌────────▼──────┐ ┌────▼─────────────┐
│  ATTENDANCE   │ │   EVALUATIONS    │
│───────────────│ │──────────────────│
│ id            │ │ id               │
│ student_id    │ │ student_id       │
│ class_id      │ │ criterion_id     │
│ date          │ │ class_id         │
│ status        │ │ rating           │
│ note          │ │ note             │
└───────────────┘ │ evaluated_date   │
                  └──────────────────┘
```

## Chi tiết các bảng

### 1. GRADES (Khối lớp)
- **Mục đích**: Quản lý các khối: Khối 3, Khối 4, Khối 5
- **Quan hệ**:
  - 1 khối có nhiều lớp
  - 1 khối có nhiều chủ đề

### 2. CLASSES (Lớp học)
- **Mục đích**: Quản lý các lớp học (ví dụ: 3A, 3B, 4A...)
- **Quan hệ**:
  - Thuộc 1 khối
  - Có nhiều học sinh
  - Có nhiều bản ghi điểm danh
  - Có nhiều bản ghi đánh giá

### 3. STUDENTS (Học sinh)
- **Mục đích**: Quản lý thông tin học sinh
- **Đặc điểm**:
  - `computer_name`: UNIQUE trong toàn hệ thống (A1-A8, B1-B8...E1-E8)
  - Thuộc 1 lớp (khi chuyển lớp cần update class_id và computer_name)
- **Quan hệ**:
  - Thuộc 1 lớp
  - Có nhiều bản ghi điểm danh
  - Có nhiều bản ghi đánh giá

### 4. TOPICS (Chủ đề)
- **Mục đích**: Quản lý các chủ đề học tập theo khối
- **Ví dụ**: "Làm quen với máy tính", "Microsoft Word cơ bản"...
- **Quan hệ**:
  - Thuộc 1 khối
  - Có nhiều tiêu chí

### 5. CRITERIA (Tiêu chí)
- **Mục đích**: Quản lý các tiêu chí đánh giá trong mỗi chủ đề
- **Ví dụ**: "Bật tắt máy đúng cách", "Lưu bài đúng thư mục"...
- **Quan hệ**:
  - Thuộc 1 chủ đề
  - Có nhiều bản ghi đánh giá

### 6. EVALUATIONS (Đánh giá)
- **Mục đích**: Lưu lịch sử đánh giá học sinh theo tiêu chí
- **Rating levels**:
  - `not_completed`: Chưa hoàn thành
  - `completed`: Hoàn thành
  - `completed_well`: Hoàn thành tốt
  - `completed_excellent`: Hoàn thành rất tốt
- **Đặc điểm**:
  - Lưu lịch sử: mỗi lần đánh giá tạo 1 record mới
  - Lấy đánh giá mới nhất để hiển thị
- **Quan hệ**:
  - 1 đánh giá của 1 học sinh
  - Cho 1 tiêu chí
  - Trong 1 lớp

### 7. ATTENDANCE (Điểm danh) - Giữ lại
- **Mục đích**: Quản lý điểm danh học sinh
- **Status**: `present`, `absent`
- **Đặc điểm**: UNIQUE(student_id, class_id, date)

## Workflow

### 1. Setup ban đầu
```
1. Tạo Khối (Khối 3, 4, 5)
2. Tạo Lớp thuộc Khối
3. Thêm Học sinh vào Lớp (gán tên máy)
4. Tạo Chủ đề cho Khối
5. Tạo Tiêu chí cho Chủ đề
```

### 2. Đánh giá học sinh
```
1. Chọn Lớp
2. Chọn Tiêu chí (trong chủ đề của khối)
3. Hiển thị danh sách học sinh
4. Chạm vào học sinh → cycle qua 4 mức đánh giá
5. Lưu đánh giá (tạo record mới trong evaluations)
```

### 3. Tổng hợp theo chủ đề
```
1. Chọn Chủ đề
2. Lấy tất cả Tiêu chí trong chủ đề
3. Lấy tất cả Học sinh trong lớp của khối
4. Với mỗi học sinh:
   - Lấy đánh giá mới nhất cho từng tiêu chí
   - Tính tổng hợp:
     * >= 75% tiêu chí "hoàn thành tốt" trở lên + không có "chưa hoàn thành" → "Hoàn thành tốt"
     * < 75% "hoàn thành tốt" + không có "chưa hoàn thành" → "Hoàn thành"
     * Có >= 50% tiêu chí "chưa hoàn thành" → "Chưa hoàn thành"
```

### 4. Tổng hợp theo học sinh
```
1. Chọn Học sinh
2. Lấy tất cả Chủ đề của khối
3. Với mỗi chủ đề:
   - Lấy kết quả tổng hợp chủ đề của học sinh đó
4. Hiển thị danh sách: Chủ đề | Kết quả
```

## Thay đổi so với schema cũ

### Bỏ:
- ❌ `payments` - Bỏ chức năng học phí
- ❌ `student_classes` - Không cần multi-class, học sinh chỉ thuộc 1 lớp

### Thêm mới:
- ✅ `grades` - Khối lớp
- ✅ `topics` - Chủ đề
- ✅ `criteria` - Tiêu chí
- ✅ `evaluations` - Đánh giá

### Sửa đổi:
- ✏️ `students` - Thêm `computer_name` (UNIQUE)
- ✏️ `classes` - Thêm `grade_id`
- ✏️ `attendance` - Giữ lại, đơn giản hóa status (chỉ present/absent)
