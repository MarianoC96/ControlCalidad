import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const registroId = searchParams.get('id');

        if (!registroId) {
            return NextResponse.json({ error: 'ID de registro requerido' }, { status: 400 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data, error } = await supabase
            .from('history_edits')
            .select(`
                id,
                registro_id,
                edited_by,
                role,
                action,
                photos_added,
                photos_deleted,
                created_at,
                usuarios:edited_by (
                    id,
                    nombre_completo
                )
            `)
            .eq('registro_id', parseInt(registroId))
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching history:', error);
            throw error;
        }

        return NextResponse.json(data || []);

    } catch (error: any) {
        console.error('History API error:', error);
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}
