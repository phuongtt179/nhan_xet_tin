-- ============================================
-- Quick Delete Script for Test Year
-- ============================================
-- IMPORTANT: Change '2026-2027' to your test year

-- This script will DELETE ALL DATA for the specified year
-- Run each command ONE BY ONE in Supabase SQL Editor

-- 1. Preview what will be deleted (RUN THIS FIRST!)
SELECT
  'Classes to delete:' as info,
  COUNT(*) as count
FROM classes
WHERE school_year = '2026-2027';

-- 2. Delete attendance records
DELETE FROM attendance
WHERE class_id IN (
  SELECT id FROM classes WHERE school_year = '2026-2027'
);

-- 3. Delete evaluation records
DELETE FROM evaluations
WHERE class_id IN (
  SELECT id FROM classes WHERE school_year = '2026-2027'
);

-- 4. Set students' class_id to NULL (they won't be deleted)
-- OR delete students if they were created during test
UPDATE students
SET class_id = NULL
WHERE class_id IN (
  SELECT id FROM classes WHERE school_year = '2026-2027'
);

-- If you want to DELETE students instead:
-- DELETE FROM students
-- WHERE class_id IN (
--   SELECT id FROM classes WHERE school_year = '2026-2027'
-- );

-- 5. Delete the classes
DELETE FROM classes
WHERE school_year = '2026-2027';

-- 6. Verify deletion
SELECT school_year, COUNT(*) as total_classes
FROM classes
GROUP BY school_year
ORDER BY school_year DESC;
