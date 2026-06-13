-- Migration: Add structure_json column for storing structural segmentation results
-- Применяется автоматически из backend/db/migrate.ts.
-- Здесь оставлено как справочный артефакт.

ALTER TABLE track_analysis ADD COLUMN structure_json TEXT;  -- JSON: [{label:"verse",start:0,end:30,...}]
