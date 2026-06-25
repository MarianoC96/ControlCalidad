-- ============================================================================
-- OLEADA 4 · Migración 3
-- Alta atómica de registro + sus controles (RPC transaccional)
-- ============================================================================
--
-- Contexto: /api/registros (POST) insertaba el registro y luego sus controles
-- en pasos separados. Si el insert de controles fallaba, quedaba un registro
-- huérfano sin controles.
--
-- Formato esperado:
--   p_registro  jsonb  → campos del registro (whitelist explícito abajo)
--   p_controles jsonb  → array de controles, cada uno:
--     { "parametro_nombre", "rango_completo", "valor_control"(num|null),
--       "texto_control", "parametro_tipo", "observacion", "fuera_de_rango"(bool) }
--
-- Devuelve el id del registro creado.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.crear_registro_con_controles(
    p_registro jsonb,
    p_controles jsonb DEFAULT '[]'::jsonb
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_registro_id integer;
BEGIN
    INSERT INTO public.registros (
        lote_interno, lote_producto, guia, marca, cantidad,
        producto_id, producto_nombre, observaciones_generales,
        verificado_por, usuario_nombre, usuario_id,
        pdf_titulo, pdf_codigo, pdf_edicion, pdf_aprobado_por,
        es_offline, fecha_registro, fecha_sincronizacion
    )
    VALUES (
        p_registro->>'lote_interno',
        p_registro->>'lote_producto',
        p_registro->>'guia',
        p_registro->>'marca',
        NULLIF(p_registro->>'cantidad', '')::integer,
        NULLIF(p_registro->>'producto_id', '')::integer,
        p_registro->>'producto_nombre',
        p_registro->>'observaciones_generales',
        p_registro->>'verificado_por',
        p_registro->>'usuario_nombre',
        NULLIF(p_registro->>'usuario_id', '')::integer,
        p_registro->>'pdf_titulo',
        p_registro->>'pdf_codigo',
        p_registro->>'pdf_edicion',
        p_registro->>'pdf_aprobado_por',
        COALESCE((p_registro->>'es_offline')::boolean, false),
        COALESCE(NULLIF(p_registro->>'fecha_registro', '')::timestamptz, now()),
        NULLIF(p_registro->>'fecha_sincronizacion', '')::timestamptz
    )
    RETURNING id INTO v_registro_id;

    IF p_controles IS NOT NULL AND jsonb_array_length(p_controles) > 0 THEN
        INSERT INTO public.controles (
            registro_id, parametro_nombre, rango_completo, valor_control,
            texto_control, parametro_tipo, observacion, fuera_de_rango
        )
        SELECT
            v_registro_id,
            elem->>'parametro_nombre',
            elem->>'rango_completo',
            NULLIF(elem->>'valor_control', '')::numeric,
            elem->>'texto_control',
            elem->>'parametro_tipo',
            elem->>'observacion',
            COALESCE((elem->>'fuera_de_rango')::boolean, false)
        FROM jsonb_array_elements(p_controles) AS elem;
    END IF;

    RETURN v_registro_id;
END;
$$;
