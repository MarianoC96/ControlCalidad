import { NextRequest, NextResponse } from 'next/server';
import { createApiClient } from '@/lib/supabase/api-client';
import { cookies } from 'next/headers';
import * as OTPAuth from 'otpauth';

export async function POST(request: NextRequest) {
    try {
        const { userId, code } = await request.json();

        if (!userId || !code) {
            return NextResponse.json(
                { error: 'ID de usuario y código son requeridos' },
                { status: 400 }
            );
        }

        const supabase = await createApiClient();

        // Get user with 2FA secret
        const { data: user, error } = await supabase
            .from('usuarios')
            .select('*')
            .eq('id', userId)
            .single();

        if (error || !user) {
            return NextResponse.json(
                { error: 'Usuario no encontrado' },
                { status: 404 }
            );
        }

        if (!user.two_factor_secret) {
            return NextResponse.json(
                { error: '2FA no está configurado para este usuario' },
                { status: 400 }
            );
        }

        // Verify TOTP code
        const totp = new OTPAuth.TOTP({
            issuer: 'Control de Calidad',
            label: user.usuario,
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
            secret: OTPAuth.Secret.fromBase32(user.two_factor_secret),
        });

        const isValid = totp.validate({ token: code, window: 1 }) !== null;

        if (!isValid) {
            return NextResponse.json(
                { error: 'Código de verificación inválido' },
                { status: 401 }
            );
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
        console.error('2FA verification error:', error);
        return NextResponse.json(
            { error: 'Error al verificar código' },
            { status: 500 }
        );
    }
}
