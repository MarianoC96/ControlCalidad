import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-client';

export async function POST(request: NextRequest) {
    try {
        const supabase = createAdminClient();

        // Get current user from session cookies
        const responseMe = await fetch(new URL('/api/auth/me', request.url), {
            headers: { cookie: request.headers.get('cookie') || '' }
        });

        if (!responseMe.ok) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const user = await responseMe.json();

        // Optional: you might want to require the password or a 2FA code to disable it.
        // For now, mirroring the "reset" functionality requested.

        const { error: updateError } = await supabase
            .from('usuarios')
            .update({ two_factor_secret: null })
            .eq('id', user.id);

        if (updateError) {
            throw updateError;
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('2FA disable error:', error);
        return NextResponse.json({ error: 'Error al desactivar 2FA' }, { status: 500 });
    }
}
