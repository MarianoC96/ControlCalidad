-- Unifica las claves casi duplicadas de role_permisos:
--   'historial-descargas'          → la clave FUNCIONAL (RouteGuard, middleware,
--                                    Navbar y acceso mínimo la consumen)
--   'historial-descargas-masivas'  → huérfana: solo existía en catálogos y en la
--                                    UI de accesos (donde encima se mostraba EN
--                                    LUGAR de la real: togglearla no cambiaba el
--                                    acceso efectivo a la página).
-- El código deja de listar la clave huérfana; acá se fusiona el dato histórico.

-- 1. Si un rol tenía habilitada la huérfana pero no la real, heredar el permiso
--    (criterio: conservar el acceso que el admin creyó otorgar en la UI).
UPDATE role_permisos rp
SET habilitado = true
WHERE rp.modulo_key = 'historial-descargas'
  AND rp.habilitado = false
  AND EXISTS (
      SELECT 1 FROM role_permisos v
      WHERE v.role_id = rp.role_id
        AND v.modulo_key = 'historial-descargas-masivas'
        AND v.habilitado = true
  );

-- 2. Roles que solo tienen la huérfana: renombrarla a la clave real.
UPDATE role_permisos rp
SET modulo_key = 'historial-descargas'
WHERE rp.modulo_key = 'historial-descargas-masivas'
  AND NOT EXISTS (
      SELECT 1 FROM role_permisos v
      WHERE v.role_id = rp.role_id
        AND v.modulo_key = 'historial-descargas'
  );

-- 3. Eliminar las filas restantes de la clave huérfana.
DELETE FROM role_permisos WHERE modulo_key = 'historial-descargas-masivas';
