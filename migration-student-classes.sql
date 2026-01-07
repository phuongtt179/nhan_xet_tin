-- Migration: Multi-Class Students Feature
-- Run this in Supabase SQL Editor

-- ============================================
-- Step 1: Create student_classes Junction Table
-- ============================================

CREATE TABLE IF NOT EXISTS student_classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Each student can only have one relationship per class
  UNIQUE(student_id, class_id)
);

-- Create EXCLUDE constraint to ensure only ONE primary class per student
-- Note: This requires btree_gist extension
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE student_classes
ADD CONSTRAINT student_classes_one_primary_per_student
EXCLUDE USING gist (student_id WITH =) WHERE (is_primary = true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_student_classes_student_id ON student_classes(student_id);
CREATE INDEX IF NOT EXISTS idx_student_classes_class_id ON student_classes(class_id);
CREATE INDEX IF NOT EXISTS idx_student_classes_is_primary ON student_classes(student_id, is_primary) WHERE is_primary = true;

-- Add table comments
COMMENT ON TABLE student_classes IS 'Many-to-many relationship: students can join multiple classes (1 primary + N secondary)';
COMMENT ON COLUMN student_classes.is_primary IS 'Primary class appears in payments, secondary classes only for attendance tracking';

-- ============================================
-- Step 2: Migrate Existing Data
-- ============================================

-- Migrate existing students.class_id to student_classes as PRIMARY class
INSERT INTO student_classes (student_id, class_id, is_primary, enrolled_at)
SELECT
  id as student_id,
  class_id,
  true as is_primary,
  COALESCE(created_at, NOW()) as enrolled_at
FROM students
WHERE class_id IS NOT NULL
ON CONFLICT (student_id, class_id) DO NOTHING;

-- Verify migration - these two counts should match
DO $$
DECLARE
  old_count INTEGER;
  new_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO old_count FROM students WHERE class_id IS NOT NULL;
  SELECT COUNT(*) INTO new_count FROM student_classes WHERE is_primary = true;

  RAISE NOTICE 'Migration verification:';
  RAISE NOTICE 'Old count (students.class_id): %', old_count;
  RAISE NOTICE 'New count (student_classes.is_primary): %', new_count;

  IF old_count != new_count THEN
    RAISE WARNING 'Migration count mismatch! Please investigate.';
  ELSE
    RAISE NOTICE 'Migration successful!';
  END IF;
END $$;

-- ============================================
-- Step 3: Keep Historical Data on Class Deletion
-- ============================================

-- Modify attendance foreign key to keep historical data when class is deleted
ALTER TABLE attendance
DROP CONSTRAINT IF EXISTS attendance_class_id_fkey,
ADD CONSTRAINT attendance_class_id_fkey
FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL;

-- Modify payments foreign key to keep historical data when class is deleted
ALTER TABLE payments
DROP CONSTRAINT IF EXISTS payments_class_id_fkey,
ADD CONSTRAINT payments_class_id_fkey
FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL;

-- ============================================
-- Step 4: Create Sync Trigger (Backward Compatibility)
-- ============================================

-- This trigger keeps students.class_id in sync with student_classes.is_primary
-- Allows gradual migration of UI code

CREATE OR REPLACE FUNCTION sync_student_primary_class()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = true THEN
    -- Update students table with primary class
    UPDATE students
    SET class_id = NEW.class_id,
        updated_at = NOW()
    WHERE id = NEW.student_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_student_primary_class
AFTER INSERT OR UPDATE ON student_classes
FOR EACH ROW
WHEN (NEW.is_primary = true)
EXECUTE FUNCTION sync_student_primary_class();

-- Handle deletes: when primary class relationship is deleted, set class_id to NULL
CREATE OR REPLACE FUNCTION sync_student_primary_class_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_primary = true THEN
    UPDATE students
    SET class_id = NULL,
        updated_at = NOW()
    WHERE id = OLD.student_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_student_primary_class_delete
AFTER DELETE ON student_classes
FOR EACH ROW
WHEN (OLD.is_primary = true)
EXECUTE FUNCTION sync_student_primary_class_delete();

-- ============================================
-- Step 5: Enable Row Level Security
-- ============================================

ALTER TABLE student_classes ENABLE ROW LEVEL SECURITY;

-- Allow all operations (adjust based on your authentication requirements)
CREATE POLICY "Allow all operations on student_classes"
ON student_classes FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================
-- Step 6: Create updated_at Trigger
-- ============================================

-- Create update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_student_classes_updated_at
BEFORE UPDATE ON student_classes
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Migration Complete!
-- ============================================

-- Summary of changes:
-- 1. Created student_classes table with constraints
-- 2. Migrated existing data from students.class_id
-- 3. Modified foreign keys to preserve historical data (ON DELETE SET NULL)
-- 4. Created sync triggers for backward compatibility
-- 5. Enabled RLS and added policies

-- Next steps:
-- 1. Update TypeScript types in lib/supabase.ts
-- 2. Update Students page to support multi-class selection
-- 3. Update Attendance page to query from student_classes
-- 4. Update Payments page to auto-calculate sessions from attendance
