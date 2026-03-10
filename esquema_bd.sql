-- ==============================================================================
-- Arquitectura Central de Base de Datos - Sistema de Control de Calidad
-- ==============================================================================
-- Este archivo agrupa tanto la creación de todas las tablas de producción como
-- la INSERCIÓN de los DATOS MAESTROS INDISPENSABLES para el correcto 
-- funcionamiento (Usuarios, Parámetros Maestros, Productos y Permisos).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- PARTE 1: CREACIÓN DE TABLAS (ESTRUCTURA)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.configuracion_pdf (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  titulo text NOT NULL,
  codigo text NOT NULL,
  edicion text NOT NULL,
  aprobado_por text NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT configuracion_pdf_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.usuarios (
  id SERIAL PRIMARY KEY,
  nombre_completo character varying NOT NULL,
  usuario character varying NOT NULL UNIQUE,
  email character varying,
  email_verified boolean DEFAULT false,
  password character varying NOT NULL,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  roles character varying DEFAULT 'trabajador'::character varying CHECK (roles::text = ANY (ARRAY['administrador'::character varying, 'trabajador'::character varying]::text[])),
  two_factor_secret character varying,
  is_deleted boolean DEFAULT false,
  -- Permisos de Escaneo de Códigos de Barras
  permiso_escaneo boolean DEFAULT false,
  permiso_escaneo_productos boolean DEFAULT false,
  permiso_escaneo_cajas boolean DEFAULT false,
  permiso_escaneo_historial boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.productos_barcode (
  barcode text PRIMARY KEY,
  vida_util text,
  registro_sanitario text,
  presentacion text,
  unidades_por_caja integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cajas_barcode (
  barcode text PRIMARY KEY,
  tipo_caja text,
  capacidad_max integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.historial_escaneos_productos (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  barcode text NOT NULL REFERENCES public.productos_barcode(barcode) ON DELETE CASCADE,
  lote text NOT NULL,
  usuario_id integer NOT NULL REFERENCES public.usuarios(id),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.historial_escaneos_cajas (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  barcode text NOT NULL REFERENCES public.cajas_barcode(barcode) ON DELETE CASCADE,
  lote text NOT NULL,
  usuario_id integer NOT NULL REFERENCES public.usuarios(id),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.productos (
  id SERIAL PRIMARY KEY,
  nombre character varying NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.parametros_maestros (
  id SERIAL PRIMARY KEY,
  nombre character varying NOT NULL UNIQUE,
  tipo character varying NOT NULL DEFAULT 'texto'::character varying CHECK (tipo::text = ANY (ARRAY['texto'::character varying, 'numero'::character varying, 'rango'::character varying]::text[])),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.parametros (
  id SERIAL PRIMARY KEY,
  producto_id integer NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  parametro_maestro_id integer REFERENCES public.parametros_maestros(id),
  nombre character varying NOT NULL,
  tipo character varying DEFAULT 'texto'::character varying CHECK (tipo::text = ANY (ARRAY['texto'::character varying, 'numero'::character varying, 'rango'::character varying]::text[])),
  valor character varying,
  rango_min numeric,
  rango_max numeric,
  unidad character varying,
  created_at timestamp with time zone DEFAULT now(),
  valor_texto text,
  es_rango boolean DEFAULT false,
  rango_completo text
);

CREATE TABLE IF NOT EXISTS public.registros (
  id SERIAL PRIMARY KEY,
  lote_interno character varying NOT NULL,
  guia character varying,
  cantidad integer NOT NULL,
  producto_id integer NOT NULL REFERENCES public.productos(id),
  producto_nombre character varying NOT NULL,
  usuario_id integer NOT NULL REFERENCES public.usuarios(id),
  usuario_nombre character varying NOT NULL,
  observaciones_generales text,
  verificado_por character varying,
  fecha_registro timestamp with time zone DEFAULT now(),
  -- Histórico PDF
  pdf_titulo text,
  pdf_codigo text,
  pdf_edicion text,
  pdf_aprobado_por text,
  lote_producto text,
  marca text,
  -- Control Ediciones
  edit_started_at timestamp with time zone,
  edit_expires_at timestamp with time zone,
  edit_started_by integer REFERENCES public.usuarios(id)
);

CREATE TABLE IF NOT EXISTS public.controles (
  id SERIAL PRIMARY KEY,
  registro_id integer NOT NULL REFERENCES public.registros(id) ON DELETE CASCADE,
  parametro_nombre character varying NOT NULL,
  rango_completo text NOT NULL,
  valor_control numeric,
  texto_control character varying,
  parametro_tipo character varying,
  observacion text,
  fuera_de_rango boolean DEFAULT false,
  mensaje_alerta text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fotos (
  id SERIAL PRIMARY KEY,
  registro_id integer NOT NULL REFERENCES public.registros(id) ON DELETE CASCADE,
  datos_base64 text NOT NULL,
  descripcion character varying,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.history_edits (
  id SERIAL PRIMARY KEY,
  registro_id integer NOT NULL REFERENCES public.registros(id) ON DELETE CASCADE,
  edited_by integer NOT NULL REFERENCES public.usuarios(id),
  role text NOT NULL,
  action text NOT NULL,
  photos_added jsonb,
  photos_deleted jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.edit_requests (
  id SERIAL PRIMARY KEY,
  registro_id integer NOT NULL REFERENCES public.registros(id) ON DELETE CASCADE,
  usuario_id integer NOT NULL REFERENCES public.usuarios(id),
  status character varying(20) DEFAULT 'pendiente', 
  created_at timestamp with time zone DEFAULT now(),
  resolved_at timestamp with time zone,
  resolved_by integer REFERENCES public.usuarios(id),
  motivo text
);

CREATE TABLE IF NOT EXISTS public.download_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES public.usuarios(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_files integer DEFAULT 0,
  zip_name text,
  zip_path text,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'ready'::text, 'error'::text])),
  error_message text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.password_resets (
  id SERIAL PRIMARY KEY,
  user_id integer NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  token character varying NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sesiones (
  id character varying NOT NULL PRIMARY KEY,
  usuario_id integer NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval)
);

-- ------------------------------------------------------------------------------
-- PARTE 2: INSERCIÓN DE DATOS INICIALES MAESTROS E INDISPENSABLES (DML)
-- ------------------------------------------------------------------------------

-- Insertar Usuarios con sus Permisos y Rol
INSERT INTO public.usuarios (id, nombre_completo, usuario, email, email_verified, password, activo, roles, two_factor_secret, permiso_escaneo, permiso_escaneo_productos, permiso_escaneo_cajas, permiso_escaneo_historial) VALUES
(1, 'Super Administrador', 'sadmin', 'sadmin@controlcalidad.local', true, '$2a$10$xVWsJPTsH5g1jDXEqfGrOeTlVsKqNQpUlsRPb7dUqPKhHOTWFKkSG', true, 'administrador', NULL, true, true, true, true),
(3, 'Administrador', 'admin', 'admin@empresa.com', true, '$2y$10$ubA1IqQl9iLzw6JBC1dg7Ov51wwCxgxcymkHY8JWkycQpCjCUkpU2', true, 'administrador', 'LSUSNVUTIG47IWBZ', true, true, true, true)
ON CONFLICT (usuario) DO NOTHING;

-- Insertar Parámetros Maestros (Catálogo Obligatorio)
INSERT INTO public.parametros_maestros (id, nombre, tipo) VALUES
(1, 'COLOR', 'texto'),
(2, 'PESO', 'rango'),
(3, 'GRAMAJE', 'rango'),
(4, 'ANCHO', 'rango'),
(5, 'ALTURA', 'rango'),
(6, 'LARGO', 'rango'),
(7, 'DIÁMETRO EXTERNO', 'rango'),
(8, 'DIÁMETRO EXTERNO BOCA', 'rango'),
(9, 'DIÁMETRO', 'rango'),
(10, 'DIAMETRO SUPERIOR', 'rango'),
(11, 'DIAMETRO INFERIOR', 'rango'),
(12, 'N° PUENTES DE UNIÓN', 'numero'),
(13, 'FUELLE', 'rango'),
(14, 'CAPACIDAD DE REBOSE', 'rango'),
(15, 'CALIBRE', 'rango'),
(16, 'APARIENCIA', 'texto'),
(17, 'BASE DOSIFICADOR', 'texto'),
(18, 'OLOR', 'texto'),
(19, 'SABOR', 'texto'),
(20, 'TEXTURA', 'texto'),
(21, 'INDICE DE REFRACCIÓN', 'rango'),
(22, '°Brix', 'rango'),
(23, 'pH', 'rango'),
(24, 'MATERIA EXTRAÑA', 'texto'),
(25, 'DISTANCIA', 'rango')
ON CONFLICT (nombre) DO NOTHING;

-- Insertar Productos Base
INSERT INTO public.productos (id, nombre) VALUES
(6, 'Tapa PET # 45'),
(7, 'Bolsa pack aceituna x 240g'),
(8, 'Bolsa doy pack c/válvula x 1 kg')
ON CONFLICT (nombre) DO NOTHING;

-- Insertar Parámetros asociados al Producto 6 (Ejemplo)
INSERT INTO public.parametros (producto_id, parametro_maestro_id, nombre, tipo, rango_min, rango_max, unidad, valor_texto, es_rango, rango_completo) VALUES
(6, 1, 'COLOR', 'texto', 0.00, 0.00, NULL, 'Verde Esmeralda', false, 'Verde Esmeralda'),
(6, 2, 'PESO', 'rango', 0.00, 0.00, 'g', NULL, true, '5.7 g'),
(6, 5, 'ALTURA', 'rango', 17.30, 17.50, 'mm', NULL, true, '17.30 - 17.50 mm')
ON CONFLICT DO NOTHING;

-- Datos de Escaneo de Barras:
INSERT INTO public.productos_barcode (barcode, vida_util, registro_sanitario, presentacion, unidades_por_caja) VALUES
('7751234567890', '12 meses', 'RS-1234-A', 'Aceituna Verde 200g', 24)
ON CONFLICT (barcode) DO NOTHING;

INSERT INTO public.cajas_barcode (barcode, tipo_caja, capacidad_max) VALUES
('CAJ-998877', 'Caja Master Cartón', 24)
ON CONFLICT (barcode) DO NOTHING;

-- Ajustar las secuencias automáticamente para que las insersiones manuales (desde la UI) no choquen con IDs estáticos
SELECT setval('usuarios_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.usuarios));
SELECT setval('parametros_maestros_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.parametros_maestros));
SELECT setval('productos_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.productos));
SELECT setval('parametros_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.parametros));
-- ------------------------------------------------------------------------------
-- PARTE 2: INSERCIÓN DE DATOS INICIALES MAESTROS E INDISPENSABLES (DML)
-- ------------------------------------------------------------------------------


-- Insertar Usuarios con sus Permisos y Rol
INSERT INTO public.usuarios (id, nombre_completo, usuario, email, email_verified, password, activo, roles, two_factor_secret, permiso_escaneo, permiso_escaneo_productos, permiso_escaneo_cajas, permiso_escaneo_historial) VALUES
(1, 'Super Administrador', 'sadmin', 'sadmin@controlcalidad.local', true, '$2a$10$xVWsJPTsH5g1jDXEqfGrOeTlVsKqNQpUlsRPb7dUqPKhHOTWFKkSG', true, 'administrador', NULL, true, true, true, true),
(3, 'Administrador', 'admin', 'admin@empresa.com', true, '$2y$10$ubA1IqQl9iLzw6JBC1dg7Ov51wwCxgxcymkHY8JWkycQpCjCUkpU2', true, 'administrador', 'LSUSNVUTIG47IWBZ', true, true, true, true)
ON CONFLICT (usuario) DO NOTHING;

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

INSERT INTO parametros (id, producto_id, nombre, rango_min, rango_max, unidad, rango_completo, created_at, parametro_maestro_id, valor_texto, es_rango) VALUES
-- Producto 6: Tapa PET # 45
(99, 6, 'COLOR', 0.00, 0.00, NULL, 'Verde Esmeralda', '2025-07-04 03:44:16', 1, 'Verde Esmeralda', false),
(100, 6, 'PESO', 0.00, 0.00, 'g', '5.7 g', '2025-07-04 03:44:16', 2, NULL, true),
(101, 6, 'ALTURA', 17.30, 17.50, 'mm', '17.30 - 17.50 mm', '2025-07-04 03:44:16', 5, NULL, true),
(102, 6, 'LARGO', 51.30, 51.50, 'mm', '51.30 - 51.50 mm', '2025-07-04 03:44:16', 6, NULL, true),
(103, 6, 'N° PUENTES DE UNIÓN', 0.00, 0.00, NULL, '10', '2025-07-04 03:44:16', 12, '10', false),

-- Producto 7: Bolsa pack aceituna x 240g
(104, 7, 'COLOR', 0.00, 0.00, NULL, 'Transparente', '2025-07-04 03:44:16', 1, 'Transparente', false),
(105, 7, 'GRAMAJE', 33.81, 36.63, 'gr/cm²', '33.81 - 36.63 gr/cm²', '2025-07-04 03:44:16', 3, NULL, true),
(106, 7, 'ANCHO', 22.02, 28.35, 'cm', '22.02 - 28.35 cm', '2025-07-04 03:44:16', 4, NULL, true),
(107, 7, 'LARGO', 33.33, 42.86, 'cm', '33.33 - 42.86 cm', '2025-07-04 03:44:16', 6, NULL, true),

-- Producto 8: Bolsa doy pack c/válvula x 1 kg
(108, 8, 'COLOR', 0.00, 0.00, NULL, 'Transparente', '2025-07-04 03:44:16', 1, 'Transparente', false),
(109, 8, 'GRAMAJE', 124.47, 152.13, 'g/cm²', '124.47 - 152.13 g/cm²', '2025-07-04 03:44:16', 3, NULL, true),
(110, 8, 'ANCHO', 155.00, 165.00, 'mm', '155 - 165 mm', '2025-07-04 03:44:16', 4, NULL, true),
(111, 8, 'ALTURA', 255.00, 265.00, 'mm', '255 - 265 mm', '2025-07-04 03:44:16', 5, NULL, true),
(112, 8, 'FUELLE', 75.00, 85.00, 'mm', '75 - 85 mm', '2025-07-04 03:44:16', 13, NULL, true),

-- Producto 9: Bolsa doy pack c/válvula x 500g
(113, 9, 'COLOR', 0.00, 0.00, NULL, 'Transparente', '2025-07-04 03:44:16', 1, 'Transparente', false),
(114, 9, 'GRAMAJE', 111.60, 136.40, 'g/cm²', '111.6 - 136.4 g/cm²', '2025-07-04 03:44:16', 3, NULL, true),
(115, 9, 'ANCHO', 128.00, 138.00, 'mm', '128 - 138 mm', '2025-07-04 03:44:16', 4, NULL, true),
(116, 9, 'ALTURA', 205.00, 215.00, 'mm', '205 - 215 mm', '2025-07-04 03:44:16', 5, NULL, true),
(117, 9, 'FUELLE', 70.00, 80.00, 'mm', '70 - 80 mm', '2025-07-04 03:44:16', 13, NULL, true),

-- Producto 10: Bolsa c/impresión aceituna x 1 kg
(118, 10, 'COLOR', 0.00, 0.00, NULL, 'según patrón', '2025-07-04 03:44:16', 1, 'según patrón', false),
(119, 10, 'GRAMAJE', 100.00, 120.00, 'g/cm²', '100 - 120 g/cm²', '2025-07-04 03:44:16', 3, NULL, true),
(120, 10, 'ANCHO', 208.00, 212.00, 'mm', '208 - 212 mm', '2025-07-04 03:44:16', 4, NULL, true),
(121, 10, 'ALTURA', 278.00, 282.00, 'mm', '278 - 282 mm', '2025-07-04 03:44:16', 5, NULL, true),

-- Producto 11: Botella PET x 1.9 L
(122, 11, 'COLOR', 0.00, 0.00, NULL, 'Cristal transparente', '2025-07-04 03:44:16', 1, 'Cristal transparente', false),
(123, 11, 'PESO', 59.50, 60.50, 'g', '60 +/- 0.5 g', '2025-07-04 03:44:16', 2, NULL, true),
(124, 11, 'ALTURA', 279.00, 281.00, 'mm', '280 +/- 1 mm', '2025-07-04 03:44:16', 5, NULL, true),
(125, 11, 'DIÁMETRO EXTERNO BOCA', 24.66, 25.06, 'mm', '24.86 +/- 0.2 mm', '2025-07-04 03:44:16', 8, NULL, true),
(126, 11, 'CAPACIDAD DE REBOSE', 1938.00, 1942.00, 'ml', '1940 +/- 2 ml', '2025-07-04 03:44:16', 14, NULL, true),

-- Producto 12: Galonera PET x 3.785 L
(127, 12, 'COLOR', 0.00, 0.00, NULL, 'Cristal transparente', '2025-07-04 03:44:16', 1, 'Cristal transparente', false),
(128, 12, 'PESO', 89.80, 90.20, 'g', '90 +/- 0.2 g', '2025-07-04 03:44:16', 2, NULL, true),
(129, 12, 'ANCHO', 150.10, 150.50, 'mm', '150.3 +/- 0.2 mm', '2025-07-04 03:44:16', 4, NULL, true),
(130, 12, 'ALTURA', 320.40, 322.40, 'mm', '321.4 +/- 1 mm', '2025-07-04 03:44:16', 5, NULL, true),
(131, 12, 'DIÁMETRO EXTERNO BOCA', 44.70, 45.10, 'mm', '44.9 +/- 0.2 mm', '2025-07-04 03:44:16', 8, NULL, true),
(132, 12, 'CAPACIDAD DE REBOSE', 3794.00, 3806.00, 'ml', '3800 +/- 6 ml', '2025-07-04 03:44:16', 14, NULL, true),

-- Producto 13: Botella PET x 1 L
(133, 13, 'COLOR', 0.00, 0.00, NULL, 'Cristal transparente', '2025-07-04 03:44:16', 1, 'Cristal transparente', false),
(134, 13, 'PESO', 0.00, 0.00, 'g', '47 g', '2025-07-04 03:44:16', 2, NULL, true),
(135, 13, 'ALTURA', 277.50, 278.50, 'mm', '278 +/- 0.5 mm', '2025-07-04 03:44:16', 5, NULL, true),
(136, 13, 'DIÁMETRO EXTERNO BOCA', 24.00, 25.20, 'mm', '24 - 25.2 mm', '2025-07-04 03:44:16', 8, NULL, true),
(137, 13, 'CAPACIDAD DE REBOSE', 1017.50, 1018.50, 'ml', '1018 +/- 0.5 ml', '2025-07-04 03:44:16', 14, NULL, true),

-- Producto 14: Botella PET x 60 ml
(138, 14, 'COLOR', 0.00, 0.00, NULL, 'Cristal transparente', '2025-07-04 03:44:16', 1, 'Cristal transparente', false),
(139, 14, 'PESO', 0.00, 0.00, 'g', '11 g', '2025-07-04 03:44:16', 2, NULL, true),
(140, 14, 'ANCHO', 0.00, 0.00, 'mm', '28 mm', '2025-07-04 03:44:16', 4, NULL, true),
(141, 14, 'ALTURA', 0.00, 0.00, 'mm', '102 mm', '2025-07-04 03:44:16', 5, NULL, true),
(142, 14, 'DIÁMETRO EXTERNO BOCA', 0.00, 0.00, 'mm', '25 mm', '2025-07-04 03:44:16', 8, NULL, true),

-- Producto 15: Botella oscura x 250 ml
(143, 15, 'COLOR', 0.00, 0.00, NULL, 'Verde BI', '2025-07-04 03:44:16', 1, 'Verde BI', false),
(144, 15, 'PESO', 215.00, 235.00, 'g', '225 +/- 10 g', '2025-07-04 03:44:16', 2, NULL, true),
(145, 15, 'ALTURA', 210.50, 213.50, 'mm', '212 +/- 1.5 mm', '2025-07-04 03:44:16', 5, NULL, true),
(146, 15, 'DIÁMETRO EXTERNO BOCA', 27.70, 28.40, 'mm', '28 +/- 0.3 mm', '2025-07-04 03:44:16', 8, NULL, true),
(147, 15, 'CAPACIDAD DE REBOSE', 0.00, 0.00, 'ml', '266 ml', '2025-07-04 03:44:16', 14, NULL, true),

-- Producto 16: Botella transparente x 250 ml
(148, 16, 'COLOR', 0.00, 0.00, NULL, 'Transparente', '2025-07-04 03:44:16', 1, 'Transparente', false),
(149, 16, 'PESO', 215.00, 235.00, 'g', '225 +/-10 g', '2025-07-04 03:44:16', 2, NULL, true),
(150, 16, 'ALTURA', 210.50, 213.50, 'mm', '212 +/- 1.5 mm', '2025-07-04 03:44:16', 5, NULL, true),
(151, 16, 'DIÁMETRO EXTERNO BOCA', 27.70, 28.40, 'mm', '28 +/- 0.3 mm', '2025-07-04 03:44:16', 8, NULL, true),
(152, 16, 'CAPACIDAD DE REBOSE', 0.00, 0.00, 'ml', '266 ml', '2025-07-04 03:44:16', 14, NULL, true),

-- Producto 17: Botella transparente x 200 ml
(153, 17, 'COLOR', 0.00, 0.00, NULL, 'Transparente', '2025-07-04 03:44:16', 1, 'Transparente', false),
(154, 17, 'PESO', 181.00, 199.00, 'g', '190 +/- 9 g', '2025-07-04 03:44:16', 2, NULL, true),
(155, 17, 'ALTURA', 192.80, 195.20, 'mm', '194 +/- 1.2 mm', '2025-07-04 03:44:16', 5, NULL, true),
(156, 17, 'DIÁMETRO EXTERNO BOCA', 0.00, 0.00, 'mm', '28.09 mm', '2025-07-04 03:44:16', 8, NULL, true),
(157, 17, 'CAPACIDAD DE REBOSE', 209.50, 218.50, 'ml', '214 +/- 4.5 ml', '2025-07-04 03:44:16', 14, NULL, true),

-- Producto 18: Botella transparente x 500 ml
(158, 18, 'COLOR', 0.00, 0.00, NULL, 'Transparente', '2025-07-04 03:44:16', 1, 'Transparente', false),
(159, 18, 'PESO', 326.00, 354.00, 'g', '340 +/- 14 g', '2025-07-04 03:44:16', 2, NULL, true),
(160, 18, 'ALTURA', 263.40, 266.60, 'mm', '265 +/- 1.6 mm', '2025-07-04 03:44:16', 5, NULL, true),
(161, 18, 'DIÁMETRO EXTERNO BOCA', 0.00, 0.00, 'mm', '28.09 mm', '2025-07-04 03:44:16', 8, NULL, true),
(162, 18, 'CAPACIDAD DE REBOSE', 517.00, 531.00, 'ml', '524 +/- 7 ml', '2025-07-04 03:44:16', 14, NULL, true),

-- Producto 19-24: Cajas
(163, 19, 'COLOR', 0.00, 0.00, NULL, 'Beige', '2025-07-04 03:44:16', 1, 'Beige', false),
(164, 19, 'GRAMAJE', 0.00, 0.00, 'g/m²', 'min 361 g/m²', '2025-07-04 03:44:16', 3, NULL, true),
(165, 19, 'ANCHO', 23.30, 23.70, 'cm', '23.5 +/- 0.2 cm', '2025-07-04 03:44:16', 4, NULL, true),
(166, 19, 'ALTURA', 19.80, 20.20, 'cm', '20 +/- 0.2 cm', '2025-07-04 03:44:16', 5, NULL, true),
(167, 19, 'LARGO', 34.30, 34.70, 'cm', '34.5 +/-0.2 cm', '2025-07-04 03:44:16', 6, NULL, true),
(168, 19, 'CALIBRE', 3.68, 4.32, 'mm', '4 +/- 0.32 mm', '2025-07-04 03:44:16', 15, NULL, true),

(169, 20, 'COLOR', 0.00, 0.00, NULL, 'Beige', '2025-07-04 03:44:16', 1, 'Beige', false),
(170, 20, 'GRAMAJE', 0.00, 0.00, 'g/m²', 'min 361 g/m²', '2025-07-04 03:44:16', 3, NULL, true),
(171, 20, 'ANCHO', 21.40, 21.80, 'cm', '21.6 +/- 0.2 cm', '2025-07-04 03:44:16', 4, NULL, true),
(172, 20, 'ALTURA', 22.10, 22.50, 'cm', '22.3 +/- 0.2 cm', '2025-07-04 03:44:16', 5, NULL, true),
(173, 20, 'LARGO', 29.30, 29.70, 'cm', '29.5 +/- 0.2 cm', '2025-07-04 03:44:16', 6, NULL, true),
(174, 20, 'CALIBRE', 3.68, 4.32, 'mm', '4 +/- 0.32 mm', '2025-07-04 03:44:16', 15, NULL, true),

(175, 21, 'COLOR', 0.00, 0.00, NULL, 'Beige', '2025-07-04 03:44:16', 1, 'Beige', false),
(176, 21, 'GRAMAJE', 0.00, 0.00, 'g/m²', 'min 361 g/m²', '2025-07-04 03:44:16', 3, NULL, true),
(177, 21, 'ANCHO', 26.80, 27.20, 'cm', '27 +/- 0.2 cm', '2025-07-04 03:44:16', 4, NULL, true),
(178, 21, 'ALTURA', 14.80, 15.20, 'cm', '15 +/- 0.2 cm', '2025-07-04 03:44:16', 5, NULL, true),
(179, 21, 'LARGO', 33.80, 34.20, 'cm', '34 +/- 0.2 cm', '2025-07-04 03:44:16', 6, NULL, true),
(180, 21, 'CALIBRE', 3.68, 4.32, 'mm', '4 +/- 0.32 mm', '2025-07-04 03:44:16', 15, NULL, true),

(181, 22, 'COLOR', 0.00, 0.00, NULL, 'Beige', '2025-07-04 03:44:16', 1, 'Beige', false),
(182, 22, 'GRAMAJE', 0.00, 0.00, 'g/m²', 'min 361 g/m²', '2025-07-04 03:44:16', 3, NULL, true),
(183, 22, 'ANCHO', 19.80, 20.20, 'cm', '20 +/- 0.2 cm', '2025-07-04 03:44:16', 4, NULL, true),
(184, 22, 'ALTURA', 28.00, 28.40, 'cm', '28.2 +/- 0.2 cm', '2025-07-04 03:44:16', 5, NULL, true),
(185, 22, 'LARGO', 26.50, 26.90, 'cm', '26.7 +/- 0.2 cm', '2025-07-04 03:44:16', 6, NULL, true),
(186, 22, 'CALIBRE', 3.68, 4.32, 'mm', '4 +/- 0.32 mm', '2025-07-04 03:44:16', 15, NULL, true),

(187, 23, 'COLOR', 0.00, 0.00, NULL, 'Beige', '2025-07-04 03:44:16', 1, 'Beige', false),
(188, 23, 'GRAMAJE', 0.00, 0.00, 'g/m²', 'min 455 g/m²', '2025-07-04 03:44:16', 3, NULL, true),
(189, 23, 'ANCHO', 28.60, 29.00, 'cm', '28.8 +/- 0.2 cm', '2025-07-04 03:44:16', 4, NULL, true),
(190, 23, 'ALTURA', 18.90, 19.30, 'cm', '19.1 +/-0.2 cm', '2025-07-04 03:44:16', 5, NULL, true),
(191, 23, 'CALIBRE', 3.68, 4.32, 'mm', '4 +/- 0.32 mm', '2025-07-04 03:44:16', 15, NULL, true),

(192, 24, 'COLOR', 0.00, 0.00, NULL, 'Beige', '2025-07-04 03:44:16', 1, 'Beige', false),
(193, 24, 'GRAMAJE', 0.00, 0.00, 'g/m²', 'min 361 g/m²', '2025-07-04 03:44:16', 3, NULL, true),
(194, 24, 'ANCHO', 23.00, 23.40, 'cm', '23.2 +/- 0.2 cm', '2025-07-04 03:44:16', 4, NULL, true),
(195, 24, 'ALTURA', 28.00, 28.40, 'cm', '28.2 +/- 0.2 cm', '2025-07-04 03:44:16', 5, NULL, true),
(196, 24, 'LARGO', 29.40, 29.80, 'cm', '29.6 +/- 0.2 cm', '2025-07-04 03:44:16', 6, NULL, true),
(197, 24, 'CALIBRE', 3.68, 4.32, 'mm', '4 +/- 0.32 mm', '2025-07-04 03:44:16', 15, NULL, true),

-- Producto 25-32: Cápsulas, Capuchones, Corcho, Dosificador, Jarrita, Tapas
(198, 25, 'COLOR', 0.00, 0.00, NULL, 'Dorado', '2025-07-04 03:44:16', 1, 'Dorado', false),
(199, 25, 'ALTURA', 44.00, 46.00, 'mm', '45 +/- 1 mm', '2025-07-04 03:44:16', 5, NULL, true),
(200, 25, 'DIÁMETRO EXTERNO', 32.00, 34.00, 'mm', '33 +/- 1 mm', '2025-07-04 03:44:16', 7, NULL, true),

(201, 26, 'COLOR', 0.00, 0.00, NULL, 'Verde oscuro', '2025-07-04 03:44:16', 1, 'Verde oscuro', false),
(202, 26, 'APARIENCIA', 0.00, 0.00, NULL, 'Tela a cuadros borde zigzag', '2025-07-04 03:44:16', 16, 'Tela a cuadros borde zigzag', false),

(203, 27, 'COLOR', 0.00, 0.00, NULL, 'Verde claro', '2025-07-04 03:44:16', 1, 'Verde claro', false),
(204, 27, 'APARIENCIA', 0.00, 0.00, NULL, 'Tela a cuadros borde zigzag', '2025-07-04 03:44:16', 16, 'Tela a cuadros borde zigzag', false),

(205, 28, 'COLOR', 0.00, 0.00, NULL, 'Natural', '2025-07-04 03:44:16', 1, 'Natural', false),
(206, 28, 'DIAMETRO SUPERIOR', 25.30, 25.60, 'mm', '25.3 - 25.6 mm', '2025-07-04 03:44:16', 10, NULL, true),
(207, 28, 'DIAMETRO INFERIOR', 19.40, 19.60, 'mm', '19.4 - 19.6 mm', '2025-07-04 03:44:16', 11, NULL, true),

(208, 29, 'COLOR', 0.00, 0.00, NULL, 'Blanco', '2025-07-04 03:44:16', 1, 'Blanco', false),
(209, 29, 'DIÁMETRO', 0.00, 0.00, 'mm', '23 mm', '2025-07-04 03:44:16', 9, NULL, true),
(210, 29, 'DIÁMETRO EXTERNO', 0.00, 0.00, 'mm', '11 mm', '2025-07-04 03:44:16', 7, NULL, true),
(211, 29, 'DIÁMETRO EXTERNO', 0.00, 0.00, 'mm', '31.5 mm', '2025-07-04 03:44:16', 7, NULL, true),
(212, 29, 'N° PUENTES DE UNIÓN', 0.00, 0.00, NULL, '9', '2025-07-04 03:44:16', 12, '9', false),
(213, 29, 'BASE DOSIFICADOR', 0.00, 0.00, NULL, 'Lisa / rosca', '2025-07-04 03:44:16', 17, 'Lisa / rosca', false),

(214, 30, 'COLOR', 0.00, 0.00, NULL, 'Transparente', '2025-07-04 03:44:16', 1, 'Transparente', false),
(215, 30, 'PESO', 254.00, 276.00, 'g', '265 +/- 11 g', '2025-07-04 03:44:16', 2, NULL, true),
(216, 30, 'ALTURA', 145.50, 148.50, 'mm', '147 +/- 1.5 mm', '2025-07-04 03:44:16', 5, NULL, true),
(217, 30, 'CAPACIDAD DE REBOSE', 261.00, 271.00, 'ml', '266 +/- 5 ml', '2025-07-04 03:44:16', 14, NULL, true),

(218, 31, 'COLOR', 0.00, 0.00, NULL, 'Dorado brillante', '2025-07-04 03:44:16', 1, 'Dorado brillante', false),
(219, 31, 'DIÁMETRO', 23.00, 25.00, 'mm', '24 +/-1 mm', '2025-07-04 03:44:16', 9, NULL, true),

(220, 32, 'COLOR', 0.00, 0.00, NULL, 'Verde esmeralda', '2025-07-04 03:44:16', 1, 'Verde esmeralda', false),
(221, 32, 'ALTURA', 20.10, 20.70, 'mm', '20.10 - 20.70 mm', '2025-07-04 03:44:16', 5, NULL, true),
(222, 32, 'LARGO', 29.60, 30.10, 'mm', '29.6 -30.1 mm', '2025-07-04 03:44:16', 6, NULL, true),

-- Producto 33: Aceite de Oliva Virgen
(223, 33, 'COLOR', 0.00, 0.00, NULL, 'Amarillo', '2025-07-04 03:44:16', 1, 'Amarillo', false),
(224, 33, 'OLOR', 0.00, 0.00, NULL, 'Característico', '2025-07-04 03:44:16', 18, 'Característico', false),
(225, 33, 'SABOR', 0.00, 0.00, NULL, 'Característico', '2025-07-04 03:44:16', 19, 'Característico', false),
(226, 33, 'TEXTURA', 0.00, 0.00, NULL, 'Firme', '2025-07-04 03:44:16', 20, 'Firme', false),
(227, 33, 'INDICE DE REFRACCIÓN', 1.48, 1.49, NULL, '1.4805 - 1.4905', '2025-07-04 03:44:16', 21, NULL, true),

-- Producto 34: Ácido acético
(228, 34, 'COLOR', 0.00, 0.00, NULL, 'Incoloro', '2025-07-04 03:44:16', 1, 'Incoloro', false),
(229, 34, 'OLOR', 0.00, 0.00, NULL, 'Penetrante, picante', '2025-07-04 03:44:16', 18, 'Penetrante, picante', false),
(230, 34, 'TEXTURA', 0.00, 0.00, NULL, 'Firme', '2025-07-04 03:44:16', 20, 'Firme', false),
(231, 34, 'INDICE DE REFRACCIÓN', 1.45, 1.48, NULL, '1.4500 - 1.4800', '2025-07-04 03:44:16', 21, NULL, true),

-- Producto 35: Ácido cítrico
(232, 35, 'COLOR', 0.00, 0.00, NULL, 'Blanco', '2025-07-04 03:44:16', 1, 'Blanco', false),
(233, 35, 'OLOR', 0.00, 0.00, NULL, 'Neutro', '2025-07-04 03:44:16', 18, 'Neutro', false),
(234, 35, 'APARIENCIA', 0.00, 0.00, NULL, 'Cristales', '2025-07-04 03:44:16', 16, 'Cristales', false),
(235, 35, 'TEXTURA', 0.00, 0.00, NULL, 'Granulada', '2025-07-04 03:44:16', 20, 'Granulada', false),

-- Productos 36-65: Materias primas (resumen - incluye los más importantes)
(236, 36, 'COLOR', 0.00, 0.00, NULL, 'Rojo oscuro', '2025-07-04 03:44:16', 1, 'Rojo oscuro', false),
(237, 36, 'OLOR', 0.00, 0.00, NULL, 'Característico', '2025-07-04 03:44:16', 18, 'Característico', false),
(238, 36, 'SABOR', 0.00, 0.00, NULL, 'Picante', '2025-07-04 03:44:16', 19, 'Picante', false),
(239, 36, 'APARIENCIA', 0.00, 0.00, NULL, 'Bayas arrugadas alargadas', '2025-07-04 03:44:16', 16, 'Bayas arrugadas alargadas', false),

(240, 37, 'COLOR', 0.00, 0.00, NULL, 'Crema / blanco', '2025-07-04 03:44:16', 1, 'Crema / blanco', false),
(241, 37, 'OLOR', 0.00, 0.00, NULL, 'Característico', '2025-07-04 03:44:16', 18, 'Característico', false),
(242, 37, 'SABOR', 0.00, 0.00, NULL, 'Característico', '2025-07-04 03:44:16', 19, 'Característico', false),
(243, 37, 'LARGO', 8.00, 15.00, 'cm', '8 a 15 cm', '2025-07-04 03:44:16', 6, NULL, true),
(244, 37, 'DIÁMETRO', 250.00, 450.00, NULL, '250 - 350 / 350 - 450', '2025-07-04 03:44:16', 9, NULL, true),
(245, 37, 'TEXTURA', 0.00, 0.00, NULL, 'Firme', '2025-07-04 03:44:16', 20, 'Firme', false),

-- Producto 41: Bebida gasificada jarabeada
(259, 41, 'COLOR', 0.00, 0.00, NULL, 'Negro', '2025-07-04 03:44:16', 1, 'Negro', false),
(260, 41, 'OLOR', 0.00, 0.00, NULL, 'cola negra', '2025-07-04 03:44:16', 18, 'cola negra', false),
(261, 41, 'SABOR', 0.00, 0.00, NULL, 'cola negra', '2025-07-04 03:44:16', 19, 'cola negra', false),
(262, 41, '°Brix', 8.00, 15.00, NULL, '8 - 15', '2025-07-04 03:44:16', 22, NULL, true),
(263, 41, 'pH', 2.50, 4.00, NULL, '2.5 - 4', '2025-07-04 03:44:16', 23, NULL, true),

-- Producto 70: Regla (test product)
(381, 70, 'DISTANCIA', 20.00, 30.00, 'm', '20 - 30 m', '2025-07-14 00:31:48', 25, NULL, true),
(382, 70, 'COLOR', 0.00, 0.00, NULL, 'celeste', '2025-07-14 00:31:48', 1, 'celeste', false)

ON CONFLICT (id) DO UPDATE SET
  producto_id = EXCLUDED.producto_id,
  nombre = EXCLUDED.nombre,
  rango_min = EXCLUDED.rango_min,
  rango_max = EXCLUDED.rango_max,
  unidad = EXCLUDED.unidad,
  rango_completo = EXCLUDED.rango_completo,
  parametro_maestro_id = EXCLUDED.parametro_maestro_id,
  valor_texto = EXCLUDED.valor_texto,
  es_rango = EXCLUDED.es_rango;


-- Datos de Escaneo de Barras:
INSERT INTO public.productos_barcode (barcode, vida_util, registro_sanitario, presentacion, unidades_por_caja) VALUES
('7751234567890', '12 meses', 'RS-1234-A', 'Aceituna Verde 200g', 24),
('7750987654321', '24 meses', 'RS-5678-B', 'Aceite de Oliva Extra Virgen', 12),
('7751122334455', '18 meses', 'RS-9012-C', 'Aceituna Negra Deshuesada', 24)
ON CONFLICT (barcode) DO NOTHING;

INSERT INTO public.cajas_barcode (barcode, tipo_caja, capacidad_max) VALUES
('CAJ-998877', 'Caja Master Cartón', 24),
('CAJ-665544', 'Pack Termoencogible x6', 6)
ON CONFLICT (barcode) DO NOTHING;

-- Ajustar las secuencias
SELECT setval('usuarios_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.usuarios));
SELECT setval('parametros_maestros_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.parametros_maestros));
SELECT setval('productos_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.productos));
SELECT setval('parametros_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.parametros));
