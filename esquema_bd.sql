-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.configuracion_pdf (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  titulo text NOT NULL,
  codigo text NOT NULL,
  edicion text NOT NULL,
  aprobado_por text NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT configuracion_pdf_pkey PRIMARY KEY (id)
);
CREATE TABLE public.controles (
  id integer NOT NULL DEFAULT nextval('controles_id_seq'::regclass),
  registro_id integer NOT NULL,
  parametro_nombre character varying NOT NULL,
  rango_completo text NOT NULL,
  valor_control numeric,
  texto_control character varying,
  parametro_tipo character varying,
  observacion text,
  fuera_de_rango boolean DEFAULT false,
  mensaje_alerta text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT controles_pkey PRIMARY KEY (id),
  CONSTRAINT controles_registro_id_fkey FOREIGN KEY (registro_id) REFERENCES public.registros(id)
);
CREATE TABLE public.download_history (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id bigint NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_files integer DEFAULT 0,
  zip_name text,
  zip_path text,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'ready'::text, 'error'::text])),
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT download_history_pkey PRIMARY KEY (id),
  CONSTRAINT download_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.usuarios(id)
);
CREATE TABLE public.fotos (
  id integer NOT NULL DEFAULT nextval('fotos_id_seq'::regclass),
  registro_id integer NOT NULL,
  datos_base64 text NOT NULL,
  descripcion character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT fotos_pkey PRIMARY KEY (id),
  CONSTRAINT fotos_registro_id_fkey FOREIGN KEY (registro_id) REFERENCES public.registros(id)
);
CREATE TABLE public.history_edits (
  id integer NOT NULL DEFAULT nextval('history_edits_id_seq'::regclass),
  registro_id integer NOT NULL,
  edited_by integer NOT NULL,
  role text NOT NULL,
  action text NOT NULL,
  photos_added jsonb,
  created_at timestamp with time zone DEFAULT now(),
  photos_deleted jsonb,
  CONSTRAINT history_edits_pkey PRIMARY KEY (id),
  CONSTRAINT history_edits_registro_id_fkey FOREIGN KEY (registro_id) REFERENCES public.registros(id),
  CONSTRAINT history_edits_edited_by_fkey FOREIGN KEY (edited_by) REFERENCES public.usuarios(id)
);
CREATE TABLE public.parametros (
  id integer NOT NULL DEFAULT nextval('parametros_id_seq'::regclass),
  producto_id integer NOT NULL,
  parametro_maestro_id integer,
  nombre character varying NOT NULL,
  tipo character varying DEFAULT 'texto'::character varying CHECK (tipo::text = ANY (ARRAY['texto'::character varying, 'numero'::character varying, 'rango'::character varying]::text[])),
  valor character varying,
  rango_min numeric,
  rango_max numeric,
  unidad character varying,
  created_at timestamp with time zone DEFAULT now(),
  valor_texto text,
  es_rango boolean DEFAULT false,
  rango_completo text,
  CONSTRAINT parametros_pkey PRIMARY KEY (id),
  CONSTRAINT parametros_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id),
  CONSTRAINT parametros_parametro_maestro_id_fkey FOREIGN KEY (parametro_maestro_id) REFERENCES public.parametros_maestros(id)
);
CREATE TABLE public.parametros_maestros (
  id integer NOT NULL DEFAULT nextval('parametros_maestros_id_seq'::regclass),
  nombre character varying NOT NULL UNIQUE,
  tipo character varying NOT NULL DEFAULT 'texto'::character varying CHECK (tipo::text = ANY (ARRAY['texto'::character varying, 'numero'::character varying, 'rango'::character varying]::text[])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT parametros_maestros_pkey PRIMARY KEY (id)
);
CREATE TABLE public.password_resets (
  id integer NOT NULL DEFAULT nextval('password_resets_id_seq'::regclass),
  user_id integer NOT NULL,
  token character varying NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT password_resets_pkey PRIMARY KEY (id),
  CONSTRAINT password_resets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.usuarios(id)
);
CREATE TABLE public.productos (
  id integer NOT NULL DEFAULT nextval('productos_id_seq'::regclass),
  nombre character varying NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT productos_pkey PRIMARY KEY (id)
);
CREATE TABLE public.registros (
  id integer NOT NULL DEFAULT nextval('registros_id_seq'::regclass),
  lote_interno character varying NOT NULL,
  guia character varying,
  cantidad integer NOT NULL,
  producto_id integer NOT NULL,
  producto_nombre character varying NOT NULL,
  usuario_id integer NOT NULL,
  usuario_nombre character varying NOT NULL,
  observaciones_generales text,
  verificado_por character varying,
  fecha_registro timestamp with time zone DEFAULT now(),
  pdf_titulo text,
  pdf_codigo text,
  pdf_edicion text,
  pdf_aprobado_por text,
  lote_producto text,
  marca text,
  edit_started_at timestamp with time zone,
  edit_expires_at timestamp with time zone,
  edit_started_by integer,
  CONSTRAINT registros_pkey PRIMARY KEY (id),
  CONSTRAINT registros_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id),
  CONSTRAINT registros_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id),
  CONSTRAINT registros_edit_started_by_fkey FOREIGN KEY (edit_started_by) REFERENCES public.usuarios(id)
);
CREATE TABLE public.sesiones (
  id character varying NOT NULL,
  usuario_id integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval),
  CONSTRAINT sesiones_pkey PRIMARY KEY (id),
  CONSTRAINT sesiones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
);
CREATE TABLE public.usuarios (
  id integer NOT NULL DEFAULT nextval('usuarios_id_seq'::regclass),
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
  CONSTRAINT usuarios_pkey PRIMARY KEY (id)
);