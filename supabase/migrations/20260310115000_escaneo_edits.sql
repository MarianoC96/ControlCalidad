-- Create edit requests for scanning module
CREATE TABLE IF NOT EXISTS edit_requests_escaneo (
    id SERIAL PRIMARY KEY,
    historial_id INTEGER NOT NULL,
    scan_mode TEXT NOT NULL CHECK (scan_mode IN ('productos', 'cajas')),
    usuario_id INTEGER REFERENCES usuarios(id),
    motivo TEXT,
    status TEXT DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'aprobado', 'rechazado')),
    admin_id INTEGER REFERENCES usuarios(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add lock columns to historial_escaneos_productos
ALTER TABLE historial_escaneos_productos
ADD COLUMN IF NOT EXISTS edit_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS edit_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS edit_started_by INTEGER REFERENCES usuarios(id);

-- Add lock columns to historial_escaneos_cajas
ALTER TABLE historial_escaneos_cajas
ADD COLUMN IF NOT EXISTS edit_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS edit_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS edit_started_by INTEGER REFERENCES usuarios(id);

-- Create table to track actual edits in escaneo
CREATE TABLE IF NOT EXISTS edit_history_escaneo (
    id SERIAL PRIMARY KEY,
    historial_id INTEGER NOT NULL,
    scan_mode TEXT NOT NULL CHECK (scan_mode IN ('productos', 'cajas')),
    usuario_id INTEGER REFERENCES usuarios(id),
    changes JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edit_requests_escaneo_historial ON edit_requests_escaneo(historial_id, scan_mode);
CREATE INDEX IF NOT EXISTS idx_edit_requests_escaneo_status ON edit_requests_escaneo(status);
CREATE INDEX IF NOT EXISTS idx_edit_history_escaneo_historial ON edit_history_escaneo(historial_id, scan_mode);
