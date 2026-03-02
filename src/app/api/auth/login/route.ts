import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
            return NextResponse.json(
                { error: 'Usuario o contraseña incorrectos' },
                { status: 401 }
            );
        }

        // Fetch app-level user profile
        const { createServiceClient } = await import('@/lib/api/withAuth');
        const adminClient = createServiceClient();
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
