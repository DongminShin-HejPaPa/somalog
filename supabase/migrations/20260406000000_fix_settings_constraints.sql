-- diet_preset: add 'easygoing' to allowed values
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_diet_preset_check;
ALTER TABLE settings ADD CONSTRAINT settings_diet_preset_check
  CHECK (diet_preset IN ('easygoing', 'sustainable', 'medium', 'intensive', 'custom'));

-- intensive_day_criteria: remove CHECK so custom numeric values are allowed
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_intensive_day_criteria_check;
