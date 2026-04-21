-- Add optional birth_date column to settings
-- Used for more accurate BMR, TDEE, and body composition calculations
ALTER TABLE settings ADD COLUMN IF NOT EXISTS birth_date DATE DEFAULT NULL;
