import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Supabase Auth middleware.
 *
 * Chesterton's Fence: the previous middleware checked for a `user_id` cookie
 * set manually during login. Now it validates the Supabase Auth session JWT
 * and refreshes the session automatically via updateSession pattern.
 */

const PUBLIC_PATHS = new Set(['/', '/olvide-password', '/restablecer-password']);

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

    // Skip API routes — they handle auth themselves via withAuth
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
                    cookiesToSet.forEach(({ name, value, options }) =>
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

    // The /perfil page is always accessible to authenticated users
    // Module-level permissions are checked client-side via RouteGuard
    return supabaseResponse;
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
