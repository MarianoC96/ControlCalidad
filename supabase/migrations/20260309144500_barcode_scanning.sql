-- =====================================================
-- Barcode Scanning - Supabase Database Migration
-- =====================================================

-- Table: productos_barcode
CREATE TABLE IF NOT EXISTS productos_barcode (
  barcode TEXT PRIMARY KEY,
  vida_util TEXT,
  registro_sanitario TEXT,
  presentacion TEXT,
  unidades_por_caja INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: cajas_barcode
CREATE TABLE IF NOT EXISTS cajas_barcode (
  barcode TEXT PRIMARY KEY,
  tipo_caja TEXT,
  capacidad_max INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: historial_escaneos_productos
CREATE TABLE IF NOT EXISTS historial_escaneos_productos (
  id SERIAL PRIMARY KEY,
  barcode TEXT NOT NULL REFERENCES productos_barcode(barcode) ON DELETE CASCADE,
  lote TEXT NOT NULL,
  usuario_id INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: historial_escaneos_cajas
CREATE TABLE IF NOT EXISTS historial_escaneos_cajas (
  id SERIAL PRIMARY KEY,
  barcode TEXT NOT NULL REFERENCES cajas_barcode(barcode) ON DELETE CASCADE,
  lote TEXT NOT NULL,
  usuario_id INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_historial_productos_barcode ON historial_escaneos_productos(barcode);
CREATE INDEX IF NOT EXISTS idx_historial_productos_usuario ON historial_escaneos_productos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_historial_cajas_barcode ON historial_escaneos_cajas(barcode);
CREATE INDEX IF NOT EXISTS idx_historial_cajas_usuario ON historial_escaneos_cajas(usuario_id);

-- Triggers for updated_at
CREATE TRIGGER update_productos_barcode_updated_at
  BEFORE UPDATE ON productos_barcode
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cajas_barcode_updated_at
  BEFORE UPDATE ON cajas_barcode
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE productos_barcode ENABLE ROW LEVEL SECURITY;
ALTER TABLE cajas_barcode ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_escaneos_productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_escaneos_cajas ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Allow authenticated read access barcode products" ON productos_barcode FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access barcode boxes" ON cajas_barcode FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access history products" ON historial_escaneos_productos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access history boxes" ON historial_escaneos_cajas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert barcode products" ON productos_barcode FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated insert barcode boxes" ON cajas_barcode FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated insert history products" ON historial_escaneos_productos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated insert history boxes" ON historial_escaneos_cajas FOR INSERT TO authenticated WITH CHECK (true);

-- Admin policies
CREATE POLICY "Allow admin all access barcode products" ON productos_barcode FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin all access barcode boxes" ON cajas_barcode FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Initial Data
INSERT INTO productos_barcode (barcode, vida_util, registro_sanitario, presentacion, unidades_por_caja) VALUES
('7751234567890', '12 meses', 'RS-1234-A', 'Aceituna Verde 200g', 24),
('7750987654321', '24 meses', 'RS-5678-B', 'Aceite de Oliva Extra Virgen', 12),
('7751122334455', '18 meses', 'RS-9012-C', 'Aceituna Negra Deshuesada', 24)
ON CONFLICT (barcode) DO NOTHING;

INSERT INTO cajas_barcode (barcode, tipo_caja, capacidad_max) VALUES
('CAJ-998877', 'Caja Master Cartón', 24),
('CAJ-665544', 'Pack Termoencogible x6', 6)
ON CONFLICT (barcode) DO NOTHING;
