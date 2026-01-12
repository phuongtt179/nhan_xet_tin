-- ============================================
-- Migration: Add Evaluation Levels Table
-- Purpose: Allow dynamic configuration of evaluation levels
-- Date: 2026-01-12
-- ============================================

-- Create evaluation_levels table
CREATE TABLE evaluation_levels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  color VARCHAR(7) NOT NULL, -- Hex color code (e.g., #22c55e)
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create index for ordering
CREATE INDEX idx_evaluation_levels_order ON evaluation_levels(display_order);
CREATE INDEX idx_evaluation_levels_active ON evaluation_levels(is_active);

-- Add comment
COMMENT ON TABLE evaluation_levels IS 'Dynamic evaluation levels configuration';
COMMENT ON COLUMN evaluation_levels.name IS 'Level name (e.g., Tốt, Khá, Trung bình)';
COMMENT ON COLUMN evaluation_levels.color IS 'Hex color code for UI display';
COMMENT ON COLUMN evaluation_levels.display_order IS 'Order for displaying in UI (lower = higher priority)';

-- Insert default evaluation levels
INSERT INTO evaluation_levels (name, description, color, display_order) VALUES
  ('Tốt', 'Hoàn thành tốt các yêu cầu', '#22c55e', 1),
  ('Khá', 'Hoàn thành khá tốt các yêu cầu', '#3b82f6', 2),
  ('Trung bình', 'Hoàn thành một phần các yêu cầu', '#eab308', 3),
  ('Chưa đạt', 'Chưa hoàn thành các yêu cầu', '#ef4444', 4);

-- Verification query
SELECT * FROM evaluation_levels ORDER BY display_order;
