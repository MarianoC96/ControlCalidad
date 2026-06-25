-- ============================================================================
-- OLEADA 4 · Migración 1
-- Dedupe garantizado en sincronización offline: UNIQUE(local_uuid)
-- ============================================================================
--
-- Contexto: /api/temporal/sync hacía un SELECT-then-INSERT para evitar
-- duplicados. Eso es una carrera (TOCTOU): dos sincronizaciones simultáneas del
-- mismo dispositivo (reintento de red) pueden insertar el mismo local_uuid dos
-- veces. La garantía real debe vivir en la BD.
--
-- NOTA DE DERIVA DE ESQUEMA: la tabla `registros_temporales` se creó
-- directamente en Supabase y NO está en el esquema versionado. Esta migración
-- asume que existe con una columna `local_uuid` (text) y PK `id`. Revisar antes
-- de aplicar.
--
-- IMPORTANTE: ejecutar la limpieza de duplicados ANTES de crear el índice; si
-- ya hay duplicados, la creación del UNIQUE fallaría.
-- ============================================================================

-- 1) Limpieza de duplicados existentes.
--    Conserva la fila con el id más bajo por cada local_uuid y elimina el resto.
--    (Las filas con local_uuid NULL no se tocan: NULL no cuenta como duplicado.)
DELETE FROM public.registros_temporales a
USING public.registros_temporales b
WHERE a.local_uuid IS NOT NULL
  AND a.local_uuid = b.local_uuid
  AND a.id > b.id;

-- 2) Restricción única (idempotente).
--    UNIQUE permite múltiples NULL en Postgres, por lo que no rompe filas sin uuid.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'registros_temporales_local_uuid_key'
    ) THEN
        ALTER TABLE public.registros_temporales
            ADD CONSTRAINT registros_temporales_local_uuid_key UNIQUE (local_uuid);
    END IF;
END $$;
