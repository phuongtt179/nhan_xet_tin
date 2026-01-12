-- =============================================
-- DATABASE SCHEMA: HỆ THỐNG ĐÁNH GIÁ HỌC SINH
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. BẢNG KHỐI LỚP (GRADES)
-- =============================================
CREATE TABLE grades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL UNIQUE, -- "Khối 3", "Khối 4", "Khối 5"
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 2. BẢNG LỚP HỌC (CLASSES)
-- =============================================
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  grade_id UUID REFERENCES grades(id) ON DELETE CASCADE,
  schedule VARCHAR(100), -- Lịch học: "Thứ 2, 4, 6 - 14:00"
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 3. BẢNG HỌC SINH (STUDENTS)
-- =============================================
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  computer_name VARCHAR(10) UNIQUE, -- A1-A8, B1-B8, C1-C8, D1-D8, E1-E8 (40 máy)
  phone VARCHAR(20),
  parent_phone VARCHAR(20),
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index cho students
CREATE INDEX idx_students_class ON students(class_id);
CREATE INDEX idx_students_computer_name ON students(computer_name);

-- =============================================
-- 4. BẢNG CHỦ ĐỀ (TOPICS)
-- =============================================
CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  grade_id UUID REFERENCES grades(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0, -- Thứ tự hiển thị
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index cho topics
CREATE INDEX idx_topics_grade ON topics(grade_id);

-- =============================================
-- 5. BẢNG TIÊU CHÍ (CRITERIA)
-- =============================================
CREATE TABLE criteria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0, -- Thứ tự hiển thị
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index cho criteria
CREATE INDEX idx_criteria_topic ON criteria(topic_id);

-- =============================================
-- 6. BẢNG ĐÁNH GIÁ (EVALUATIONS)
-- =============================================
-- Lưu lịch sử đánh giá: mỗi lần đánh giá là 1 record mới
CREATE TABLE evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  criterion_id UUID REFERENCES criteria(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  rating VARCHAR(50) NOT NULL CHECK (rating IN ('not_completed', 'completed', 'completed_well', 'completed_excellent')),
  note TEXT,
  evaluated_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index cho evaluations
CREATE INDEX idx_evaluations_student ON evaluations(student_id);
CREATE INDEX idx_evaluations_criterion ON evaluations(criterion_id);
CREATE INDEX idx_evaluations_class ON evaluations(class_id);
CREATE INDEX idx_evaluations_date ON evaluations(evaluated_date);
CREATE INDEX idx_evaluations_rating ON evaluations(rating);

-- =============================================
-- 7. BẢNG ĐIỂM DANH (ATTENDANCE) - Giữ lại
-- =============================================
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent')),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, class_id, date)
);

-- Index cho attendance
CREATE INDEX idx_attendance_student ON attendance(student_id);
CREATE INDEX idx_attendance_class ON attendance(class_id);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_status ON attendance(status);

-- =============================================
-- 8. DỮ LIỆU MẪU (OPTIONAL)
-- =============================================

-- Tạo 3 khối
INSERT INTO grades (name, description) VALUES
  ('Khối 3', 'Học sinh lớp 3'),
  ('Khối 4', 'Học sinh lớp 4'),
  ('Khối 5', 'Học sinh lớp 5');

-- Lấy ID của Khối 3 để tạo ví dụ
-- (Trong thực tế, bạn sẽ lấy ID này từ query)

-- Ví dụ tạo lớp cho Khối 3
-- INSERT INTO classes (name, grade_id, schedule) VALUES
--   ('Lớp 3A', 'UUID-của-Khối-3', 'Thứ 2, 4, 6 - 14:00');

-- Ví dụ tạo chủ đề cho Khối 3
-- INSERT INTO topics (name, description, grade_id, display_order) VALUES
--   ('Làm quen với máy tính', 'Học sinh biết bật tắt máy, sử dụng chuột bàn phím', 'UUID-của-Khối-3', 1);

-- Ví dụ tạo tiêu chí cho chủ đề
-- INSERT INTO criteria (name, description, topic_id, display_order) VALUES
--   ('Bật tắt máy đúng cách', 'Học sinh biết bật/tắt máy đúng quy trình', 'UUID-của-chủ-đề', 1),
--   ('Sử dụng chuột', 'Học sinh biết click, double-click, kéo thả', 'UUID-của-chủ-đề', 2),
--   ('Lưu bài đúng thư mục', 'Học sinh biết lưu file vào đúng thư mục được chỉ định', 'UUID-của-chủ-đề', 3);

-- =============================================
-- NOTES
-- =============================================
-- 1. Rating levels (4 mức đánh giá):
--    - not_completed: Chưa hoàn thành
--    - completed: Hoàn thành
--    - completed_well: Hoàn thành tốt
--    - completed_excellent: Hoàn thành rất tốt

-- 2. Computer names (40 máy):
--    A1-A8, B1-B8, C1-C8, D1-D8, E1-E8

-- 3. Đánh giá lịch sử:
--    - Mỗi lần đánh giá tạo 1 record mới
--    - Lấy đánh giá mới nhất: ORDER BY evaluated_date DESC, created_at DESC LIMIT 1

-- 4. Tổng hợp kết quả chủ đề:
--    - Lấy tất cả tiêu chí trong chủ đề
--    - Với mỗi tiêu chí, lấy đánh giá cao nhất (latest)
--    - Tính toán:
--      + Hoàn thành rất tốt: tất cả tiêu chí đều completed_excellent
--      + Hoàn thành tốt: >= 75% tiêu chí completed_well trở lên, không có not_completed
--      + Hoàn thành: < 75% completed_well, không có not_completed
--      + Chưa hoàn thành: có >= 50% tiêu chí not_completed
