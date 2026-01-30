-- Run this SQL in your Supabase SQL Editor to enable PDF History Snapshotting

ALTER TABLE public.registros
ADD COLUMN IF NOT EXISTS pdf_titulo TEXT,
ADD COLUMN IF NOT EXISTS pdf_codigo TEXT,
ADD COLUMN IF NOT EXISTS pdf_edicion TEXT,
ADD COLUMN IF NOT EXISTS pdf_aprobado_por TEXT;
