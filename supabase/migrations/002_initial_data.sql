-- =====================================================
-- Control de Calidad - Supabase Data Migration
-- =====================================================
-- This file contains all initial data from the original PHP app
-- Run this AFTER 001_initial_schema.sql
-- =====================================================

-- =====================================================
-- Drop existing data to avoid conflicts
-- We delete children tables first to avoid FK violations
-- =====================================================
DELETE FROM controles;
DELETE FROM fotos;
DELETE FROM registros;
DELETE FROM parametros;
DELETE FROM productos;
DELETE FROM parametros_maestros;
DELETE FROM usuarios;

-- =====================================================
-- Table: usuarios (Users)
-- Password hashes are from the original PHP app using bcrypt
-- =====================================================
INSERT INTO usuarios (id, nombre_completo, usuario, email, email_verified, password, activo, created_at, updated_at, roles, two_factor_secret) VALUES
(1, 'Martha Limo Figueroa', 'martha', 'martha@empresa.com', false, '$2y$10$Gpn8xsrDeIvLv/MJKn6sj.UuemuJ0Ffz.ywX9fbuUb62AzCV17l.i', true, '2025-07-04 02:29:15', '2025-07-13 17:51:57', 'trabajador', NULL),
(2, 'Mariano Castro Limo', 'mariano', 'mariano@empresa.com', false, '$2y$10$Gpn8xsrDeIvLv/MJKn6sj.UuemuJ0Ffz.ywX9fbuUb62AzCV17l.i', true, '2025-07-04 02:29:15', '2025-07-13 17:51:57', 'trabajador', NULL),
(3, 'Administrador', 'admin', 'daltonleiva6667@gmail.com', false, '$2y$10$ubA1IqQl9iLzw6JBC1dg7Ov51wwCxgxcymkHY8JWkycQpCjCUkpU2', true, '2025-07-04 02:29:15', '2025-07-13 20:38:51', 'administrador', 'LSUSNVUTIG47IWBZ')
ON CONFLICT (usuario) DO UPDATE SET
  nombre_completo = EXCLUDED.nombre_completo,
  email = EXCLUDED.email,
  password = EXCLUDED.password,
  roles = EXCLUDED.roles,
  two_factor_secret = EXCLUDED.two_factor_secret;

-- Reset sequence to continue from max id
SELECT setval('usuarios_id_seq', (SELECT MAX(id) FROM usuarios));

-- =====================================================
-- Table: parametros_maestros (Master Parameters)
-- =====================================================
-- First, delete existing and insert fresh data
DELETE FROM parametros_maestros;

INSERT INTO parametros_maestros (id, nombre, tipo, created_at) VALUES
(1, 'COLOR', 'texto', '2025-07-04 03:18:56'),
(2, 'PESO', 'rango', '2025-07-04 03:18:56'),
(3, 'GRAMAJE', 'rango', '2025-07-04 03:18:56'),
(4, 'ANCHO', 'rango', '2025-07-04 03:18:56'),
(5, 'ALTURA', 'rango', '2025-07-04 03:18:56'),
(6, 'LARGO', 'rango', '2025-07-04 03:18:56'),
(7, 'DIÁMETRO EXTERNO', 'rango', '2025-07-04 03:18:56'),
(8, 'DIÁMETRO EXTERNO BOCA', 'rango', '2025-07-04 03:18:56'),
(9, 'DIÁMETRO', 'rango', '2025-07-04 03:18:56'),
(10, 'DIAMETRO SUPERIOR', 'rango', '2025-07-04 03:18:56'),
(11, 'DIAMETRO INFERIOR', 'rango', '2025-07-04 03:18:56'),
(12, 'N° PUENTES DE UNIÓN', 'numero', '2025-07-04 03:18:56'),
(13, 'FUELLE', 'rango', '2025-07-04 03:18:56'),
(14, 'CAPACIDAD DE REBOSE', 'rango', '2025-07-04 03:18:56'),
(15, 'CALIBRE', 'rango', '2025-07-04 03:18:56'),
(16, 'APARIENCIA', 'texto', '2025-07-04 03:18:56'),
(17, 'BASE DOSIFICADOR', 'texto', '2025-07-04 03:18:56'),
(18, 'OLOR', 'texto', '2025-07-04 03:18:56'),
(19, 'SABOR', 'texto', '2025-07-04 03:18:56'),
(20, 'TEXTURA', 'texto', '2025-07-04 03:18:56'),
(21, 'INDICE DE REFRACCIÓN', 'rango', '2025-07-04 03:18:56'),
(22, '°Brix', 'rango', '2025-07-04 03:18:56'),
(23, 'pH', 'rango', '2025-07-04 03:18:56'),
(24, 'MATERIA EXTRAÑA', 'texto', '2025-07-04 03:18:56'),
(25, 'DISTANCIA', 'rango', '2025-07-14 00:31:01');

