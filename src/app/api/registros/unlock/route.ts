import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const body = await request.json();
        const { registro_id } = body;

        if (!registro_id) {
            return NextResponse.json({ error: 'ID de registro requerido' }, { status: 400 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
        );

        // Check if locked by user
        const { data: registro } = await supabase
            .from('registros')
            .select('edit_started_by')
            .eq('id', registro_id)
            .single();

        if (!registro) {
            return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
        }

        // Only allow unlock if locked by self
        if (registro.edit_started_by !== parseInt(userId)) {
            // Unless maybe admin? But usually only locker unlocks.
            // If admin needs to force unlock, that's a different feature.
            return NextResponse.json({ error: 'No tienes permiso para desbloquear este registro' }, { status: 403 });
        }

        // Clear lock
        const { error } = await supabase
            .from('registros')
            .update({
                edit_started_at: null,
                edit_expires_at: null,
                edit_started_by: null
            })
            .eq('id', registro_id);

        if (error) {
            return NextResponse.json({ error: 'Error al desbloquear' }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Unlock error:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
