-- ============================================================================
-- OLEADA 4 · Migración 4
-- Guardado atómico de la edición de un registro (RPC transaccional)
-- ============================================================================
--
-- Contexto: /api/registros/edit aplicaba en paralelo (Promise.all, SIN
-- transacción): update de campos, borrado/inserción de fotos, log de historial,
-- liberación del lock y marcado de la solicitud como "usado". Si una operación
-- fallaba, el resto ya se había aplicado → estado parcial inconsistente.
--
-- Esta función ejecuta todo en una sola transacción. Además REVALIDA dentro de
-- la transacción que el lock siga perteneciendo al usuario y no haya expirado
-- (cierra la ventana de carrera entre la validación del route y la escritura).
--
-- NOTA DE DERIVA DE ESQUEMA: `history_edits.field_changes` (jsonb) existe en la
-- BD real pero NO en el esquema versionado. Esta función la usa; verificar que
-- la columna exista antes de aplicar.
--
-- Parámetros:
--   p_registro_id        integer
--   p_user_id            integer  (dueño del lock; autor de la edición)
--   p_role               text
--   p_update_fields      jsonb    (whitelist: lote_interno, lote_producto,
--                                  guia, marca, cantidad; solo se aplican las
--                                  claves presentes)
--   p_photos_to_delete   bigint[] (ids de fotos a borrar; '{}' si ninguna)
--   p_new_photos         jsonb    (array de { "data", "description" })
--   p_action             text
--   p_photos_added       jsonb
--   p_photos_deleted     jsonb
--   p_field_changes      jsonb
--   p_approved_request_id integer (nullable; si viene, se marca 'usado')
-- ============================================================================

CREATE OR REPLACE FUNCTION public.guardar_edicion_registro(
    p_registro_id integer,
    p_user_id integer,
    p_role text,
    p_update_fields jsonb DEFAULT '{}'::jsonb,
    p_photos_to_delete bigint[] DEFAULT '{}'::bigint[],
    p_new_photos jsonb DEFAULT '[]'::jsonb,
    p_action text DEFAULT 'edit',
    p_photos_added jsonb DEFAULT NULL,
    p_photos_deleted jsonb DEFAULT NULL,
    p_field_changes jsonb DEFAULT NULL,
    p_approved_request_id integer DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- 0) Revalidar el lock dentro de la transacción (defensa contra carrera).
    PERFORM 1
    FROM public.registros
    WHERE id = p_registro_id
      AND edit_started_by = p_user_id
      AND (edit_expires_at IS NULL OR edit_expires_at > now());

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El bloqueo de edición no es válido o ha expirado'
            USING ERRCODE = 'P0001';
    END IF;

    -- 1) Aplicar cambios de campos (solo claves presentes) + liberar el lock.
    UPDATE public.registros
    SET
        lote_interno  = CASE WHEN p_update_fields ? 'lote_interno'
                             THEN p_update_fields->>'lote_interno' ELSE lote_interno END,
        lote_producto = CASE WHEN p_update_fields ? 'lote_producto'
                             THEN p_update_fields->>'lote_producto' ELSE lote_producto END,
        guia          = CASE WHEN p_update_fields ? 'guia'
                             THEN p_update_fields->>'guia' ELSE guia END,
        marca         = CASE WHEN p_update_fields ? 'marca'
                             THEN p_update_fields->>'marca' ELSE marca END,
        cantidad      = CASE WHEN p_update_fields ? 'cantidad'
                             THEN (p_update_fields->>'cantidad')::integer ELSE cantidad END,
        edit_started_at = NULL,
        edit_expires_at = NULL,
        edit_started_by = NULL
    WHERE id = p_registro_id;

    -- 2) Borrar fotos marcadas (solo las del propio registro).
    IF p_photos_to_delete IS NOT NULL AND array_length(p_photos_to_delete, 1) > 0 THEN
        DELETE FROM public.fotos
        WHERE id = ANY(p_photos_to_delete)
          AND registro_id = p_registro_id;
    END IF;

    -- 3) Insertar fotos nuevas.
    IF p_new_photos IS NOT NULL AND jsonb_array_length(p_new_photos) > 0 THEN
        INSERT INTO public.fotos (registro_id, datos_base64, descripcion)
        SELECT
            p_registro_id,
            elem->>'data',
            COALESCE(elem->>'description', 'Foto agregada en edición')
        FROM jsonb_array_elements(p_new_photos) AS elem;
    END IF;

    -- 4) Log de historial.
    INSERT INTO public.history_edits (
        registro_id, edited_by, role, action,
        photos_added, photos_deleted, field_changes
    )
    VALUES (
        p_registro_id, p_user_id, p_role, p_action,
        p_photos_added, p_photos_deleted, p_field_changes
    );

    -- 5) Marcar la solicitud aprobada como usada (si aplica).
    IF p_approved_request_id IS NOT NULL THEN
        UPDATE public.edit_requests
        SET status = 'usado', resolved_at = now()
        WHERE id = p_approved_request_id;
    END IF;
END;
$$;
