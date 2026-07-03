-- Índices faltantes detectados en la auditoría de escala 2026-07-02.

-- Verificación defensiva: si ya existen auth_uid no-NULL duplicados (deriva
-- histórica de datos), fallar con un mensaje explícito en vez de un error
-- opaco del CREATE UNIQUE INDEX.
DO $$
DECLARE dup_count int;
BEGIN
    SELECT count(*) INTO dup_count FROM (
        SELECT auth_uid FROM usuarios WHERE auth_uid IS NOT NULL
        GROUP BY auth_uid HAVING count(*) > 1
    ) t;
    IF dup_count > 0 THEN
        RAISE EXCEPTION 'usuarios.auth_uid con % valor(es) duplicado(s); resolver antes de crear el índice único', dup_count;
    END IF;
END $$;

-- usuarios.auth_uid se consulta en CADA request autenticado
-- (withAuth.ts: withAuth, getAuthUserId y getAuthProfile). UNIQUE además
-- refleja el invariante 1:1 con Supabase Auth (varios NULL permitidos:
-- usuarios soft-deleted quedan con auth_uid = NULL).
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_auth_uid
    ON usuarios (auth_uid);

-- download_history (downloads/history): no-admin filtra por dueño y ordena
-- por fecha; admin solo ordena por fecha.
CREATE INDEX IF NOT EXISTS idx_download_history_user_created
    ON download_history (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_download_history_created_at
    ON download_history (created_at DESC);

-- status tiene baja cardinalidad: un índice completo es de utilidad marginal.
-- Parcial sobre 'pending' (los estados transitorios son pocos frente al
-- histórico) para futuros workers/monitoreo de cola.
CREATE INDEX IF NOT EXISTS idx_download_history_pending
    ON download_history (created_at) WHERE status = 'pending';

-- GET /api/productos ordena por nombre con limit; sin índice el sort es
-- completo a medida que crece el catálogo.
CREATE INDEX IF NOT EXISTS idx_productos_nombre
    ON productos (nombre);
