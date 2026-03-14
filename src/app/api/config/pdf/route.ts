import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, createServiceClient } from '@/lib/api/withAuth';
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
        const auth = await getAuthUserId();
        const userId = auth?.userId;

        if (!userId) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const supabase = createServiceClient();

        // Check Permissions
        const { data: user } = await supabase
            .from('usuarios')
            .select('usuario, roles, role_id')
            .eq('id', userId)
            .single();

        let hasAccess = false;
        if (user?.usuario === 'sadmin') hasAccess = true;
        else if (user?.role_id) {
            const { data: perm } = await supabase
                .from('role_permisos')
                .select('habilitado')
                .eq('role_id', user.role_id)
                .eq('modulo_key', 'admin/config-reportes')
                .eq('habilitado', true)
                .single();
            if (perm?.habilitado) hasAccess = true;
        } else if (user?.roles === 'administrador') {
            hasAccess = true;
        }

        if (!hasAccess) {
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
