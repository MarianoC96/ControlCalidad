import { NextRequest, NextResponse } from 'next/server';
import { createApiClient } from '@/lib/supabase/api-client';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/auth/forgot-password
 * Initiates password recovery by creating a reset token
 * In production, this would send an email with the reset link
 */
export async function POST(request: NextRequest) {
    const supabase = await createApiClient();

    const body = await request.json();
    const { email } = body;

    if (!email) {
        return NextResponse.json(
            { error: 'El correo electrónico es requerido' },
            { status: 400 }
        );
    }

    // Find user by email (assuming usuario field contains email)
    const { data: user } = await supabase
        .from('usuarios')
        .select('id, usuario, nombre_completo')
        .eq('usuario', email)
        .single();

    // Always return success to prevent email enumeration
    if (!user) {
        return NextResponse.json({
            message: 'Si el correo existe, recibirás instrucciones para restablecer tu contraseña',
        });
    }

    // Create reset token
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

    // Delete any existing reset tokens for this user
    await supabase
        .from('password_resets')
        .delete()
        .eq('usuario_id', user.id);

    // Create new reset token
    const { error } = await supabase
        .from('password_resets')
        .insert({
            usuario_id: user.id,
            token,
            expires_at: expiresAt.toISOString(),
        });

    if (error) {
        console.error('Error creating reset token:', error);
        return NextResponse.json(
            { error: 'Error al procesar la solicitud' },
            { status: 500 }
        );
    }

    // In production, send email here with the reset link
    // For development, log the token
    console.log(`[DEV] Password reset token for ${email}: ${token}`);
    console.log(`[DEV] Reset URL: /restablecer-password?token=${token}`);

    return NextResponse.json({
        message: 'Si el correo existe, recibirás instrucciones para restablecer tu contraseña',
        // DEV ONLY - Remove in production
        devToken: process.env.NODE_ENV === 'development' ? token : undefined,
    });
}
