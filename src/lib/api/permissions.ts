import { createServiceClient } from '@/lib/supabase/admin-client';

/**
 * Fuente única de verdad para autorización por rol/módulo.
 *
 * Tanto el middleware (gate de acceso a páginas) como las rutas API (gate
 * autoritativo de datos) deben usar estas funciones, de modo que la lógica de
 * permisos no pueda desincronizarse entre ambos.
 */

/** Catálogo completo de módulos del sistema. */
export const ALL_MODULES = [
    'registro-productos',
    'historial',
    'registros-modificados',
    'historial-descargas',
    'solicitudes',
    'productos',
    'parametros-maestros',
    'usuarios',
    'admin/config-pdf',
    'admin/config-reportes',
    'accesos',
    'control-sistema',
    'control-calidad',
    'escaneo',
    'escaneo-productos',
    'escaneo-cajas',
    'escaneo-historial',
    'escaneo-central',
    'temporal',
] as const;

/**
 * Acceso mínimo para un usuario autenticado sin role_id asignado.
 * Coincide con el comportamiento de /api/auth/permisos.
 */
const MINIMAL_MODULES = [
    'registro-productos',
    'historial',
    'registros-modificados',
    'historial-descargas',
    'temporal',
];

/** 'temporal' es un módulo de contingencia: siempre disponible. */
const ALWAYS_AVAILABLE_MODULE = 'temporal';

export interface PermissionUser {
    readonly id: number;
    readonly usuario: string;
    readonly roles: string | null;
    readonly role_id: number | null;
}

const USER_COLUMNS = 'id, usuario, roles, role_id';

/** Busca el perfil de aplicación activo a partir del UID de Supabase Auth. */
export async function getAppUserByAuthUid(authUid: string): Promise<PermissionUser | null> {
    const supabase = createServiceClient();
    const { data } = await supabase
        .from('usuarios')
        .select(USER_COLUMNS)
        .eq('auth_uid', authUid)
        .eq('activo', true)
        .eq('is_deleted', false)
        .single();

    return (data as PermissionUser) ?? null;
}

/** Busca el perfil de aplicación activo a partir del id local de usuario. */
export async function getAppUserById(userId: number): Promise<PermissionUser | null> {
    if (!Number.isInteger(userId) || userId <= 0) return null;

    const supabase = createServiceClient();
    const { data } = await supabase
        .from('usuarios')
        .select(USER_COLUMNS)
        .eq('id', userId)
        .eq('activo', true)
        .eq('is_deleted', false)
        .single();

    return (data as PermissionUser) ?? null;
}

/**
 * Devuelve la lista de módulos permitidos para el usuario.
 * Lógica idéntica a /api/auth/permisos (misma fuente, no se desincroniza).
 */
export async function getAllowedModules(user: PermissionUser): Promise<string[]> {
    if (user.usuario === 'sadmin') {
        return [...ALL_MODULES];
    }

    if (!user.role_id) {
        return [...MINIMAL_MODULES];
    }

    const supabase = createServiceClient();
    const { data } = await supabase
        .from('role_permisos')
        .select('modulo_key')
        .eq('role_id', user.role_id)
        .eq('habilitado', true);

    const allowed = (data ?? []).map((p: { modulo_key: string }) => p.modulo_key);
    if (!allowed.includes(ALWAYS_AVAILABLE_MODULE)) {
        allowed.push(ALWAYS_AVAILABLE_MODULE);
    }
    return allowed;
}

/**
 * Comprueba si el usuario tiene permiso sobre un módulo concreto.
 * Misma semántica que los antiguos canManageUsers/canManageRoles.
 *
 * DEUDA (#N11): el fallback `roles === 'administrador'` es el criterio doble
 * legacy. Se mantiene para no romper a los admins actuales, pero DEBE eliminarse
 * una vez que todos los usuarios tengan role_id y sus permisos vivan en
 * role_permisos. Ver [[leccion-seguridad-autorizacion-backend]].
 */
export async function userHasModule(user: PermissionUser, moduleKey: string): Promise<boolean> {
    if (user.usuario === 'sadmin') return true;

    if (user.role_id) {
        const supabase = createServiceClient();
        const { data } = await supabase
            .from('role_permisos')
            .select('habilitado')
            .eq('role_id', user.role_id)
            .eq('modulo_key', moduleKey)
            .eq('habilitado', true)
            .maybeSingle();

        if (data?.habilitado) return true;
    }

    // DEUDA legacy (ver nota arriba).
    return user.roles === 'administrador';
}
