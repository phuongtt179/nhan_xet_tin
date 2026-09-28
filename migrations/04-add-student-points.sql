-- Migration: Thêm bảng điểm thưởng (Bộ công cụ lớp học)
-- Chạy file này trong Supabase SQL Editor

CREATE TABLE IF NOT EXISTS student_points (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id),
  user_id UUID REFERENCES users(id),
  date DATE NOT NULL,
  period INTEGER NOT NULL CHECK (period >= 1 AND period <= 7),
  points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, class_id, date, period)
);

-- Index để query nhanh
CREATE INDEX IF NOT EXISTS idx_student_points_lookup
  ON student_points(class_id, date, period);
CREATE INDEX IF NOT EXISTS idx_student_points_student
  ON student_points(student_id);

-- Trigger cập nhật updated_at
CREATE OR REPLACE FUNCTION update_student_points_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER student_points_updated_at
  BEFORE UPDATE ON student_points
  FOR EACH ROW EXECUTE FUNCTION update_student_points_updated_at();

-- RLS
ALTER TABLE student_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for student_points" ON student_points
  FOR ALL USING (true) WITH CHECK (true);
