-- Migration: Thêm bảng phân phối chương trình
-- Chạy file này trong Supabase SQL Editor

CREATE TABLE IF NOT EXISTS curriculum (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  grade_id UUID NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  school_year VARCHAR(9) NOT NULL,
  week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 52),
  period_number INTEGER CHECK (period_number >= 1 AND period_number <= 7),
  lesson_name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index để query nhanh
CREATE INDEX IF NOT EXISTS idx_curriculum_lookup
  ON curriculum(grade_id, subject_id, school_year, week_number);

-- Trigger cập nhật updated_at
CREATE OR REPLACE FUNCTION update_curriculum_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER curriculum_updated_at
  BEFORE UPDATE ON curriculum
  FOR EACH ROW EXECUTE FUNCTION update_curriculum_updated_at();

-- RLS
ALTER TABLE curriculum ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for curriculum" ON curriculum
  FOR ALL USING (true) WITH CHECK (true);
