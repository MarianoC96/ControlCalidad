-- Create edit_requests table
CREATE TABLE IF NOT EXISTS edit_requests (
    id SERIAL PRIMARY KEY,
    registro_id INTEGER NOT NULL REFERENCES registros(id) ON DELETE CASCADE,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    status VARCHAR(20) DEFAULT 'pendiente', -- 'pendiente', 'aprobado', 'rechazado', 'usado'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by INTEGER REFERENCES usuarios(id)
);

-- Index for faster lookups
CREATE INDEX idx_edit_requests_registro ON edit_requests(registro_id);
CREATE INDEX idx_edit_requests_usuario ON edit_requests(usuario_id);
CREATE INDEX idx_edit_requests_status ON edit_requests(status);
