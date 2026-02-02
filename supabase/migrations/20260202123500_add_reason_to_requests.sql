-- Add reason column to edit_requests
ALTER TABLE edit_requests ADD COLUMN IF NOT EXISTS motivo TEXT;
