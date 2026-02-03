-- =====================================================
-- Table: history_edits
-- Stores edit history for registros
-- =====================================================
CREATE TABLE IF NOT EXISTS history_edits (
    id SERIAL PRIMARY KEY,
    registro_id INTEGER NOT NULL REFERENCES registros(id) ON DELETE CASCADE,
    edited_by INTEGER NOT NULL REFERENCES usuarios(id),
    role VARCHAR(50) NOT NULL,
    action VARCHAR(255) NOT NULL,
    photos_added JSONB,
    photos_deleted JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_history_edits_registro ON history_edits(registro_id);
CREATE INDEX IF NOT EXISTS idx_history_edits_user ON history_edits(edited_by);

-- Enable RLS
ALTER TABLE history_edits ENABLE ROW LEVEL SECURITY;

-- Allow authenticated read access
CREATE POLICY "Allow authenticated read access" ON history_edits FOR SELECT TO authenticated USING (true);

-- Allow authenticated insert
CREATE POLICY "Allow authenticated insert" ON history_edits FOR INSERT TO authenticated WITH CHECK (true);
