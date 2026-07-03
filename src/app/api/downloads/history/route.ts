import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, createServiceClient } from '@/lib/api/withAuth';
export async function GET(req: NextRequest) {
    try {
        const auth = await getAuthUserId();
        const userId = auth?.userId;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createServiceClient();

        // El filtro por dueño va en SQL (usa idx_download_history_user_created):
        // filtrar en JS sobre el top-200 global podía dejar a un usuario sin ver
        // sus propias descargas si otros usuarios llenaban la página.
        const { data: user } = await supabase
            .from('usuarios')
            .select('roles')
            .eq('id', parseInt(userId))
            .single();

        let query = supabase
            .from('download_history')
            .select('id, user_id, start_date, end_date, total_files, status, error_message, created_at, zip_path, usuarios (nombre_completo)')
            .order('created_at', { ascending: false })
            .limit(200);

        if (user?.roles !== 'administrador') {
            query = query.eq('user_id', parseInt(userId));
        }

        const historyResult = await query;

        if (historyResult.error) {
            return NextResponse.json({ error: historyResult.error.message }, { status: 500 });
        }

        return NextResponse.json(historyResult.data || []);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
