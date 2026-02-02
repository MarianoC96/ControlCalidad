import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-client';
import * as OTPAuth from 'otpauth';

export async function POST(request: NextRequest) {
    try {
        const { secret, code } = await request.json();

        if (!secret || !code) {
            return NextResponse.json({ error: 'Secreto y código son requeridos' }, { status: 400 });
        }

        const supabase = createAdminClient();

        // Get current user
        const responseMe = await fetch(new URL('/api/auth/me', request.url), {
            headers: { cookie: request.headers.get('cookie') || '' }
        });

        if (!responseMe.ok) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const user = await responseMe.json();

        // Verify the code
        const totp = new OTPAuth.TOTP({
            issuer: 'Control de Calidad',
            label: user.usuario,
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
            secret: OTPAuth.Secret.fromBase32(secret),
        });

        const isValid = totp.validate({ token: code, window: 2 }) !== null;

        if (!isValid) {
            // Log for debugging if needed, but for now just return clear error
            return NextResponse.json({ error: 'Código inválido o expirado. Asegúrate de que el reloj de tu móvil esté en automático.' }, { status: 401 });
        }

        // Save the encrypted secret to the database
        const { encryptSecret } = await import('@/lib/utils');
        const encryptedSecret = encryptSecret(secret);

        const { error: updateError } = await supabase
            .from('usuarios')
            .update({ two_factor_secret: encryptedSecret })
            .eq('id', user.id);

        if (updateError) {
            throw updateError;
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('2FA activation error:', error);
        return NextResponse.json({ error: 'Error al activar 2FA' }, { status: 500 });
    }
}
