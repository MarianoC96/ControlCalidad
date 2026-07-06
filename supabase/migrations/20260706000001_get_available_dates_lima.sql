-- Versiona get_available_dates (antes solo existía en la BD, sin fuente en el
-- repo) y corrige el agrupamiento de fechas al huso de Perú: agrupar en UTC
-- corría los registros de 19:00-23:59 hora Lima al día/mes siguiente en los
-- filtros de año/mes del historial.
--
-- Contrato (igual que la versión anterior, consumida por /api/registros):
--   { "years": [desc], "months_by_year": { "<año>": [meses 0-based asc] } }
DROP FUNCTION IF EXISTS get_available_dates();

CREATE FUNCTION get_available_dates()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH fechas AS (
    SELECT DISTINCT
        EXTRACT(YEAR FROM (fecha_registro AT TIME ZONE 'America/Lima'))::int AS y,
        (EXTRACT(MONTH FROM (fecha_registro AT TIME ZONE 'America/Lima'))::int - 1) AS m
    FROM registros
)
SELECT json_build_object(
    'years',
    COALESCE((SELECT json_agg(y ORDER BY y DESC) FROM (SELECT DISTINCT y FROM fechas) ys), '[]'::json),
    'months_by_year',
    COALESCE((
        SELECT json_object_agg(y::text, months)
        FROM (SELECT y, json_agg(m ORDER BY m) AS months FROM fechas GROUP BY y) t
    ), '{}'::json)
);
$$;
