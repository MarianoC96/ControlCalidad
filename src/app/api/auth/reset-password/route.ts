import { NextRequest, NextResponse } from 'next/server';
import { createApiClient } from '@/lib/supabase/api-client';
import { hashPassword } from '@/lib/utils';

/**
 * POST /api/auth/reset-password
 * Resets password using a valid token
 */
export async function POST(request: NextRequest) {
    const supabase = await createApiClient();

    const body = await request.json();
    const { token, newPassword } = body;

    if (!token || !newPassword) {
        return NextResponse.json(
            { error: 'Token y nueva contraseña son requeridos' },
            { status: 400 }
        );
    }

    if (newPassword.length < 6) {
        return NextResponse.json(
            { error: 'La contraseña debe tener al menos 6 caracteres' },
            { status: 400 }
        );
    }

    // Verify token is valid and not expired
    const { data: resetRecord } = await supabase
        .from('password_resets')
        .select('usuario_id, expires_at')
        .eq('token', token)
        .single();

    if (!resetRecord) {
        return NextResponse.json(
            { error: 'Token inválido o expirado' },
            { status: 400 }
        );
    }

    // Check if token has expired
    if (new Date(resetRecord.expires_at) < new Date()) {
        // Delete expired token
        await supabase
            .from('password_resets')
            .delete()
            .eq('token', token);

        return NextResponse.json(
            { error: 'El token ha expirado. Solicita un nuevo enlace.' },
            { status: 400 }
        );
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update user password
    const { error: updateError } = await supabase
        .from('usuarios')
        .update({ password: hashedPassword })
        .eq('id', resetRecord.usuario_id);

    if (updateError) {
        console.error('Error updating password:', updateError);
        return NextResponse.json(
            { error: 'Error al actualizar la contraseña' },
            { status: 500 }
        );
    }

    // Delete the used token
    await supabase
        .from('password_resets')
        .delete()
        .eq('token', token);

    // Invalidate all existing sessions for security
    await supabase
        .from('sesiones')
        .delete()
        .eq('usuario_id', resetRecord.usuario_id);

    return NextResponse.json({
        message: 'Contraseña actualizada correctamente. Inicia sesión con tu nueva contraseña.',
    });
}
