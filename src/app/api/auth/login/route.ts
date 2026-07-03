import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/api/withAuth';

// Rate limiting: máximo de intentos fallidos por IP+usuario en la ventana.
// WHY tabla en DB y no memoria: en serverless las variables de módulo no se
// comparten entre instancias (ver migración 20260702000001_login_rate_limit.sql).
const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

function getClientIp(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    return request.headers.get('x-real-ip') ?? 'unknown';
}

/**
 * POST /api/auth/login
 *
 * Chesterton's Fence: the previous implementation used a custom login flow
 * with bcrypt, manual cookie management, and session table inserts.
 * Now delegates entirely to Supabase Auth which handles JWT generation,
 * cookie management via @supabase/ssr, and password hashing internally.
 */
export async function POST(request: NextRequest) {
    try {
        const { usuario, password } = await request.json();

        if (!usuario || !password) {
            return NextResponse.json(
                { error: 'Usuario y contraseña son requeridos' },
                { status: 400 }
            );
        }

        if (password.includes(' ')) {
            return NextResponse.json(
                { error: 'La contraseña no puede contener espacios' },
                { status: 400 }
            );
        }

        // ── Rate limiting por IP + identificador (ventana deslizante) ──
        const ip = getClientIp(request);
        const identifier = String(usuario).trim().toLowerCase();
        const adminClient = createServiceClient();
        const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

        const { count: failedCount, error: rlError } = await adminClient
            .from('login_attempts')
            .select('id', { count: 'exact', head: true })
            .eq('ip', ip)
            .eq('identifier', identifier)
            .gte('created_at', windowStart);

        // Si el chequeo falla (p. ej. migración no aplicada) no bloqueamos el
        // login, pero lo dejamos registrado en el log del servidor.
        if (rlError) {
            console.error('Login rate-limit check failed:', rlError);
        } else if ((failedCount ?? 0) >= MAX_FAILED_ATTEMPTS) {
            // Mensaje genérico: no filtra si el usuario existe ni el motivo exacto.
            return NextResponse.json(
                { error: 'Demasiados intentos. Intentá de nuevo más tarde.' },
                { status: 429 }
            );
        }

        const supabase = await createClient();

        // All users authenticate via the internal email convention:
        // username → username@controlcalidad.local
        // WHY: Supabase Auth requires an email, but our users only know their username.
        // The email is auto-generated and never shown to the user.
        const emailForAuth = `${usuario.trim().toLowerCase()}@controlcalidad.local`;

        const { data, error } = await supabase.auth.signInWithPassword({
            email: emailForAuth,
            password,
        });

        if (error || !data.user) {
            // Registrar intento fallido + limpieza oportunista de intentos viejos.
            await Promise.all([
                adminClient.from('login_attempts').insert({ ip, identifier }),
                adminClient.rpc('prune_login_attempts'),
            ]).catch((e) => console.error('Login rate-limit record failed:', e));

            return NextResponse.json(
                { error: 'Usuario o contraseña incorrectos' },
                { status: 401 }
            );
        }

        // Fetch app-level user profile
        const { data: appUser } = await adminClient
            .from('usuarios')
            .select('id, nombre_completo, usuario, roles')
            .eq('auth_uid', data.user.id)
            .eq('activo', true)
            .eq('is_deleted', false)
            .single();

        if (!appUser) {
            // Auth user exists but no app profile — sign out and reject
            await supabase.auth.signOut();
            return NextResponse.json(
                { error: 'Usuario no encontrado en el sistema' },
                { status: 401 }
            );
        }

        // Login exitoso: resetear el contador de la clave.
        await adminClient
            .from('login_attempts')
            .delete()
            .eq('ip', ip)
            .eq('identifier', identifier);

        return NextResponse.json({
            success: true,
            user: {
                id: appUser.id,
                nombre_completo: appUser.nombre_completo,
                usuario: appUser.usuario,
                roles: appUser.roles,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
