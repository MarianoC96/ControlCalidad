import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;

        if (!userId) {
            console.log('API/ME: No userId cookie found');
            return NextResponse.json(
                { error: 'No autenticado' },
                { status: 401 }
            );
        }

        // Use SERVICE_ROLE_KEY to bypass RLS when fetching session user
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: user, error } = await supabase
            .from('usuarios')
            .select('id, nombre_completo, usuario, email, roles, activo, two_factor_secret')
            .eq('id', parseInt(userId))
            .eq('activo', true)
            .eq('is_deleted', false)
            .single();

        if (error || !user) {
            return NextResponse.json(
                { error: 'Usuario no encontrado' },
                { status: 404 }
            );
        }

        return NextResponse.json(user);

    } catch (error) {
        console.error('Get user error:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
