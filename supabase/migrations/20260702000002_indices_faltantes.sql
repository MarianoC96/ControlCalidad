-- Índices faltantes detectados en la auditoría de escala 2026-07-02.

-- usuarios.auth_uid se consulta en CADA request autenticado
-- (withAuth.ts: withAuth y getAuthUserId). UNIQUE además refleja el
-- invariante 1:1 con Supabase Auth (varios NULL permitidos: usuarios
-- soft-deleted quedan con auth_uid = NULL).
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_auth_uid
    ON usuarios (auth_uid);

-- download_history: filtrado por dueño (downloads/history) y por estado
-- (downloads/process).
CREATE INDEX IF NOT EXISTS idx_download_history_user_id
    ON download_history (user_id);

CREATE INDEX IF NOT EXISTS idx_download_history_status
    ON download_history (status);
