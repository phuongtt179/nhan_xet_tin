-- ============================================
-- Script: Rollback Year Transition
-- Purpose: Delete all data for a specific school year
-- WARNING: This will permanently delete data!
-- ============================================

-- IMPORTANT: Replace '2026-2027' with the school year you want to delete
-- Example: If you want to delete 2026-2027, keep it as is
--          If you want to delete another year, change the value below

-- Step 1: Find all classes for the year
-- Run this first to see what will be deleted:
SELECT
  c.id,
  c.name,
  c.school_year,
  g.name as grade_name,
  COUNT(s.id) as student_count
FROM classes c
LEFT JOIN grades g ON c.grade_id = g.id
LEFT JOIN students s ON s.class_id = c.id
WHERE c.school_year = '2026-2027'  -- Change this to your test year
GROUP BY c.id, c.name, c.school_year, g.name;

-- Step 2: Delete attendance records for these classes
-- Uncomment below to execute:
-- DELETE FROM attendance
-- WHERE class_id IN (
--   SELECT id FROM classes WHERE school_year = '2026-2027'
-- );

-- Step 3: Delete evaluation records for these classes
-- Uncomment below to execute:
-- DELETE FROM evaluations
-- WHERE class_id IN (
--   SELECT id FROM classes WHERE school_year = '2026-2027'
-- );

-- Step 4: Option A - Delete students from these classes
-- (If you created new students during transition)
-- Uncomment below to execute:
-- DELETE FROM students
-- WHERE class_id IN (
--   SELECT id FROM classes WHERE school_year = '2026-2027'
-- );

-- Step 4: Option B - Move students back to old classes
-- (If you want to keep students and move them back)
-- You need to manually update students to their original class_id
-- Example:
-- UPDATE students
-- SET class_id = 'old-class-id-here'
-- WHERE class_id = 'new-class-id-here';

-- Step 5: Delete the classes for this year
-- Uncomment below to execute:
-- DELETE FROM classes
-- WHERE school_year = '2026-2027';

-- ============================================
-- Verification: Check if deletion was successful
-- ============================================
-- Run this after deletion to verify:
-- SELECT school_year, COUNT(*) as class_count
-- FROM classes
-- GROUP BY school_year
-- ORDER BY school_year DESC;