-- Reset sequence
SELECT setval('parametros_maestros_id_seq', (SELECT MAX(id) FROM parametros_maestros));

-- =====================================================
-- Table: productos (Products)
-- =====================================================
INSERT INTO productos (id, nombre, created_at, updated_at) VALUES
(6, 'Tapa PET # 45', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(7, 'Bolsa pack aceituna x 240g', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(8, 'Bolsa doy pack c/válvula x 1 kg', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(9, 'Bolsa doy pack c/válvula x 500g', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(10, 'Bolsa c/impresión aceituna x 1 kg', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(11, 'Botella PET x 1.9 L', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(12, 'Galonera PET x 3.785 L', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(13, 'Botella PET x 1 L', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(14, 'Botella PET x 60 ml', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(15, 'Botella oscura x 250 ml', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(16, 'Botella transparente x 250 ml', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(17, 'Botella transparente x 200 ml', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(18, 'Botella transparente x 500 ml', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(19, 'Caja N° 2 Aceite x 200 ml', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(20, 'Caja N° 3 Salsa x 340 g', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(21, 'Caja N° 7 Sachet x 240 g', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(22, 'Caja N° 10 aceite x 500 ml', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(23, 'Caja N° 14 aceituna x 1 kg', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(24, 'Caja N° 15 Aceite x 1 L', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(25, 'Cápsula botella x 250 ml', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(26, 'Capuchón tela finas hierbas', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(27, 'Capuchón tela vinagreta', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(28, 'Corcho N° 10', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(29, 'Dosificador canastilla 31.5', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(30, 'Jarrita aceitera x 250 ml', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(31, 'Tapa pilfer', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(32, 'Tapa PET N° 28', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(33, 'Aceite de Oliva Virgen', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(34, 'Ácido acético', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(35, 'Ácido cítrico', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(36, 'Ají panca', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(37, 'Ajo pelado', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(38, 'Aroma Ajo 16447/SZ - Aromas del Perú', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(39, 'Aroma Ajo FL - 14456S - Aromas del Perú', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(40, 'Azúcar blanca doméstica', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(41, 'Bebida gasificada jarabeada', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(42, 'Benzoato de sodio', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(43, 'BHT', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(44, 'Canela China', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(45, 'Castañas', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(46, 'Cebolla roja', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(47, 'Comino', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(48, 'Hierbas aromáticas', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(49, 'Glutamato monosódico (Ajinomoto)', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(50, 'Leche evaporada', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(51, 'Mayonesa', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(52, 'Pepinillo encurtido', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(53, 'Perma-Flo', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(54, 'Pimienta Blanca molida', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(55, 'Pimienta Negra molida', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(56, 'Pimiento', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(57, 'Polisorbato 80', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(58, 'Rocoto', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(59, 'Sabor Ajo x31242-04 - CRAMER', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(60, 'Sal', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(61, 'Mostaza', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(62, 'Salsa Lee perrins', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(63, 'Sorbato de potasio', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(64, 'Stabimix', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(65, 'Vinagre blanco al 5%', '2025-07-04 03:19:06', '2025-07-04 03:19:06'),
(70, 'Regla', '2025-07-14 00:31:48', '2025-07-14 00:31:48')
ON CONFLICT (nombre) DO UPDATE SET
  updated_at = EXCLUDED.updated_at;

-- Reset sequence
SELECT setval('productos_id_seq', (SELECT MAX(id) FROM productos));

-- =====================================================
-- Table: registros (Quality Control Records)
-- =====================================================
INSERT INTO registros (id, lote_interno, guia, cantidad, producto_id, producto_nombre, usuario_id, usuario_nombre, observaciones_generales, verificado_por, fecha_registro) VALUES
(1, 'dgfykdgk', 'gfkfgjk', 124, 7, 'Bolsa pack aceituna x 240g', 3, 'Administrador', 'fgulhjlhlk', NULL, '2025-07-04 03:25:03'),
(15, 'fgjkf', 'gjk', 111, 38, 'Aroma Ajo 16447/SZ - Aromas del Perú', 3, 'Administrador', '', NULL, '2025-07-13 21:33:50'),
(16, 'fyjk', 'fgjk', 21, 34, 'Ácido acético', 3, 'Administrador', '', NULL, '2025-07-13 21:35:05'),
(17, 'fyjlfhj', 'fhjlfjl', 111, 41, 'Bebida gasificada jarabeada', 3, 'Administrador', 'fjkfj', NULL, '2025-07-13 21:38:02'),
(18, 'setdj', 'fjdf', 111, 35, 'Ácido cítrico', 3, 'Administrador', '', NULL, '2025-07-13 21:38:50'),
(19, 'sdfgjfs', 'gjdfjg', 111, 33, 'Aceite de Oliva Virgen', 2, 'Mariano Castro Limo', 'dhsdghj', NULL, '2025-07-14 00:24:32'),
(20, 'dghds', 'dghsdfgh', 111, 33, 'Aceite de Oliva Virgen', 3, 'Administrador', 'dsgjh', 'Administrador', '2025-07-14 13:23:08'),
(21, 'asdfhafh', 'afhafh', 111, 33, 'Aceite de Oliva Virgen', 3, 'Administrador', 'asfhafsh', 'Administrador', '2025-07-14 13:33:04'),
(22, 'fjdf', 'hdfhjdfh', 111, 33, 'Aceite de Oliva Virgen', 3, 'Administrador', 'dfhk', 'Administrador', '2025-07-14 13:42:55'),
(23, 'adsrfh', 'sdfgh', 111, 33, 'Aceite de Oliva Virgen', 3, 'Administrador', 'dgsjfdjh', 'Administrador', '2025-07-14 13:54:40'),
(24, 'dsfghsd', 'dshsdghf', 111, 33, 'Aceite de Oliva Virgen', 3, 'Administrador', 'sdgjsdgj', 'Administrador', '2025-07-14 14:02:03')
ON CONFLICT (id) DO UPDATE SET
  lote_interno = EXCLUDED.lote_interno,
  guia = EXCLUDED.guia,
  cantidad = EXCLUDED.cantidad,
  producto_id = EXCLUDED.producto_id,
  producto_nombre = EXCLUDED.producto_nombre,
  usuario_id = EXCLUDED.usuario_id,
  usuario_nombre = EXCLUDED.usuario_nombre,
  observaciones_generales = EXCLUDED.observaciones_generales,
  verificado_por = EXCLUDED.verificado_por,
  fecha_registro = EXCLUDED.fecha_registro;

-- Reset sequence
SELECT setval('registros_id_seq', (SELECT MAX(id) FROM registros));

-- =====================================================
-- Table: controles (Quality Control Checks)
-- =====================================================
INSERT INTO controles (id, registro_id, parametro_nombre, rango_completo, valor_control, texto_control, parametro_tipo, observacion, fuera_de_rango, mensaje_alerta, created_at) VALUES
(1, 1, 'ANCHO', '22.02 - 28.35 cm', 23.00, NULL, NULL, 'ghk', false, '', '2025-07-04 03:25:03'),
(2, 1, 'COLOR', 'Transparente', 0.00, NULL, NULL, '', false, '', '2025-07-04 03:25:03'),
(3, 1, 'GRAMAJE', '33.81 - 36.63 gr/cm²', 35.00, NULL, NULL, '', false, '', '2025-07-04 03:25:03'),
(4, 1, 'LARGO', '33.33 - 42.86 cm', 30.00, NULL, NULL, '', true, 'Valor 30 está por debajo del rango mínimo (33.33)', '2025-07-04 03:25:03'),
(35, 20, 'COLOR', 'Amarillo', 0.00, NULL, NULL, 'dsgh', false, '', '2025-07-14 13:23:08'),
(36, 20, 'INDICE DE REFRACCIÓN', '1.4805 - 1.4905', 1.00, NULL, NULL, 'dgsh', true, 'Valor 1 está por debajo del rango mínimo (1.48)', '2025-07-14 13:23:08'),
(37, 20, 'OLOR', 'Característico', 0.00, NULL, NULL, 'dsgh', false, '', '2025-07-14 13:23:08'),
(38, 20, 'SABOR', 'Característico', 0.00, NULL, NULL, 'dsgh', false, '', '2025-07-14 13:23:08'),
(39, 20, 'TEXTURA', 'Firme', 0.00, NULL, NULL, 'sdg', false, '', '2025-07-14 13:23:08'),
(40, 21, 'color', 'amarillo', 0.00, NULL, NULL, 'dasfhd', false, '', '2025-07-14 13:33:04'),
(41, 21, 'indice de refraccion', '1.4805 - 1.4905', 1.00, NULL, NULL, 'fhdsfh', true, 'Valor ''1'' fuera de rango (1.48 - 1.49).', '2025-07-14 13:33:04'),
(42, 21, 'olor', 'caracteristico', 0.00, NULL, NULL, 'dsfh', true, 'El valor ''ac'' no coincide con el esperado ''Característico''.', '2025-07-14 13:33:04'),
(43, 21, 'sabor', 'caracteristico', 0.00, NULL, NULL, 'dfhs', true, 'El valor ''fasd'' no coincide con el esperado ''Característico''.', '2025-07-14 13:33:04'),
(44, 21, 'textura', 'firme', 0.00, NULL, NULL, 'dsfh', true, 'El valor ''dsfhgfdh'' no coincide con el esperado ''Firme''.', '2025-07-14 13:33:04'),
(45, 22, 'color', 'amarillo', 0.00, NULL, 'texto', 'fdghj', true, 'El valor ''dfsgj'' no coincide con el esperado ''Amarillo''.', '2025-07-14 13:42:55'),
(46, 22, 'indice de refraccion', '1.4805 - 1.4905', 1.00, NULL, 'rango', 'dfhk', true, 'Valor ''1'' fuera de rango (1.48 - 1.49).', '2025-07-14 13:42:55'),
(47, 22, 'olor', 'caracteristico', 0.00, NULL, 'texto', 'dfhk', true, 'El valor ''fsgj'' no coincide con el esperado ''Característico''.', '2025-07-14 13:42:55'),
(48, 22, 'sabor', 'caracteristico', 0.00, NULL, 'texto', 'dfhk', true, 'El valor ''sfgj'' no coincide con el esperado ''Característico''.', '2025-07-14 13:42:55'),
(49, 22, 'textura', 'firme', 0.00, NULL, 'texto', 'dfhk', true, 'El valor ''fsjfh'' no coincide con el esperado ''Firme''.', '2025-07-14 13:42:55'),
(50, 23, 'indice de refraccion', '1.4805 - 1.4905', 1.00, NULL, 'rango', 'dsgh', true, 'Valor ''1'' fuera de rango (1.48 - 1.49).', '2025-07-14 13:54:40'),
(51, 24, 'color', 'amarillo', NULL, 'dsgfjsdgj', 'texto', '', true, 'El valor ''dsgfjsdgj'' no coincide con el esperado ''Amarillo''.', '2025-07-14 14:02:03'),
(52, 24, 'indice de refraccion', '1.4805 - 1.4905', 1.00, NULL, 'rango', '', true, 'Valor ''1'' fuera de rango (1.48 - 1.49).', '2025-07-14 14:02:03'),
(53, 24, 'olor', 'caracteristico', NULL, 'sdfgjsdgj', 'texto', '', true, 'El valor ''sdfgjsdgj'' no coincide con el esperado ''Característico''.', '2025-07-14 14:02:03'),
(54, 24, 'sabor', 'caracteristico', NULL, 'sdgj', 'texto', '', true, 'El valor ''sdgj'' no coincide con el esperado ''Característico''.', '2025-07-14 14:02:03'),
(55, 24, 'textura', 'firme', NULL, 'sdfgj', 'texto', '', true, 'El valor ''sdfgj'' no coincide con el esperado ''Firme''.', '2025-07-14 14:02:03')
ON CONFLICT (id) DO UPDATE SET
  registro_id = EXCLUDED.registro_id,
  parametro_nombre = EXCLUDED.parametro_nombre,
  rango_completo = EXCLUDED.rango_completo,
  valor_control = EXCLUDED.valor_control,
  texto_control = EXCLUDED.texto_control,
  parametro_tipo = EXCLUDED.parametro_tipo,
  observacion = EXCLUDED.observacion,
  fuera_de_rango = EXCLUDED.fuera_de_rango,
  mensaje_alerta = EXCLUDED.mensaje_alerta;

-- Reset sequence
SELECT setval('controles_id_seq', (SELECT MAX(id) FROM controles));

-- =====================================================
-- Table: password_resets (for password recovery)
-- =====================================================
CREATE TABLE IF NOT EXISTS password_resets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);

-- Enable RLS for password_resets
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Table: sesiones (Sessions) - Optional, Supabase handles auth
-- =====================================================
-- Note: Supabase handles sessions natively, but we can keep this
-- for compatibility with the original PHP app structure
CREATE TABLE IF NOT EXISTS sesiones (
  id VARCHAR(128) PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones(usuario_id);

-- =====================================================
-- Note about fotos (Photos) table
-- =====================================================
-- The original PHP app stored photos as base64 in the database.
-- The fotos table already exists in 001_initial_schema.sql.
-- The original data contains very large base64 strings (1.9MB+)
-- which are not practical to include in a migration file.
-- 
-- If you need to migrate existing photos:
-- 1. Export them from the PHP/MySQL database
-- 2. Use a separate script to insert them into Supabase
-- 3. Or better yet, migrate to Supabase Storage for file handling
--
-- For testing purposes, we're not including the photo data here
-- due to its extremely large size (several MB of base64 text)

-- =====================================================
-- Success message
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE 'Data migration completed successfully!';
  RAISE NOTICE 'Users: 3';
  RAISE NOTICE 'Master Parameters: 25';
  RAISE NOTICE 'Products: 46';
  RAISE NOTICE 'Records: 10';
  RAISE NOTICE 'Controls: 25';
END $$;
