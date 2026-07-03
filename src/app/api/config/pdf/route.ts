import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/api/withAuth';
import { getAppUserById, userHasModule } from '@/lib/api/permissions';
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

        // Criterio unificado de autorización (sadmin / role_permisos)
        const user = await getAppUserById(parseInt(userId, 10));
        if (!user || !(await userHasModule(user, 'admin/config-reportes'))) {
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
