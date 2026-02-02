import { NextRequest, NextResponse } from 'next/server';
import { createApiClient } from '@/lib/supabase/api-client';
import * as OTPAuth from 'otpauth';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createApiClient();

        // Get current user from session cookies
        const responseMe = await fetch(new URL('/api/auth/me', request.url), {
            headers: { cookie: request.headers.get('cookie') || '' }
        });

        if (!responseMe.ok) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const user = await responseMe.json();

        // Generate a new secret (16 bytes = 128 bits, standard for TOTP)
        const secret = new OTPAuth.Secret({ size: 16 });
        const secretBase32 = secret.base32;

        const totp = new OTPAuth.TOTP({
            issuer: 'Control de Calidad',
            label: user.usuario,
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
            secret: secret,
        });

        const uri = totp.toString();

        return NextResponse.json({
            secret: secretBase32,
            uri: uri
        });

    } catch (error) {
        console.error('2FA setup error:', error);
        return NextResponse.json({ error: 'Error al generar configuración 2FA' }, { status: 500 });
    }
}
