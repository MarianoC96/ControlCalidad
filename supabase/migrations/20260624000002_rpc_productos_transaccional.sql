-- ============================================================================
-- OLEADA 4 · Migración 2
-- Escrituras atómicas de productos + parámetros (RPC transaccional)
-- ============================================================================
--
-- Contexto: /api/productos creaba/actualizaba el producto y luego insertaba sus
-- parámetros en pasos separados, sin transacción. En el PUT, además, borraba
-- todos los parámetros y luego insertaba: si el insert fallaba, el producto
-- quedaba SIN parámetros (pérdida de datos).
--
-- Cada función PL/pgSQL se ejecuta en una sola transacción implícita: si algo
-- lanza una excepción, TODO el cuerpo se revierte.
--
-- Formato esperado de p_parametros (jsonb array). Cada elemento:
--   {
--     "parametro_maestro_id": number|null,
--     "nombre": text,
--     "tipo": "rango"|"texto"|"numero",
--     "valor": text|null,
--     "valor_texto": text|null,
--     "es_rango": boolean,
--     "rango_min": number|null,
--     "rango_max": number|null,
--     "unidad": text|null,
--     "rango_completo": text|null
--   }
-- (El backend ya valida/whitelistea estos campos con Zod antes de llamar.)
-- ============================================================================

-- Inserta las filas de `parametros` de un producto a partir de un jsonb array.
-- Función interna reutilizada por crear/reemplazar.
CREATE OR REPLACE FUNCTION public._insert_producto_parametros(
    p_producto_id integer,
    p_parametros jsonb
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_parametros IS NULL OR jsonb_array_length(p_parametros) = 0 THEN
        RETURN;
    END IF;

    INSERT INTO public.parametros (
        producto_id, parametro_maestro_id, nombre, tipo, valor,
        es_rango, rango_min, rango_max, unidad, valor_texto, rango_completo
    )
    SELECT
        p_producto_id,
        NULLIF(elem->>'parametro_maestro_id', '')::integer,
        elem->>'nombre',
        COALESCE(elem->>'tipo', 'texto'),
        elem->>'valor',
        COALESCE((elem->>'es_rango')::boolean, false),
        NULLIF(elem->>'rango_min', '')::numeric,
        NULLIF(elem->>'rango_max', '')::numeric,
        elem->>'unidad',
        elem->>'valor_texto',
        elem->>'rango_completo'
    FROM jsonb_array_elements(p_parametros) AS elem;
END;
$$;

-- Crea un producto con sus parámetros de forma atómica. Devuelve el producto.
CREATE OR REPLACE FUNCTION public.crear_producto_con_parametros(
    p_nombre character varying,
    p_parametros jsonb DEFAULT '[]'::jsonb
) RETURNS public.productos
LANGUAGE plpgsql
AS $$
DECLARE
    v_producto public.productos;
BEGIN
    INSERT INTO public.productos (nombre)
    VALUES (p_nombre)
    RETURNING * INTO v_producto;

    PERFORM public._insert_producto_parametros(v_producto.id, p_parametros);

    RETURN v_producto;
END;
$$;

-- Actualiza el nombre y REEMPLAZA los parámetros de un producto de forma
-- atómica (borra los antiguos e inserta los nuevos en la misma transacción).
-- Devuelve el producto actualizado; lanza excepción si el id no existe.
CREATE OR REPLACE FUNCTION public.reemplazar_producto_parametros(
    p_id integer,
    p_nombre character varying,
    p_parametros jsonb DEFAULT '[]'::jsonb
) RETURNS public.productos
LANGUAGE plpgsql
AS $$
DECLARE
    v_producto public.productos;
BEGIN
    UPDATE public.productos
    SET nombre = p_nombre
    WHERE id = p_id
    RETURNING * INTO v_producto;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto % no encontrado', p_id USING ERRCODE = 'no_data_found';
    END IF;

    DELETE FROM public.parametros WHERE producto_id = p_id;
    PERFORM public._insert_producto_parametros(p_id, p_parametros);

    RETURN v_producto;
END;
$$;
