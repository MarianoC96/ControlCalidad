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

        // Check user role
        const { data: user } = await supabase
            .from('usuarios')
            .select('roles')
            .eq('id', parseInt(userId))
            .single();

        let query = supabase
            .from('download_history')
            .select('*, usuarios (nombre_completo)')
            .order('created_at', { ascending: false });

        // If not admin, only show own downloads
        if (user?.roles !== 'administrador') {
            query = query.eq('user_id', parseInt(userId));
        }

        const { data, error } = await query;

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
