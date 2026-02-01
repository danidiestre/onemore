-- Migration to add color_index to participants table
-- Run this in your Supabase SQL Editor

ALTER TABLE participants 
ADD COLUMN IF NOT EXISTS color_index INTEGER;

-- Set default color_index based on creation order for existing participants
-- This ensures existing participants get a color assigned
UPDATE participants p
SET color_index = subquery.row_num - 1
FROM (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at) as row_num
  FROM participants
) subquery
WHERE p.id = subquery.id AND p.color_index IS NULL;
