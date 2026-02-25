import { NextRequest, NextResponse } from 'next/server';

// Map URL paths to module keys
const PATH_TO_MODULE: Record<string, string> = {
    '/registro-productos': 'registro-productos',
    '/historial': 'historial',
    '/historial-descargas': 'historial-descargas',
    '/solicitudes': 'solicitudes',
    '/productos': 'productos',
    '/parametros-maestros': 'parametros-maestros',
    '/usuarios': 'usuarios',
    '/admin/config-pdf': 'admin/config-pdf',
    '/accesos': 'accesos',
    '/temporal': 'temporal',
};

// Public paths that don't need auth
const PUBLIC_PATHS = ['/', '/olvide-password', '/restablecer-password'];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Skip API routes, static files, and public paths  
    if (
        pathname.startsWith('/api/') ||
        pathname.startsWith('/_next/') ||
        pathname.startsWith('/favicon') ||
        pathname.includes('.') ||
        PUBLIC_PATHS.includes(pathname)
    ) {
        return NextResponse.next();
    }

    // Check authentication
    const userId = request.cookies.get('user_id')?.value;
    if (!userId) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    // The /perfil page is always accessible to authenticated users
    if (pathname === '/perfil') {
        return NextResponse.next();
    }

    // For module paths, we only do a server-side redirect for unauthenticated users.
    // The actual module permission check happens client-side via the permisos API
    // and in each API route's backend validation.
    // This middleware ensures basic auth and prevents non-logged-in access.

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - api routes
         * - _next/static (static files)
         * - _next/image (image optimization)
         * - favicon.ico
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
