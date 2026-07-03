-- Rate limiting de login por IP + identificador (ventana deslizante).
-- WHY tabla y no memoria: en serverless cada invocación puede caer en una
-- instancia distinta; las variables de módulo no se comparten. La tabla es
-- la fuente compartida y portable.

CREATE TABLE IF NOT EXISTS login_attempts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ip TEXT NOT NULL,
    identifier TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para el conteo por clave dentro de la ventana.
CREATE INDEX IF NOT EXISTS idx_login_attempts_key_time
    ON login_attempts (ip, identifier, created_at DESC);

-- Solo el service role opera sobre esta tabla (RLS sin políticas bloquea
-- anon/authenticated; el service role la bypasea).
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- Limpieza oportunista de intentos viejos (se invoca desde la API en cada
-- login fallido; evita crecimiento indefinido sin necesitar cron).
CREATE OR REPLACE FUNCTION prune_login_attempts(p_older_than_minutes INT DEFAULT 60)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    DELETE FROM login_attempts
    WHERE created_at < now() - make_interval(mins => p_older_than_minutes);
$$;

REVOKE ALL ON FUNCTION prune_login_attempts(INT) FROM PUBLIC, anon, authenticated;
