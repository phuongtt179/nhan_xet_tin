-- Add sessions column to payments table
-- Run this in Supabase SQL Editor

ALTER TABLE payments
ADD COLUMN sessions INTEGER DEFAULT 1;

-- Add comment
COMMENT ON COLUMN payments.sessions IS 'Số buổi học trong tháng';
