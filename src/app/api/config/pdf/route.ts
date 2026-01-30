import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { getPdfConfig, updatePdfConfig, PdfConfig } from '@/lib/config-helper';

export async function GET() {
    try {
        const config = await getPdfConfig();
        return NextResponse.json(config);
    } catch (error) {
        return NextResponse.json({ error: 'Error fetching config' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false } }
        );

        // Check Admin
        const { data: user } = await supabase
            .from('usuarios')
            .select('roles')
            .eq('id', userId)
            .single();

        if (!user || user.roles !== 'administrador') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const body = await request.json();
        const { titulo, codigo, edicion, aprobado_por } = body;

        const newConfig: PdfConfig = {
            titulo,
            codigo,
            edicion,
            aprobado_por
        };

        await updatePdfConfig(newConfig);

        return NextResponse.json({ success: true, config: newConfig });

    } catch (error) {
        console.error('Error updating config:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
