-- =====================================================
-- Control de Calidad - Supabase Database Migration
-- =====================================================
-- Run this in Supabase SQL Editor to create all tables
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- Table: usuarios
-- =====================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nombre_completo VARCHAR(255) NOT NULL,
  usuario VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255),
  email_verified BOOLEAN DEFAULT false,
  password VARCHAR(255) NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  roles VARCHAR(50) DEFAULT 'trabajador' CHECK (roles IN ('administrador', 'trabajador')),
  two_factor_secret VARCHAR(100)
);

-- =====================================================
-- Table: productos
-- =====================================================
CREATE TABLE IF NOT EXISTS productos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Table: parametros_maestros
-- =====================================================
CREATE TABLE IF NOT EXISTS parametros_maestros (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  tipo VARCHAR(20) NOT NULL DEFAULT 'texto' CHECK (tipo IN ('texto', 'numero', 'rango')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Table: parametros
-- =====================================================
CREATE TABLE IF NOT EXISTS parametros (
  id SERIAL PRIMARY KEY,
  producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  parametro_maestro_id INTEGER REFERENCES parametros_maestros(id),
  nombre VARCHAR(255) NOT NULL,
  tipo VARCHAR(20) DEFAULT 'texto' CHECK (tipo IN ('texto', 'numero', 'rango')),
  valor VARCHAR(255),
  rango_min DECIMAL(10,2),
  rango_max DECIMAL(10,2),
  unidad VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Table: registros
-- =====================================================
CREATE TABLE IF NOT EXISTS registros (
  id SERIAL PRIMARY KEY,
  lote_interno VARCHAR(100) NOT NULL,
  guia VARCHAR(100),
  cantidad INTEGER NOT NULL,
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  producto_nombre VARCHAR(255) NOT NULL,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  usuario_nombre VARCHAR(255) NOT NULL,
  observaciones_generales TEXT,
  verificado_por VARCHAR(255),
  fecha_registro TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Table: controles
-- =====================================================
CREATE TABLE IF NOT EXISTS controles (
  id SERIAL PRIMARY KEY,
  registro_id INTEGER NOT NULL REFERENCES registros(id) ON DELETE CASCADE,
  parametro_nombre VARCHAR(255) NOT NULL,
  rango_completo TEXT NOT NULL,
  valor_control DECIMAL(10,2),
  texto_control VARCHAR(255),
  parametro_tipo VARCHAR(50),
  observacion TEXT,
  fuera_de_rango BOOLEAN DEFAULT false,
  mensaje_alerta TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Table: fotos (storing base64 encoded images - matching original PHP)
-- =====================================================
CREATE TABLE IF NOT EXISTS fotos (
  id SERIAL PRIMARY KEY,
  registro_id INTEGER NOT NULL REFERENCES registros(id) ON DELETE CASCADE,
  datos_base64 TEXT NOT NULL,
  descripcion VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Indexes for better performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_parametros_producto ON parametros(producto_id);
CREATE INDEX IF NOT EXISTS idx_parametros_maestro ON parametros(parametro_maestro_id);
CREATE INDEX IF NOT EXISTS idx_registros_producto ON registros(producto_id);
CREATE INDEX IF NOT EXISTS idx_registros_usuario ON registros(usuario_id);
CREATE INDEX IF NOT EXISTS idx_registros_fecha ON registros(fecha_registro);
CREATE INDEX IF NOT EXISTS idx_controles_registro ON controles(registro_id);
CREATE INDEX IF NOT EXISTS idx_fotos_registro ON fotos(registro_id);

-- =====================================================
-- Function to update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_usuarios_updated_at
  BEFORE UPDATE ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_productos_updated_at
  BEFORE UPDATE ON productos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE parametros_maestros ENABLE ROW LEVEL SECURITY;
ALTER TABLE parametros ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE controles ENABLE ROW LEVEL SECURITY;
ALTER TABLE fotos ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users (basic - adjust based on your needs)
CREATE POLICY "Allow authenticated read access" ON usuarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON productos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON parametros_maestros FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON parametros FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON registros FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON controles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON fotos FOR SELECT TO authenticated USING (true);

-- Allow all authenticated users to insert registros
CREATE POLICY "Allow authenticated insert" ON registros FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated insert" ON controles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated insert" ON fotos FOR INSERT TO authenticated WITH CHECK (true);

-- Admin policies for full access (use with service role or specific user checks)
CREATE POLICY "Allow admin all access" ON usuarios FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin all access" ON productos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin all access" ON parametros_maestros FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin all access" ON parametros FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- Insert default master parameters
-- =====================================================
INSERT INTO parametros_maestros (nombre, tipo) VALUES
  ('COLOR', 'texto'),
  ('PESO', 'rango'),
  ('GRAMAJE', 'rango'),
  ('ANCHO', 'rango'),
  ('ALTURA', 'rango'),
  ('LARGO', 'rango'),
  ('DIÁMETRO EXTERNO', 'rango'),
  ('DIÁMETRO EXTERNO BOCA', 'rango'),
  ('DIÁMETRO', 'rango'),
  ('DIAMETRO SUPERIOR', 'rango'),
  ('DIAMETRO INFERIOR', 'rango'),
  ('N° PUENTES DE UNIÓN', 'numero'),
  ('FUELLE', 'rango'),
  ('CAPACIDAD DE REBOSE', 'rango'),
  ('CALIBRE', 'rango'),
  ('APARIENCIA', 'texto'),
  ('BASE DOSIFICADOR', 'texto'),
  ('OLOR', 'texto'),
  ('SABOR', 'texto'),
  ('TEXTURA', 'texto'),
  ('INDICE DE REFRACCIÓN', 'rango'),
  ('°Brix', 'rango'),
  ('pH', 'rango'),
  ('MATERIA EXTRAÑA', 'texto'),
  ('DISTANCIA', 'rango')
ON CONFLICT (nombre) DO NOTHING;

-- =====================================================
-- Insert default admin user (password: admin123)
-- Hash generated with bcrypt
-- =====================================================
INSERT INTO usuarios (nombre_completo, usuario, email, password, roles) VALUES
  ('Administrador', 'admin', 'admin@empresa.com', '$2a$10$xVWsJPTsH5g1jDXEqfGrOeTlVsKqNQpUlsRPb7dUqPKhHOTWFKkSG', 'administrador')
ON CONFLICT (usuario) DO NOTHING;
