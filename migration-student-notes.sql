-- =============================================
-- NHẬN XÉT TỰ DO (student_notes)
-- =============================================
-- Lưu lời nhận xét tự do của giáo viên (không bắt buộc gắn tiêu chí),
-- viết qua icon chat AI nổi hoặc lưu lại bản tổng hợp AI đã duyệt
-- (category = 'summary_month' | 'summary_semester').

CREATE TABLE IF NOT EXISTS student_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id),
  user_id UUID REFERENCES users(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  content TEXT NOT NULL,
  category VARCHAR(30),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_notes_student_date ON student_notes(student_id, date);
CREATE INDEX IF NOT EXISTS idx_student_notes_class_date ON student_notes(class_id, date);

ALTER TABLE student_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on student_notes" ON student_notes FOR ALL USING (true) WITH CHECK (true);
