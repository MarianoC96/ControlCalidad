import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
        );

        // Fetch user role and download history IN PARALLEL
        const [userResult, historyResult] = await Promise.all([
            supabase
                .from('usuarios')
                .select('roles')
                .eq('id', parseInt(userId))
                .single(),
            // Pre-fetch all - we'll filter below if needed
            supabase
                .from('download_history')
                .select('id, user_id, start_date, end_date, total_files, status, error_message, created_at, zip_path, usuarios (nombre_completo)')
                .order('created_at', { ascending: false })
                .limit(200)
        ]);

        const user = userResult.data;
        let data = historyResult.data || [];

        // If not admin, filter to own downloads only
        if (user?.roles !== 'administrador') {
            data = data.filter((d: any) => d.user_id === parseInt(userId));
        }

        if (historyResult.error) {
            return NextResponse.json({ error: historyResult.error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
