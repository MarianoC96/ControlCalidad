import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getAppUserByAuthUid, getAllowedModules } from '@/lib/api/permissions';

/**
 * Middleware de autenticación + autorización de PÁGINAS.
 *
 * Defensa en capas:
 *  - Este middleware es el gate de ACCESO A PÁGINAS: un usuario autenticado pero
 *    sin permiso del módulo no puede cargar la página navegando a la URL.
 *  - Las rutas API siguen siendo el gate AUTORITATIVO DE DATOS (validan permiso
 *    por su cuenta). El middleware NO toca /api/* (ver matcher y guard abajo).
 *
 * La lógica de permisos se importa de @/lib/api/permissions (fuente única,
 * compartida con /api/auth/permisos), para que no se desincronice.
 */

const PUBLIC_PATHS = new Set(['/', '/olvide-password', '/restablecer-password']);

/**
 * Rutas que solo requieren sesión (sin restricción de módulo): perfil del
 * usuario y dashboard neutro. Se comprueban por igualdad exacta ANTES del
 * match por módulo, para que p.ej. /control-sistema/perfil no caiga bajo la
 * regla de /control-sistema.
 */
const SESSION_ONLY_PATHS = new Set([
    '/dashboard',
    '/perfil',
    '/control-sistema/perfil',
    '/control-calidad/perfil',
    '/escaner-codigos/perfil',
]);

/** Mapa ruta → módulo requerido. */
const PATH_TO_MODULE: Record<string, string> = {
    // Control de Sistema
    '/control-sistema': 'control-sistema',
    '/control-sistema/gestion-usuarios': 'usuarios',
    '/control-sistema/centro-solicitudes': 'solicitudes',
    '/control-sistema/auditoria-accesos': 'accesos',
    '/control-sistema/config-reporte': 'admin/config-reportes',

    // Control de Calidad
    '/control-calidad': 'control-calidad',
    '/control-calidad/registro-productos': 'registro-productos',
    '/control-calidad/historial': 'historial',
    '/control-calidad/registros-modificados': 'registros-modificados',
    '/control-calidad/historial-descargas': 'historial-descargas',
    '/control-calidad/productos': 'productos',
    '/control-calidad/parametros-maestros': 'parametros-maestros',
    '/control-calidad/centro-solicitudes': 'solicitudes',
    '/control-calidad/temporal': 'temporal',

    // Escaneo
    '/escaner-codigos': 'escaneo',
    '/escaner-codigos/escaner': 'escaneo',
    '/escaner-codigos/productos': 'escaneo-productos',
    '/escaner-codigos/cajas': 'escaneo-cajas',
    '/escaner-codigos/historial': 'escaneo-historial',
    '/escaner-codigos/centro-solicitudes': 'solicitudes',
    '/escaner-codigos/temporal': 'temporal',
};

/**
 * Resuelve el módulo de una ruta tomando la coincidencia MÁS ESPECÍFICA
 * (la clave de ruta más larga que sea igual o prefijo de segmento del
 * pathname). Así /control-sistema/gestion-usuarios resuelve a 'usuarios' y no a
 * 'control-sistema'. Devuelve null si ninguna regla aplica (solo requiere sesión).
 */
function moduleForPath(pathname: string): string | null {
    // Coincidencia exacta primero (caso más común y barato).
    if (Object.prototype.hasOwnProperty.call(PATH_TO_MODULE, pathname)) {
        return PATH_TO_MODULE[pathname];
    }

    let bestModule: string | null = null;
    let bestLength = -1;
    for (const [route, moduleKey] of Object.entries(PATH_TO_MODULE)) {
        const isSegmentPrefix = pathname === route || pathname.startsWith(route + '/');
        if (isSegmentPrefix && route.length > bestLength) {
            bestModule = moduleKey;
            bestLength = route.length;
        }
    }
    return bestModule;
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Skip static files and public paths
    if (
        pathname.startsWith('/_next/') ||
        pathname.startsWith('/favicon') ||
        pathname.includes('.') ||
        PUBLIC_PATHS.has(pathname)
    ) {
        return NextResponse.next();
    }

    // Skip API routes — tienen su propia auth (gate de datos). El middleware
    // solo gatea páginas. (El matcher ya excluye /api; esto es defensa extra.)
    if (pathname.startsWith('/api/')) {
        return NextResponse.next();
    }

    // Create a response to modify cookies on
    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Refresh the session — this is the recommended Supabase SSR pattern
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // No valid session → redirect to login
    if (!user) {
        const url = request.nextUrl.clone();
        url.pathname = '/';
        return NextResponse.redirect(url);
    }

    // Autorización por módulo (gate de páginas).
    if (!SESSION_ONLY_PATHS.has(pathname)) {
        const requiredModule = moduleForPath(pathname);

        // 'temporal' es módulo de contingencia: siempre accesible para sesiones válidas.
        if (requiredModule && requiredModule !== 'temporal') {
            const appUser = await getAppUserByAuthUid(user.id);

            // Sin perfil activo → tratar como no autenticado.
            if (!appUser) {
                const url = request.nextUrl.clone();
                url.pathname = '/';
                return NextResponse.redirect(url);
            }

            const allowedModules = await getAllowedModules(appUser);
            if (!allowedModules.includes(requiredModule)) {
                // Autenticado pero sin permiso → a página neutra (evita bucles).
                const url = request.nextUrl.clone();
                url.pathname = '/dashboard';
                return NextResponse.redirect(url);
            }
        }
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
