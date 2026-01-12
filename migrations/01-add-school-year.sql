-- Migration: Add school_year to classes table
-- Purpose: Support multiple school years with separate classes and data
-- Author: System
-- Date: 2026-01-11

-- Step 1: Add school_year column to classes table
ALTER TABLE classes
ADD COLUMN school_year VARCHAR(9) DEFAULT '2025-2026';

-- Step 2: Update existing classes to current school year
UPDATE classes
SET school_year = '2025-2026'
WHERE school_year IS NULL;

-- Step 3: Make school_year NOT NULL after setting defaults
ALTER TABLE classes
ALTER COLUMN school_year SET NOT NULL;

-- Step 4: Create index for better query performance
CREATE INDEX idx_classes_school_year ON classes(school_year);

-- Step 5: Create composite index for common queries (school_year + grade_id)
CREATE INDEX idx_classes_school_year_grade ON classes(school_year, grade_id);

-- Step 6: Add comment to document the column
COMMENT ON COLUMN classes.school_year IS 'School year in format YYYY-YYYY (e.g., 2025-2026)';

-- Verification query (optional - run after migration)
-- SELECT school_year, COUNT(*) as class_count
-- FROM classes
-- GROUP BY school_year
-- ORDER BY school_year DESC;
