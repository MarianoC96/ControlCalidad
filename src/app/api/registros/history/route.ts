import { NextResponse } from 'next/server';
import { getAuthUserId, createServiceClient } from '@/lib/api/withAuth';
export async function GET(request: Request) {
    try {
        const auth = await getAuthUserId();
        const userId = auth?.userId;

        if (!userId) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const registroId = searchParams.get('id');

        if (!registroId) {
            return NextResponse.json({ error: 'ID de registro requerido' }, { status: 400 });
        }

        const supabase = createServiceClient();

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
                field_changes,
                created_at,
                usuarios:edited_by (
                    id,
                    nombre_completo,
                    usuario
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
