-- Fin de la deuda "doble store bcrypt": la contraseña vive SOLO en Supabase
-- Auth. usuarios.password era un hash duplicado que se desincronizaba del
-- password real (la re-auth de lock/edit/escáner rechazaba contraseñas
-- correctas). Toda la re-auth ahora usa signInWithPassword (lib/api/reauth.ts)
-- y ningún código lee ni escribe esta columna.
ALTER TABLE usuarios DROP COLUMN IF EXISTS password;
