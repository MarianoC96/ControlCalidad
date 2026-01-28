import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'; // Use admin client directly
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
    try {
        const { usuario, password } = await request.json();

        if (!usuario || !password) {
            return NextResponse.json(
                { error: 'Usuario y contraseña son requeridos' },
                { status: 400 }
            );
        }

        // Use SERVICE_ROLE_KEY to bypass RLS for authentication check
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );

        // Get user from database
        const { data: user, error } = await supabase
            .from('usuarios')
            .select('*')
            // Search by username OR email
            .or(`usuario.eq.${usuario},email.eq.${usuario}`)
            .eq('activo', true)
            .single();

        if (error || !user) {
            return NextResponse.json(
                { error: 'Usuario o contraseña incorrectos' },
                { status: 401 }
            );
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            return NextResponse.json(
                { error: 'Usuario o contraseña incorrectos' },
                { status: 401 }
            );
        }

        // Check if 2FA is enabled
        if (user.two_factor_secret) {
            return NextResponse.json({
                requires2FA: true,
                userId: user.id,
            });
        }

        // Create session
        const sessionId = crypto.randomUUID();
        const cookieStore = await cookies();

        cookieStore.set('session_id', sessionId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24,
            path: '/',
        });

        cookieStore.set('user_id', user.id.toString(), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24,
            path: '/',
        });

        cookieStore.set('user_name', user.nombre_completo, {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24,
            path: '/',
        });

        cookieStore.set('user_role', user.roles, {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24,
            path: '/',
        });

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                nombre_completo: user.nombre_completo,
                usuario: user.usuario,
                roles: user.roles,
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
